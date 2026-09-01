import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { warnIfAutoSendContradictsOffer, WHATSAPP_LIVE_WARNING } from "../lib/whatsapp-promise";

const ROOT = path.resolve(import.meta.dirname, "../..");

describe("warnIfAutoSendContradictsOffer", () => {
  it("stays silent when the flag is unset — the deployed default", () => {
    const log = { error: vi.fn() };
    expect(warnIfAutoSendContradictsOffer({}, log)).toBe(false);
    expect(log.error).not.toHaveBeenCalled();
  });

  it("stays silent for any value other than the exact string 'true'", () => {
    const log = { error: vi.fn() };
    for (const value of ["false", "TRUE", "1", "yes", ""]) {
      expect(warnIfAutoSendContradictsOffer({ WHATSAPP_ALERTS_ENABLED: value }, log)).toBe(false);
    }
    expect(log.error).not.toHaveBeenCalled();
  });

  it("warns loudly when automated parent messaging is switched on", () => {
    const log = { error: vi.fn() };
    expect(warnIfAutoSendContradictsOffer({ WHATSAPP_ALERTS_ENABLED: "true" }, log)).toBe(true);
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledWith(WHATSAPP_LIVE_WARNING);
  });

  it("names the offer document, so the reader knows what became untrue", () => {
    expect(WHATSAPP_LIVE_WARNING).toContain("docs/dashboard/pilot-offer.md");
    expect(WHATSAPP_LIVE_WARNING).toContain("WHATSAPP_ALERTS_ENABLED");
  });
});

describe("the promise this guard defends", () => {
  it("matches the gate condition used by the producer and the consumer", () => {
    // If either gate is ever re-keyed to a different env var, this guard would
    // warn about a flag nothing reads. scripts/check-whatsapp-promise.ts is the
    // CI-level version of this; asserting it here too keeps the unit honest.
    const producer = fs.readFileSync(path.join(ROOT, "server/routes/attendance.ts"), "utf8");
    const consumer = fs.readFileSync(
      path.join(ROOT, "server/services/notifications-consumer.ts"),
      "utf8"
    );
    expect(producer).toContain('process.env.WHATSAPP_ALERTS_ENABLED === "true"');
    expect(consumer).toContain('process.env.WHATSAPP_ALERTS_ENABLED !== "true"');
  });

  it("is still the sentence the offer document shows a principal", () => {
    const offer = fs.readFileSync(path.join(ROOT, "docs/dashboard/pilot-offer.md"), "utf8");
    expect(offer).toContain("We do not auto-send WhatsApp messages today");
  });
});
