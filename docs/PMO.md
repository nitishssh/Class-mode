# PMO — Class-mode

_Established 2026-08-17. Owner: PMO role (agent). Source of truth for **what is in flight, what is blocked, and what is deliberately not being done**._

This file does not replace `TODOS.md` (the deferred-work register) or the plan docs. It sits above them and answers one question: **given the dated commitments in `docs/win-plan-eoy2026.md`, what work actually has to happen, in what order, and what is stopping it.**

---

## 1. Charter

**The PMO does:**

- Maintain the program board below and keep it reconciled with `TODOS.md`, GitHub issues/PRs, and the CHANGELOG after every release.
- Hold the dated milestones and report distance-to-date honestly, including when a date is already lost.
- Surface blockers that are **not engineering work** (an API key, a business decision, a signature) with the same weight as code, because those are what have actually stalled this project.
- Name the critical path and refuse work that isn't on it during a gate crunch.
- Record decisions so a reversal is visible as a reversal.

**The PMO does not:**

- Re-open settled strategy. The CEO plan, the never-build list, and the Study Arena freeze are decisions, not proposals.
- Estimate in story points, run ceremonies, or add process to a one-person engineering team.
- Invent status. Anything marked verified here has a commit, a test, a CI run, or an HTTP response behind it.

## 2. Operating cadence

| When                      | What                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------- |
| Every release (`/ship`)   | Reconcile `TODOS.md` against the CHANGELOG — close what shipped, re-file what didn't. |
| Weekly (Mon)              | Run `npm run metrics:weekly`, update §5 runway, re-rank the board.                    |
| At each gate date         | Write a pass/fail line in §7. A missed gate gets a written cause, not a slip.         |
| On any new QA/review pass | File findings into the board with a workstream tag, not just into `TODOS.md`.         |

## 3. The scoreboard this program serves

From `docs/win-plan-eoy2026.md` §6. Five proofs, not revenue:

1. **WTP is real** — ≥5 schools invoiced AND paid.
2. **Adoption is real** — ≥60% teacher weekly-active, founder absent.
3. **Channel is real** — ≥2 schools by referral.
4. **Founder is free** — ≤1 school-day/week support.
5. **Cash survives** — infra ≤ credits; SISFS filed.

Everything on the board below must trace to one of these. Work that traces to none is on the frozen list (§9).

## 4. Runway (as of 2026-08-17, Monday)

| Milestone                                              | Date       | Distance                                |
| ------------------------------------------------------ | ---------- | --------------------------------------- |
| First invoice **paid** (money moved)                   | 2026-08-14 | **3 days past — status unknown to PMO** |
| 30-school-day streak must **start**                    | 2026-09-08 | 22 days / 16 weekdays                   |
| Adoption read (≥60% teachers, ≥4 days, founder absent) | 2026-09-30 | 44 days / 32 weekdays                   |
| School #2 signed                                       | 2026-10-31 | 75 days / 54 weekdays                   |
| EOY scoreboard                                         | 2026-12-31 | 136 days / 98 weekdays                  |

**16 weekdays** is the real budget. Everything in §6 is sized against that number.

## 5. Open decisions blocking the PMO (need a human answer)

| #   | Question                                                                                    | What it unblocks                                                                  |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| D1  | Did a school pay or sign by 2026-08-14? (Branch A = paid, Branch B = not paid)              | Roughly a third of `TODOS.md` is explicitly payment-gated. Branch B stops it all. |
| D2  | Is a real pilot school onboarded on production today, and is `PILOT_SCHOOL_CODE` set there? | Whether the Sep-30 adoption gate can be measured at all.                          |
| D3  | Mobile/accessibility floor — unblock now or keep gated?                                     | `TODOS.md` records this gating as "an accident of drafting, not a decision".      |
| D4  | Is `docs/BETA_LAUNCH_PLAN.md` live or superseded by the wedge-first plan?                   | Two plans currently describe the launch. Only one can be the schedule.            |

## 6. Program board

Ranked by whether it blocks a dated gate. **WS-0 blocks everything.**

### WS-0 — Production cannot onboard a school (BLOCKER)

| Item                                                | Evidence                                                                                                                                                                                                                                              | Status           |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Signup email dead in production (#322) — **ops half**   | Production still holds an invalid Resend key. Rotate → `SMTP_PASS` in Secret Manager → redeploy → re-test signup on prod. **Only the founder can do this**; it needs credential access. Open **38 days**. | OPEN P0, founder |
| Email failures are silent (#322) — **engineering half** | DONE 2026-08-17. One `deliver()` path logs at error level with mail type + recipient and throws `EmailDeliveryError`; signup returns `verificationEmailSent`, resend returns 502 not 401, `/verify-email` stops claiming a dispatch that didn't happen. 12 regression cases. | SHIPPED          |
| At-risk cron crashes every run (#324.1)             | `column "workspace_id" does not exist` — schema drift, unhandledRejection in prod.                                                                                                                                                                    | OPEN             |
| `GET /api/chat/dms` → 404 (#324.2)                  | Client calls an endpoint prod does not have.                                                                                                                                                                                                          | OPEN             |
| Fabricated header badges (#324.3)                   | Minutes-old account shows "Messages 3, Notifications 5". Violates the honesty invariant.                                                                                                                                                              | OPEN             |
| Attendance copy over-promises WhatsApp (#324.6)     | Copy claims automatic parent alerts while the pipe is deliberately off.                                                                                                                                                                               | OPEN             |
| CSP blocks `blob:` worker / `data:` font (#324.4/5) | Console errors on every page.                                                                                                                                                                                                                         | OPEN             |

> A paid pilot cannot be onboarded through the front door until the key is rotated. The engineering half landed on 2026-08-17 — the failure is now loud in logs and honest on screen — but **loud is not working**. Until the key is replaced in production, the new banner simply tells a school the truth: no code was sent.

### WS-1 — Wedge integrity (the register must not lie)

Of the seven P0 gaps from the 2026-08-11 `/autoplan`, **three closed in v1.9.4.0** and `TODOS.md` has not been updated to say so:

- ✅ Blank editable register on read failure — fixed (register locks, retry prompt).
- ✅ Save count reported submitted-not-written — fixed (server's written count).
- ✅ Adoption denominator contaminated — mitigated via `PILOT_SCHOOL_CODE` cohort scoping.
- ⚠️ **Partly** — `pgGetAttendanceByClassDate` now rethrows (verified at `server/lib/db/pg-queries.ts:2790`), but **38 `return []` sites remain** in the same file. The class of bug is not closed, only its worst instance.
- ❌ Metric semantics frozen + metric-version stamp — no `metric_version` anywhere in `scripts/metrics-weekly.ts`.
- ❌ Repair/invalidate already-persisted partial snapshots — no evidence of work.
- ❌ Versioned migration ledger — `server/db-pg.ts` still re-applies one idempotent schema file; no migrations table.

### WS-2 — Measurement readiness (Sep 8 / Sep 30 gates)

- Set and verify `PILOT_SCHOOL_CODE` in the production environment (blocked on D2).
- Freeze metric semantics **before** the streak starts: cohort, timezone, week boundary, adjacency, baseline, partial-week. Changing these after Sep 8 rewrites the experiment while it runs.
- `schools.is_synthetic` — replace the `LIKE 'E2E%'` heuristic, via expand/backfill/contract, not a naive `ADD COLUMN` (which recreates the same false-positive and re-runs it every deploy).
- Weekly metrics correctness nits: week-adjacency check, mid-week partial snapshots, UTC vs IST week windows.

### WS-3 — Test and CI trust

- **Vitest flake ~1 in 3**, confirmed empirically across the v1.9.2.0 ship. The accepted gate is a 10–15 run burn-in at zero failures, not "5 greens".
- No real-Postgres unit lane — export tests mock the whole data layer, so broken SQL and schema drift cannot be caught (this is exactly how #324.1 reached production).
- No client test infra at all (`vitest.config.ts` is server-only, node env).
- No mobile Playwright project (desktop Chromium only).
- `server/tests/setup.ts:54` manufactures empty mocks for unexpected helper calls — should throw.

### WS-4 — Mobile & accessibility floor

Teachers mark the register on phones. Currently: 64px dead sidebar gutter on a 360px viewport (18% of screen), touch targets at 24–40px against a 44px floor, two `fixed` floating controls colliding with the mobile bottom nav and with each other. Same bug class as the quest-panel defect that made the register unusable in v1.9.3.0 — that one was found by QA, in production code, on the wedge workflow.

### WS-5 — Dependency & security hygiene

- **13 open Dependabot PRs**, oldest 2026-08-09. Checks are green on the ones sampled. Several are majors (`ioredis` 6, `google-auth-library` 11, `azurerm` 5, `pg`) and need reading, not bulk-merging.
- `image-size` audit allowlist (2 advisories, no patched release exists) — re-check periodically, delete when one lands.
- Determine whether untrusted image bytes can reach `generatePPTX` (decides whether the allowlist is safe or a live hole).
- CodeQL now passing on schedule; #272/#300 (code scanning enablement, Trivy CRITICAL triage) still open.

### WS-6 — Register hygiene (PMO's own first task)

**DONE 2026-08-17.** `TODOS.md` was stale by one release: all seven /autoplan P0s still read as open when v1.9.4.0 had closed three and partly closed a fourth. Reconciled against the code, not the changelog — each verdict carries the file and line that proves it. The `[~]` marker now distinguishes "partly done" from "done", which is what let the read-failure item look closed when 38 sibling sites remain. Cadence in §2 exists so this does not recur.

## 7. Gate log

| Date       | Gate               | Result                |
| ---------- | ------------------ | --------------------- |
| 2026-08-14 | First invoice paid | _unrecorded — see D1_ |
| 2026-09-08 | Streak must start  | pending               |
| 2026-09-30 | Adoption read      | pending               |
| 2026-10-31 | School #2 signed   | pending               |

## 8. Critical path to 2026-09-08 (16 weekdays)

1. ~~**#322 fail-loud email (engineering)**~~ — **done 2026-08-17.** Now blocked on the founder rotating the production Resend key; nothing else matters until a school can sign up. (WS-0)
2. **#324.1 at-risk cron crash** — an unhandled rejection loop in prod during a pilot is a credibility event. (WS-0)
3. **Honesty defects** — fabricated badges, WhatsApp copy. A principal who catches the product lying once will not trust the term report. (WS-0)
4. **`PILOT_SCHOOL_CODE` set + metric semantics frozen** — must be done _before_ day 1 of the streak, not after. (WS-2)
5. **Mobile floor on the register only** — the phone is the device. Not the whole app; the register. (WS-4)

Everything else waits. WS-3 and WS-5 are real debt but they do not move a September gate.

## 9. Frozen — do not start (and why)

- **Study Arena, all of it.** Decision at the 2026-08-11 gate: separate option, Phase A, dark in production. It is no longer "the moat".
- **Study Arena end-to-end QA.** Blocked on a valid AI key **four times** (07-22, 07-31, 08-06, 08-11). `GOOGLE_API_KEY` has an `AQ.A…` prefix; AI Studio issues `AIza…`. One valid key permanently unblocks it — but per the freeze, it is not on the critical path.
- **Coded term report, CSV streaming, admin school selector, vernacular pass** — payment-gated or blocked on an unnamed owner/decision.
- **Never-build list** (constitution): no foundation-model training, no standalone AI tutor, no "our AI is smarter", no single-provider coupling, no fabricated data shown to real accounts.
