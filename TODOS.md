# TODOS

Live register of deferred work. Anything cut or postponed from a plan lands here with enough context to pick up cold. (Revived 2026-07-15 by /plan-ceo-review; source: the Sharpened Company design doc + CEO plan in ~/.gstack/projects/NitishKumar-ai-Class-mode/.)

## Deferred — gated on the graduation trigger (first payment or signed written commitment)

- [ ] **Provider-swap canary**: route a 48-hour low-volume slice of AI traffic through the secondary provider via `server/lib/ai/gateway.ts`, zero call-site changes, with a defined rollback (any quality/latency regression reverts immediately). Requires a funded OpenAI account (current key is a placeholder). First post-trigger engineering task.
- [ ] **Per-student learning-record schema draft**: the compounding-asset layer. Design only at first; seeded by the per-workflow usage-logging event stream. Do not start before the trigger — this is the documented strategy-escape-hatch risk.

## Deferred — gated on multiple schools live

- [ ] **Approach C, open standard play**: open per-student learning-record standard + open evals for Indian K-12, Class-mode as reference implementation. Revisit when there is adoption to anchor a standard.

## Deferred — post-90-day-plan hardening (from /plan-ceo-review 2026-07-15)

- [ ] **Offline v2 hardening** (after offline-first attendance v1 ships): auth-token expiry while entries are queued (re-auth without losing the queue), multi-device-per-teacher conflict handling, shared-device privacy (teacher logout wipes local queue). v1 assumes single device per teacher and documents it.
- [ ] **Custody beyond the baseline**: scheduled backup-restore drills (baseline = one tested restore), retention/deletion automation for minors' data, breach-response runbook, and contractual data-ownership + exportability language in the paid-pilot agreement. Context: exportability is the strategic answer to "dependence = lock-in".
- [ ] **Metrics dashboard**: `npm run metrics:weekly` script output suffices for one founder and one school; build a real dashboard when school #2 is live.

## Deferred — housekeeping

- [ ] **Stale stash cleanup**: 4 stashes, oldest June 2026, including one on the removed `feat/workspace-v2` branch. Inspect, salvage anything live, drop the rest.

## Standing decisions (do not resurrect without new evidence)

- Automated WhatsApp/Meta absence pipeline stays paused until a principal validates willingness-to-pay (manual preview during WTP week is allowed and honest-labeled).
- Never-build list (constitution): no foundation-model training, no standalone AI tutor app, no "our AI is smarter" features, no single-provider coupling, no fabricated data shown to real accounts.

## Completed
