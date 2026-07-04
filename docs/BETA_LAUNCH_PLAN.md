# Beta Launch Plan — Class Mode (EduAI)

**Goal:** Move from "deployed but pilot-blocked" to a beta where a real school can self-onboard and use the product daily without hand-holding.

**Date:** 2026-07-05 · **Current version:** 1.8.4.0 · **Prod:** https://classmode.inmodel.in

---

## Context

The product is feature-complete for a pilot: 37 pages, all core loops built (signup → onboard → classes → attendance → tests → grading → parent alerts). Infrastructure is production-grade: fail-closed tenant isolation (`server/lib/tenant.ts`), rate limiting, bcrypt, GCP Secret Manager, advisory-locked AUTO_MIGRATE.

The July 2 QA report (health 48/100, `.gstack/qa-reports/`) found 13 issues. **Verified today: the 3 worst blockers are already fixed** (schoolCode set at `server/routes/onboarding.ts:198`, passed through `server/middleware.ts:60`; class creation calls `/api/onboarding/classes`; quota metering uses `ai_usage_logs`). What remains is a shorter list of real gaps, plus hardening and proof-via-E2E before inviting a school.

---

## Phase 0 — Re-verify the fixed blockers end-to-end (½ day)

The fixes exist in code but were never re-QA'd. Prove them before building anything.

- [ ] Fresh local DB → sign up a new school → complete onboarding → confirm dashboard, attendance, fees, student directory all load (no 403s)
- [ ] Teacher onboarding: create class → invite student → student accepts → appears in roster
- [ ] Run `npm run check && npm run lint && npm test` and `npx playwright test` as baseline

**Exit criteria:** a brand-new school can reach a working dashboard with zero manual DB edits.

## Phase 1 — Fix remaining verified blockers (2–3 days)

1. **API 404 guard (ISSUE-009)** — unknown `/api/*` paths fall into the SPA catch-all and return 200 + index.html, masking every missing/renamed route. Add `app.all("/api/*", → 404 JSON)` before the catch-alls in `server/vite.ts:48` (dev) and `server/vite.ts:90` (prod). *Do this first — it un-masks everything else.*
2. **WebSocket handshake 400 (ISSUE-004)** — Messages page stuck on "Connecting…". Debug upgrade/auth in `server/message/index.ts`. If not quickly fixable, hide Messages nav for beta rather than ship a visibly broken feature.
3. **Dev migration pgvector (ISSUE-002)** — `npm run migrate` fails on `CREATE EXTENSION vector`; switch dev compose image to `pgvector/pgvector:pg16` (docker/docker-compose.yml) so onboarding doesn't hang locally.
4. **Silent 403s (ISSUE-005)** — Fees/attendance render permission errors as "No data yet" empty states. Distinguish 403 from empty in the shared query/error handling on the client.
5. **Staff invite path (ISSUE-006)** — verify a principal can invite teachers *after* onboarding (workspace invites exist; confirm it's reachable from the principal/school-admin dashboard and add the entry point if not).

## Phase 2 — Finish the data migration (1–2 days)

From `docs/DATABASE_MIGRATION_CHECKLIST.md`:

- [ ] **Phase 7:** run `npx tsx scripts/pg-backfill-users.ts`, verify Mongo↔PG delta = 0
- [ ] **Phase 8:** monitor auth fallback rate; when zero, remove MongoDB fallback lookups
- [ ] Confirm Cloud SQL automated backups + point-in-time recovery are enabled (GCP console — nothing in code enforces this)

Beta users writing real attendance/fee data on a half-migrated store is the biggest data-loss risk in this plan; don't defer it.

## Phase 3 — Production hardening (2 days)

1. **Centralized error handler** — one Express error middleware producing consistent JSON (`server/index.ts`); today errors are per-route try/catch with inconsistent shapes.
2. **Error reporting** — pipe `logger.error` to GCP Error Reporting (zero new vendor; structured logs already go to Cloud Logging). Add request-ID correlation.
3. **Alerting** — GCP uptime check on `/api/health` + alert on error-rate spike. Today nobody is paged if beta breaks at night.
4. **Secrets audit** — confirm all cloudbuild secrets exist; add `WHATSAPP_VERIFY_TOKEN` (webhook verification reads it, cloudbuild doesn't inject it).
5. **CI red cleanup (#272)** — enable GitHub Code Scanning so CodeQL stops erroring; triage current Trivy CRITICALs once.

## Phase 4 — E2E tests for the beta-critical paths (2 days)

Playwright specs (only 4 exist today; none cover the flows that were broken):

- [ ] `school-onboarding.spec.ts` — signup → verify → onboard → dashboard loads with no 403s *(regression guard for ISSUE-001/010)*
- [ ] `teacher-class-flow.spec.ts` — create class → invite student → student joins *(guard for ISSUE-008)*
- [ ] `attendance.spec.ts` — mark absent → alert dispatch recorded
- [ ] `tenant-isolation.spec.ts` — two schools in parallel; school A never sees school B data
- [ ] Wire these into `ci.yml`

## Phase 5 — Beta launch (≈1 week, mostly operational)

1. Deploy everything above; verify rollout (new-route JSON flip + uptime reset, per deploy runbook)
2. Run `/qa` against production; target health ≥ 85 (was 78)
3. Seed nothing — the pilot school onboards through the real signup flow (that *is* the test)
4. WhatsApp: keep outbound fail-loud (v1.8.3.1) only. Per the demand-first decision, do **not** build the inbound webhook/automated Meta pipe until a principal validates willingness-to-pay
5. Onboard 1 pilot school (50–200 students), set up a feedback channel, check `/api/health/detailed` + error dashboard daily for the first 2 weeks

## Explicitly out of scope for beta (all have workarounds)

Billing UI (Stripe backend done), study-plan drag-reschedule, recurring live classes, CSV export, AI-tutor web search, PBL, AI-gateway migration TODOs (`server/lib/ai/gateway.ts`), Anthropic adapter.

---

## Timeline

| Phase | Effort | Cumulative |
|---|---|---|
| 0 — Re-verify | ½ day | Day 1 |
| 1 — Blockers | 2–3 days | Day 4 |
| 2 — Migration | 1–2 days | Day 6 |
| 3 — Hardening | 2 days | Day 8 |
| 4 — E2E tests | 2 days | Day 10 |
| 5 — Launch + monitor | 1 week | ~Day 17 |

**≈2 working weeks to a school actively using the product.** Phases 2–4 can partially overlap if needed.

## Verification (per phase)

- `npm run check && npm run lint && npm test` green
- `npx playwright test` green (including new specs from Phase 4)
- Manual: fresh-school signup on prod completes with no 403s
- Prod `/qa` health ≥ 85; `/api/health/detailed` all green
- Alert fires when health endpoint is forced to fail (test the pager once)
