/**
 * WhatsApp promise/gate invariant check.
 *
 * `docs/dashboard/pilot-offer.md` is a document we put in front of a principal.
 * It states, in writing: "We do not auto-send WhatsApp messages today". That
 * sentence is only true because TWO code gates hold, both keyed on the same
 * env var:
 *
 *   producer  server/routes/attendance.ts          WHATSAPP_ALERTS_ENABLED === "true"
 *   consumer  server/services/notifications-consumer.ts  WHATSAPP_ALERTS_ENABLED !== "true"
 *
 * The consumer gate exists separately so an attendance.marked event queued
 * BEFORE the switch was turned off cannot message parents out of the backlog.
 * Both ends must hold, or the backlog leaks.
 *
 * Nothing in the repo previously connected the promise to the gates. This
 * script is that link. It fails when the promise and the mechanism that makes
 * it true drift apart in either direction:
 *
 *   - a gate is removed or renamed while the offer still carries the promise
 *     -> we would be auto-messaging parents while telling schools we do not
 *   - the promise is removed from the offer
 *     -> that is a deliberate retraction, not a typo. It has to be an explicit
 *        act by a human who has decided to change what we tell schools, so the
 *        check fails until the baseline below is updated in the same commit.
 *
 * What this script CANNOT see is the deployed value of WHATSAPP_ALERTS_ENABLED.
 * Verified manually 2026-08-31: no WHATSAPP_* env vars are set on the
 * classmode-app container app in classmode-rg, so the flag is unset and both
 * gates hold in production. The runtime half of this invariant is a boot-time
 * warning in server/index.ts.
 *
 *   npm run check:whatsapp-promise
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/**
 * Set to false ONLY in the same commit that removes the promise from
 * pilot-offer.md, by a human who has decided we now tell schools something
 * different. Flipping this is the record of that decision.
 */
const OFFER_PROMISES_NO_AUTOSEND = true;

const ENV_FLAG = "WHATSAPP_ALERTS_ENABLED";

interface Check {
  /** Noun phrase naming the thing, for both the ok list and the failure list. */
  label: string;
  file: string;
  /** Literal substring that must be present. */
  needle: string;
}

const CHECKS: Check[] = [
  {
    label: "the offer's no-auto-send promise",
    file: "docs/dashboard/pilot-offer.md",
    needle: "We do not auto-send WhatsApp messages today",
  },
  {
    label: "the recorded pause rule",
    file: "docs/dashboard/README.md",
    needle: "WhatsApp/Meta automated pipe stays paused until WTP validated",
  },
  {
    label: "the PRODUCER gate",
    file: "server/routes/attendance.ts",
    needle: `process.env.${ENV_FLAG} === "true"`,
  },
  {
    label: "the CONSUMER gate",
    file: "server/services/notifications-consumer.ts",
    needle: `process.env.${ENV_FLAG} !== "true"`,
  },
];

function read(file: string): string | null {
  const full = path.join(ROOT, file);
  try {
    return fs.readFileSync(full, "utf8");
  } catch {
    return null;
  }
}

const missing: string[] = [];
const present: string[] = [];

for (const check of CHECKS) {
  const body = read(check.file);
  if (body === null) {
    missing.push(`${check.label} — ${check.file} not found`);
    continue;
  }
  if (body.includes(check.needle)) {
    present.push(`${check.label}  [${check.file}]`);
  } else {
    missing.push(`${check.label} — "${check.needle}" no longer in ${check.file}`);
  }
}

const offerCheck = CHECKS[0];
const offerBody = read(offerCheck.file);
const offerStillPromises = offerBody !== null && offerBody.includes(offerCheck.needle);

// Direction 2: the promise was removed without anyone flipping the baseline.
if (OFFER_PROMISES_NO_AUTOSEND && !offerStillPromises) {
  console.error(
    [
      "",
      "  WHATSAPP PROMISE RETRACTED WITHOUT A DECISION",
      "",
      `  ${offerCheck.file} no longer says "${offerCheck.needle}".`,
      "",
      "  That sentence is what a principal reads before signing. Removing it",
      "  changes what we tell schools, so it cannot be a silent edit.",
      "",
      "  If the retraction is intended, set OFFER_PROMISES_NO_AUTOSEND = false in",
      "  scripts/check-whatsapp-promise.ts in the SAME commit, and say why in the",
      "  commit message. If it is not intended, restore the line.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

// Direction 1: the promise stands but the mechanism that makes it true does not.
if (OFFER_PROMISES_NO_AUTOSEND && missing.length > 0) {
  console.error(
    [
      "",
      "  WHATSAPP PROMISE AND GATES HAVE DRIFTED",
      "",
      `  ${offerCheck.file} still tells schools we do not auto-send.`,
      "  These are gone:",
      "",
      ...missing.map((m) => `    - ${m}`),
      "",
      `  Both gates key on ${ENV_FLAG}. If either is removed or renamed, a`,
      "  configured Meta credential is enough to start messaging real parents",
      "  while the signed offer says we do not. Restore the gate, or retract the",
      "  promise deliberately (see the header of this file).",
      "",
    ].join("\n")
  );
  process.exit(1);
}

if (!OFFER_PROMISES_NO_AUTOSEND) {
  console.log(
    `check:whatsapp-promise — baseline says the no-auto-send promise was retracted; gate checks skipped.`
  );
  process.exit(0);
}

console.log("check:whatsapp-promise — invariant holds:");
for (const line of present) console.log(`  ok  ${line}`);
console.log(
  `\n  Note: this cannot see the deployed ${ENV_FLAG}. Last manual check 2026-08-31:` +
    "\n  no WHATSAPP_* env vars set on classmode-app / classmode-rg."
);
