import { logger } from "../lib/logger";
import { 
  pgFindRecordById, 
  pgUpdateRecord, 
  pgListFields
} from "../lib/pg-dynamic-sis";
import { geminiChat } from "../lib/gemini";
import { DynamicField } from "@shared/schema";

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

      // Process each enrichment field
      for (const field of enrichmentFields) {
        if (field.type === "ai_enrichment") {
          await this.handleAIEnrichment(recordId, record.data, field);
        } else if (field.type === "api_fetch") {
          await this.handleAPIFetch(recordId, record.data, field);
        } else if (field.type === "formula") {
          await this.handleFormula(recordId, record.data, field);
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
  ): Promise<void> {
    const promptTemplate = field.config?.prompt as string;
    if (!promptTemplate) return;

    const finalPrompt = DynamicEnrichmentService.interpolate(promptTemplate, data);
    
    // Check if interpolation changed anything or if required variables are missing
    if (finalPrompt.includes("{{")) {
      logger.warn(`[Enrichment] Skipping AI for ${recordId}: Missing data for template variables.`);
      return;
    }

    try {
      logger.info(`[Enrichment] Running AI for ${field.name} on record ${recordId}`);
      
      const response = await geminiChat(
        "You are an expert school administrator assistant. Provide concise, helpful responses based on the provided data.",
        finalPrompt
      );

      // Save result back to the record
      await pgUpdateRecord(recordId, { [field.name]: response.trim() });
      
      logger.info(`[Enrichment] AI completed for ${field.name} on record ${recordId}`);
    } catch (error) {
      logger.error(`[Enrichment] AI failed for ${field.name}`, { error: String(error) });
      await pgUpdateRecord(recordId, { [field.name]: `Error: ${String(error)}` });
    }
  }

  /**
   * Handles simple formulas
   */
  private async handleFormula(
    recordId: string,
    data: Record<string, any>,
    field: DynamicField
  ): Promise<void> {
    const formulaTemplate = field.config?.formula as string;
    if (!formulaTemplate) return;

    const interpolated = DynamicEnrichmentService.interpolate(formulaTemplate, data);

    try {
      // Basic math evaluator (numbers and operators)
      if (/^[0-9+\-*/().\s]+$/.test(interpolated)) {
        // Safe evaluation for simple math: use Function constructor with strict scope or a simple parser
        // For this prototype, we'll use a slightly safer regex-validated approach
        // eslint-disable-next-line no-new-func
        const result = new Function(`return (${interpolated})`)();
        await pgUpdateRecord(recordId, { [field.name]: String(result) });
      } else {
        // Just treat as a string concatenation
        await pgUpdateRecord(recordId, { [field.name]: interpolated });
      }
    } catch (error) {
      await pgUpdateRecord(recordId, { [field.name]: "#ERROR!" });
    }
  }


  /**
   * Handles external API fetches
   */
  private async handleAPIFetch(
    recordId: string, 
    data: Record<string, any>, 
    field: DynamicField
  ): Promise<void> {
    const urlTemplate = field.config?.url as string;
    if (!urlTemplate) return;

    const finalUrl = DynamicEnrichmentService.interpolate(urlTemplate, data);
    if (finalUrl.includes("{{")) return;

    try {
      const res = await fetch(finalUrl);
      const json = await res.json();
      const result = typeof json === "object" ? JSON.stringify(json) : String(json);

      await pgUpdateRecord(recordId, { [field.name]: result });
    } catch (error) {
      logger.error(`[Enrichment] API Fetch failed for ${field.name}`, { error: String(error) });
    }
  }
}

export const dynamicEnrichmentService = new DynamicEnrichmentService();
