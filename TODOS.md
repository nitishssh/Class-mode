# TODOS

Live register of deferred work. Anything cut or postponed from a plan lands here with enough context to pick up cold. (Revived 2026-07-15 by /plan-ceo-review; source: the Sharpened Company design doc + CEO plan in ~/.gstack/projects/NitishKumar-ai-Class-mode/.)

## From /ship pre-landing review, v1.9.0.0 (2026-07-17)

- [x] **P0 — fix `server/tests/whatsapp-automation.test.ts`**: DONE 2026-07-18. Root cause was the `../lib/redis` mock omitting the `BULLMQ_PREFIX` export the service imports; added it to the mock. That run was green (463 passing); full-suite runs remain intermittently flaky under vitest parallelism — see the P1 item under "From adversarial review" below.
- [ ] **P1 — e2e coverage for the absentee/export surface**: no Playwright spec visits `/absentees` (list render, print, CSV download), view-events (`attendance_view`/`report_view`) are never asserted in a real browser, and the three new pg-queries helpers only ever run mocked. Coverage gate shipped at 75% with these as the accepted gap.
- [ ] **P1 — dedupe `POST /api/usage`**: per-user/feature/day dedupe at insert still needed. Mitigations shipped 2026-07-18: 30/min rate limit, staff-only 403, metrics exclude NULL-school/E2E/admin actors.
- [x] **P2 — print stylesheet**: DONE 2026-07-20 (PR #346). Sidebar/quest chrome `print:hidden`, main offset dropped via `print:!ml-0`.
- [ ] **P2 — unify platform-admin scope convention**: `GET /api/attendance/school-summary` treats missing `?schoolCode=` as cross-school, while `/absentees` and `/api/export/*` fail closed and require it. Align on explicit-school-required.
- [ ] **P2 — metrics script tests**: `isoWeekOf()` year-boundary/week-53 cases and the 50%-of-baseline two-week threshold in `scripts/metrics-weekly.ts` have no tests; the threshold drives the pilot kill decision.
- [ ] **P3 — review cleanups**: share the schoolCode-from-request resolver (attendance absentees + export routes), type `pgExportAttendanceRows`/`pgExportFeeRows` returns, move `AbsenteeRow` to shared/, normalize snake/camel schoolCode in one place (tenant.ts).

(Wedge-screen touch targets and contrast — status buttons h-8, amber/white contrast — are already scoped in the design spec for expansion 2.3; not re-listed here.)

## Deferred — gated on the graduation trigger (first payment or signed written commitment)

- [ ] **Provider-swap canary**: route a 48-hour low-volume slice of AI traffic through the secondary provider via `server/lib/ai/gateway.ts`, zero call-site changes, with a defined rollback (any quality/latency regression reverts immediately). Requires a funded OpenAI account (current key is a placeholder). First post-trigger engineering task.
- [ ] **Per-student learning-record schema draft**: the compounding-asset layer. Design only at first; seeded by the per-workflow usage-logging event stream. Do not start before the trigger — this is the documented strategy-escape-hatch risk.

## Deferred — gated on multiple schools live

- [ ] **Approach C, open standard play**: open per-student learning-record standard + open evals for Indian K-12, Class-mode as reference implementation. Revisit when there is adoption to anchor a standard.

## Deferred — post-90-day-plan hardening (from /plan-ceo-review 2026-07-15)

- [ ] **Offline v2 hardening** (after offline-first attendance v1 ships): auth-token expiry while entries are queued (re-auth without losing the queue), multi-device-per-teacher conflict handling, shared-device privacy (teacher logout wipes local queue). v1 assumes single device per teacher and documents it.
- [ ] **Custody beyond the baseline**: scheduled backup-restore drills (baseline = one tested restore), retention/deletion automation for minors' data, breach-response runbook, and contractual data-ownership + exportability language in the paid-pilot agreement. Context: exportability is the strategic answer to "dependence = lock-in".
- [ ] **Metrics dashboard**: `npm run metrics:weekly` script output suffices for one founder and one school; build a real dashboard when school #2 is live.

## From /ship pre-landing review, v1.9.0.0 second pass (2026-07-18)

- [ ] **P2 — membership-status check in `resolveInvitingAdminSchool`** (`server/routes/onboarding.ts`): the fallback trusts `users.school_id`/`school_code` without consulting `memberships.status`, so a revoked/suspended principal whose user row wasn't scrubbed can still resolve the school and invite teachers. Verify an active membership before honoring the fallback. (Security review, conf 6/10; the admin-role gate added 2026-07-18 narrows the exposure.)
- [ ] **P2 — `GET /school/me` still creator-only**: resolves solely via `pgFindSchoolByCreatedByUid`, the same non-creator 404 bug class fixed for `/invite/teacher` and `/invite/staff`. Evaluate whether joined admins need it and apply `resolveInvitingAdminSchool` if so.
- [ ] **P2 — e2e specs for GDPR export zip stream + upload accept path**: both are deliberately untestable under vitest (`archiver` via createRequire; no disk writes in unit env). `server/tests/gdpr.test.ts` explicitly points here.
- [x] **P3 — pending state on `/absentees` CSV download buttons**: DONE 2026-07-20 (PR #346). Buttons disable + spinner while a download is in flight.
- [ ] **P3 — unit test for the metrics baseline-arming rule** (`scripts/metrics-weekly.ts`): `renderTable` is module-private and `scripts/` is untested; a regression back to `prior[0]` would silently disarm the 50% threshold again. Export the baseline-selection helper and test both arming and the not-armed banner.
- [ ] **P3 — upload rejection no-disk-write assertion** (`server/tests/upload.test.ts`): the header claims rejects write nothing to disk but no test pins it; snapshot the upload dir (or stub fs) around the rejection cases.
- [ ] **P3 — stale-save note-drop case on attendance upsert**: a note-carrying save with an older client clock is skipped whole by the `updated_at` guard (note dropped — including a genuine note-CLEAR, defeating the "send empty string to clear" contract). Document/assert in `attendance_note_preserve.regression.test.ts`; the real fix is the E9 per-row-outcome rewrite already tracked in the 2026-07-15 CEO plan. Future-clock freeze is mitigated (markedAt clamped to now+5min, 2026-07-18).

## From adversarial review, v1.9.0.0 second pass (2026-07-18) — deferred

- [ ] **P1 — flaky full-suite runs under vitest parallelism**: ~1 in 3 full runs fails one random supertest-based test ("socket hang up" / wrong status), different file each time (seen: absentees_export, auth_routes); every file passes in isolation and the class predates 2026-07-18 (hit the untouched HEAD at ship Step 5). Likely worker/socket contention — consider `pool: forks`, lower maxWorkers, or supertest agent reuse.
- [ ] **P2 — stream/cap CSV exports**: both export queries load full history into memory and build the CSV as one string; the Absentees buttons always request the unbounded variant. A 10/min rate limit was added 2026-07-18; still needed: stream rows, enforce a max date range, and pass the scoped `schoolCode` so platform admins can export from `/absentees` at all.
- [ ] **P2 — replace the E2E school-code prefix heuristic with an explicit flag**: metrics exclude `school_code LIKE 'E2E%'`, but the prefix is an unenforced coincidence of e2e signup emails (`makeUniqueSchoolCode` derives codes from email). A real school whose creator email starts with "e2e" silently vanishes from adoption metrics. Add `schools.is_synthetic` set by seeds/e2e fixtures and filter on that.
- [ ] **P2 — invite/accept existing-account overwrite semantics**: acceptance still resets password/role/school for existing non-privileged accounts (privileged-role clobber blocked + list tokens stripped 2026-07-18). Consider refusing existing-account rebinding entirely in favor of an explicit account-link flow, and not trusting body-email echo as mailbox proof.
- [ ] **P3 — metrics-weekly correctness nits**: "2 consecutive weeks" breach check doesn't verify week adjacency; running mid-week persists partial snapshots that permanently understate the baseline; fees/feature_usage week windows are UTC while attendance uses local dates (IST Monday 00:00–05:30 lands in the prior week).
- [ ] **P3 — admin attendance is ambiguous across schools with the same class name**: admin class/roster lookups are cross-school keyed only by className; "all present" on a shared name like "Grade 10" now 400s on the tenant-mix guard with no school selector in the UI. Needs an explicit school scope in the admin attendance UI/API.

## Newly found (2026-07-18 code inspection)

- [x] **P2 — gitignore `public/uploads/`**: DONE 2026-07-18. Added the runtime upload directory to `.gitignore` so uploaded files, which may contain student PII, cannot be staged accidentally.
- [ ] **P3 — `features/ai-classroom/studyArena` (~93k LOC, ~half the repo) is unused**: nothing imports it; the used parts were hand-ported to `server/services/study-arena/` (which carry "Ported from…" provenance comments). It ships its own LICENSE/NOTICE. Decide: extract to its own repo/submodule, or delete (recoverable via git history). Deferred pending owner decision.

## Deferred — housekeeping

- [ ] **Stale stash cleanup**: 4 stashes, oldest June 2026, including one on the removed `feat/workspace-v2` branch. Inspect, salvage anything live, drop the rest.

## Standing decisions (do not resurrect without new evidence)

- Automated WhatsApp/Meta absence pipeline stays paused until a principal validates willingness-to-pay (manual preview during WTP week is allowed and honest-labeled).
- Never-build list (constitution): no foundation-model training, no standalone AI tutor app, no "our AI is smarter" features, no single-provider coupling, no fabricated data shown to real accounts.

## Completed

- [x] **Salvaged non-creator teacher-invite fix (2026-07-18)**: recovered from a stale agent worktree (`gracious-thompson-c9d56d`) before deletion. `POST /invite/teacher` and `/invite/teacher/list` resolved the school only via `schools.created_by_uid`, so a principal/school*admin who \_joined* a school (not its creator) got a 404. Added `resolveInvitingAdminSchool()` (created_by_uid → user.schoolId → user.schoolCode) + regression test `server/tests/invite_teacher_non_creator_school.test.ts` (first test for the onboarding invite routes). Fallback resolves by `schoolCode` because invite/accept populates `users.school_code`, not always `school_id`.
- [x] **Worktree cleanup (2026-07-18)**: removed 5 stale `.claude/worktrees/*` (498 MB) and their merged branches after confirming 4 were ancestors of HEAD and the 5th's unique work was salvaged (above).
- [x] **First tests for two untested risky routes (2026-07-18)**: `server/tests/gdpr.test.ts` (export scoped to caller's own id, 401/404, delete 200/401/500-on-failure) and `server/tests/upload.test.ts` (multer filter rejects HTML/exe/MIME-spoofed uploads — the stored-XSS boundary — plus `diskPathToUrl` never leaks an absolute path). Note: GDPR zip-stream happy path and the upload accept/disk-write path are left to e2e — `archiver` (createRequire) isn't callable under vitest, and these tests deliberately avoid runtime disk writes.
