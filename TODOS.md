# TODOS

## Class Mode (product backlog)

### TODO.CM1 — Student workspace membership (DEFERRED 2026-06-22)

**What:** Make students first-class workspace members so they can access class chat
channels (Announcements / Doubts / Resources). Today students get only the role-gated
dashboard; `GET /api/workspaces` returns `[]` for them and the WorkspaceSwitcher is empty.
**Status:** DEFERRED via /autoplan premise gate (2026-06-22). Not building now.
**Why deferred:** The payoff is chat/channels, and there's no demand signal — no teacher
or student has asked for in-app chat, the dashboard works without it, and WhatsApp parent
nudges (v1.6.0) already cover parent/student comms. Building now risks unused plumbing +
new security surface on an unvalidated premise.
**Re-trigger:** Revisit when a pilot teacher/student actually asks for in-app class chat,
or a roadmap/demo commitment requires it.
**When picked up:** Recommended approach is School = Workspace, reuse the `member` role
(workspace:read only); create the workspace + cbse-school channels on school creation,
add `schools.workspace_id` FK, add workspace membership at invite-accept, plus an
idempotent backfill for existing students. Full plan archived at
`~/.gstack/projects/NitishKumar-ai-Class-mode/main-student-workspace-membership-plan.md`.
**Note:** The partial `kind:"student"` infra (server/routes/chat.ts:110 → role `member` +
`studentMeta`) already exists and stays intact for when this is built.
**Depends on:** Nothing. Demand-gated.

---

## CommitGuard / Meshwork (new project)

### TODO.CG1 — Define 5-user validation gate precisely

**What:** The design doc says "5 developers running CommitGuard on their own repos." This gate needs a precise definition to prevent it from slipping to "5 friends tried it once."
**Why:** Validation gates are the first thing that collapses under schedule pressure. An ambiguous gate = never triggered.
**Precise definition:** Gate = 5 distinct developers, each with 10+ PRs reviewed without errors, AND at least 1 user reports "CommitGuard caught something real" (verified by screenshot or PR comment link).
**Context:** Meshwork eng review (2026-06-02). The gate triggers framework extraction — too important to leave ambiguous.
**Depends on:** Nothing. Define this before starting v0.

---

### TODO.CG2 — Add Flash-Lite model fallback for demo resilience

**What:** CommitGuard v0 uses Flash-Lite as the only model for plan() and execute(). If Flash-Lite rate-limits or errors during a live demo or pitch, the entire review pipeline stops.
**Why:** A single model dependency = single point of failure. A 10-line fallback (try Flash-Lite → except RateLimitError → use Haiku 4.5) prevents demo death.
**How:** `commitguard/llm.py` — try Flash-Lite, catch rate limit and model unavailable errors, fall back to `claude-haiku-4-5-20251001`. Log the fallback so you know it happened.
**Context:** Surfaced by outside voice during Meshwork eng review (2026-06-02).
**Depends on:** T1 (types.py) and T3 (plan() function) from implementation tasks.

---

## Test Generator (v1 backlog)

---

## Completed

### C-Suite Audit & Execution (30-day plan)

- [x] **Modular Domain Routing** — Decoupled monolithic `routes.ts` into 10 domain routers. **Completed:** v1.6.0 (2026-05-31)
- [x] **Persistent AI Jobs** — BullMQ integration for Tutor/WHITEBOARD state preservation. **Completed:** v1.6.0 (2026-05-31)
- [x] **Revenue Readiness** — End-to-end Stripe integration and AI quota enforcement. **Completed:** v1.6.0 (2026-05-31)
- [x] **Scheduling Engine** — Native period-based timetable with conflict detection. **Completed:** v1.6.0 (2026-05-31)
- [x] **WhatsApp Parent Nudges** — Automated background worker for student engagement. **Completed:** v1.6.0 (2026-05-31)
- [x] **Investor Demo Polish** — High-fidelity Demo Mode for Principal Dashboard. **Completed:** v1.6.0 (2026-05-31)
- [x] **AbortSignal SDK support** — Verified and implemented AbortSignal forwarding in Gemini/OpenAI wrappers. **Completed:** v1.7.0 (2026-06-02)
- [x] **CORS for coaching centers** — Implemented `ALLOWED_PROD_DOMAINS` whitelist for cross-origin embedding. **Completed:** v1.7.0 (2026-06-02)
- [x] **PDF download output** — Added jsPDF-based test download functionality for MCQs and answer keys. **Completed:** v1.7.1 (2026-06-10)
- [x] **PDF → Test Generator** — Upload a PDF to auto-generate MCQ questions via Gemini AI. **Completed:** v1.7.1 (2026-06-10)
- [x] **Mass assignment protection** — `PUT /api/users/:id` blocked from role/password escalation via Zod schema. **Completed:** v1.7.1 (2026-06-10)
- [x] **Timetable camelCase API** — Timetable responses now use consistent camelCase field names. **Completed:** v1.7.1 (2026-06-10)
- [x] **Tenant isolation enforcement** — Cross-school user/class mutations now return 403 with audit events. **Completed:** v1.7.1 (2026-06-10)
