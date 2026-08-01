import { logger } from "../lib/logger";
import {
  pgFindRecordById,
  pgUpdateRecord,
  pgListFields
} from "../lib/db/pg-dynamic-sis";
import { generate } from "../lib/ai/gateway";
import { DynamicField } from "@shared/schema";

// Rejects URLs that point to private/loopback networks (SSRF prevention)
function isPrivateUrl(rawUrl: string): boolean {
  try {
    const { hostname, protocol } = new URL(rawUrl);
    if (protocol !== "https:" && protocol !== "http:") return true;
    const privatePatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^0\./,
      /^::1$/,
      /^fc[0-9a-f]{2}:/i,
      /^fe[89ab][0-9a-f]:/i,
      /^169\.254\./,
      /^metadata\.google\.internal$/i,
    ];
    return privatePatterns.some((p) => p.test(hostname));
  } catch {
    return true;
  }
}

// Safe recursive-descent math evaluator — no eval / new Function
function safeMathEval(expr: string): number {
  const tokens = expr.match(/[0-9]*\.?[0-9]+|[+\-*/()]/g) ?? [];
  let pos = 0;

  function parseExpr(): number {
    let val = parseTerm();
    while (pos < tokens.length && (tokens[pos] === "+" || tokens[pos] === "-")) {
      const op = tokens[pos++];
      val = op === "+" ? val + parseTerm() : val - parseTerm();
    }
    return val;
  }

  function parseTerm(): number {
    let val = parseFactor();
    while (pos < tokens.length && (tokens[pos] === "*" || tokens[pos] === "/")) {
      const op = tokens[pos++];
      const right = parseFactor();
      if (op === "/" && right === 0) throw new Error("Division by zero");
      val = op === "*" ? val * right : val / right;
    }
    return val;
  }

  function parseFactor(): number {
    if (tokens[pos] === "(") {
      pos++;
      const val = parseExpr();
      if (tokens[pos] !== ")") throw new Error("Mismatched parentheses");
      pos++;
      return val;
    }
    const n = parseFloat(tokens[pos++]);
    if (isNaN(n)) throw new Error(`Unexpected token: ${tokens[pos - 1]}`);
    return n;
  }

  const result = parseExpr();
  if (pos !== tokens.length) throw new Error("Unexpected trailing tokens");
  return result;
}

/**
 * Service to handle background enrichments (AI, API fetches, Formulas)
 * for the No-Code SIS.
 */
export class DynamicEnrichmentService {
  /**
   * Main entry point to process a record. 
   * Scans all fields and triggers necessary actions.
   */
  async processRecord(recordId: string, tableId: number): Promise<void> {
    try {
      const record = await pgFindRecordById(recordId);
      if (!record) return;

      const fields = await pgListFields(tableId);
      const enrichmentFields = fields.filter(f => 
        ["ai_enrichment", "api_fetch", "formula"].includes(f.type)
      );

      if (enrichmentFields.length === 0) return;

      logger.info(`[Enrichment] Processing record ${recordId} for table ${tableId}`);

      // Process each enrichment field, propagating computed values so that
      // later fields can reference values produced by earlier ones.
      const currentData: Record<string, any> = { ...record.data };
      for (const field of enrichmentFields) {
        let updatedValue: string | null = null;
        if (field.type === "ai_enrichment") {
          updatedValue = await this.handleAIEnrichment(recordId, currentData, field);
        } else if (field.type === "api_fetch") {
          updatedValue = await this.handleAPIFetch(recordId, currentData, field);
        } else if (field.type === "formula") {
          updatedValue = await this.handleFormula(recordId, currentData, field);
        }
        if (updatedValue !== null) {
          currentData[field.name] = updatedValue;
        }
      }
    } catch (error) {
      logger.error(`[Enrichment] Error processing record ${recordId}`, { error: String(error) });
    }
  }

  /**
   * Interpolates a string with row data: "Hello {{Name}}" -> "Hello John"
   */
  public static interpolate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(.*?)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      return data[trimmedKey] !== undefined ? String(data[trimmedKey]) : match;
    });
  }

  /**
   * Handles AI Prompt columns (Clay.com style)
   */
  private async handleAIEnrichment(
    recordId: string,
    data: Record<string, any>,
    field: DynamicField
  ): Promise<string | null> {
    const promptTemplate = field.config?.prompt as string;
    if (!promptTemplate) return null;

    const finalPrompt = DynamicEnrichmentService.interpolate(promptTemplate, data);

    // Check if interpolation changed anything or if required variables are missing
    if (finalPrompt.includes("{{")) {
      logger.warn(`[Enrichment] Skipping AI for ${recordId}: Missing data for template variables.`);
      return null;
    }

    try {
      logger.info(`[Enrichment] Running AI for ${field.name} on record ${recordId}`);

      const response = await generate({
        model: "fast",
        system:
          "You are an expert school administrator assistant. Provide concise, helpful responses based on the provided data.",
        messages: [{ role: "user", content: finalPrompt }],
        feature: "sis_enrichment",
      });

      const value = response.trim();
      // Save result back to the record
      await pgUpdateRecord(recordId, { [field.name]: value });

      logger.info(`[Enrichment] AI completed for ${field.name} on record ${recordId}`);
      return value;
    } catch (error) {
      logger.error(`[Enrichment] AI failed for ${field.name}`, { error: String(error) });
      const errorValue = `Error: ${String(error)}`;
      await pgUpdateRecord(recordId, { [field.name]: errorValue });
      return errorValue;
    }
  }

  /**
   * Handles simple formulas
   */
  private async handleFormula(
    recordId: string,
    data: Record<string, any>,
    field: DynamicField
  ): Promise<string | null> {
    const formulaTemplate = field.config?.formula as string;
    if (!formulaTemplate) return null;

    const interpolated = DynamicEnrichmentService.interpolate(formulaTemplate, data);

    try {
      if (/^[0-9+\-*/().\s]+$/.test(interpolated)) {
        const result = String(safeMathEval(interpolated));
        await pgUpdateRecord(recordId, { [field.name]: result });
        return result;
      } else {
        await pgUpdateRecord(recordId, { [field.name]: interpolated });
        return interpolated;
      }
    } catch {
      await pgUpdateRecord(recordId, { [field.name]: "#ERROR!" });
      return "#ERROR!";
    }
  }


  /**
   * Handles external API fetches
   */
  private async handleAPIFetch(
    recordId: string,
    data: Record<string, any>,
    field: DynamicField
  ): Promise<string | null> {
    const urlTemplate = field.config?.url as string;
    if (!urlTemplate) return null;

    const finalUrl = DynamicEnrichmentService.interpolate(urlTemplate, data);
    if (finalUrl.includes("{{")) return null;

    if (isPrivateUrl(finalUrl)) {
      logger.warn(`[Enrichment] Blocked SSRF attempt to private URL: ${finalUrl}`);
      const blockedValue = "#BLOCKED: private URL not allowed";
      await pgUpdateRecord(recordId, { [field.name]: blockedValue });
      return blockedValue;
    }

    try {
      const res = await fetch(finalUrl);
      const json = await res.json();
      const result = typeof json === "object" ? JSON.stringify(json) : String(json);

      await pgUpdateRecord(recordId, { [field.name]: result });
      return result;
    } catch (error) {
      logger.error(`[Enrichment] API Fetch failed for ${field.name}`, { error: String(error) });
      return null;
    }
  }
}

export const dynamicEnrichmentService = new DynamicEnrichmentService();
