# TODOS

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

... [rest of methods ...]

## Completed

### C-Suite Audit & Execution (30-day plan)

- [x] **Modular Domain Routing** — Decoupled monolithic `routes.ts` into 10 domain routers. **Completed:** v1.6.0 (2026-05-31)
- [x] **Persistent AI Jobs** — BullMQ integration for Tutor/WHITEBOARD state preservation. **Completed:** v1.6.0 (2026-05-31)
- [x] **Revenue Readiness** — End-to-end Stripe integration and AI quota enforcement. **Completed:** v1.6.0 (2026-05-31)
- [x] **Scheduling Engine** — Native period-based timetable with conflict detection. **Completed:** v1.6.0 (2026-05-31)
- [x] **WhatsApp Parent Nudges** — Automated background worker for student engagement. **Completed:** v1.6.0 (2026-05-31)
- [x] **Investor Demo Polish** — High-fidelity Demo Mode for Principal Dashboard. **Completed:** v1.6.0 (2026-05-31)

### TODO.1 — Verify AbortSignal SDK support

**What:** Before shipping the timeout, check if `@google/generative-ai` installed version forwards AbortSignal through its internal HTTP fetch calls.
**Why:** If the SDK ignores AbortSignal, our 30-second timeout is silent theater. Fallback: `Promise.race()` with a rejection timer (guaranteed to work regardless of SDK version).
**How to apply:** `npm ls @google/generative-ai` to get version. Check SDK release notes for AbortSignal support. If missing, implement `Promise.race([geminiCall(), rejectAfter(30_000)])`.
**Depends on:** Nothing. Check before implementing the timeout in `server/routes/test-generator.ts`.

---

### TODO.2 — CORS for coaching center embedding

**What:** Add CORS header to `POST /api/ai/generate-from-pdf` so coaching centers can embed the test generator widget on their own websites.
**Why:** v0 demo uses same-origin (classmode.inmodel.in), CORS not needed. If a coaching center asks "can I put this widget on my site?", 3 lines unlocks the use case.
**How to apply:** `res.header('Access-Control-Allow-Origin', 'https://coachingcenter.com')` or whitelist-based CORS. Wire in `server/routes/test-generator.ts` or index.ts CORS config.
**Depends on:** At least one coaching center owner requesting embedding during demo validation.

---

### TODO.3 — PDF download output

**What:** Add PDF download so teachers can download the generated MCQs as a formatted file (with answer key at the bottom).
**Why:** Design doc explicitly deferred this from v0. Copy-to-clipboard is the v0 output. Teachers who want to print or share the test via email will ask for this.
**How to apply:** jsPDF (client-side, no server changes) for simple formatting. If answer key formatting is complex, consider server-side PDFKit. Check if teachers want WhatsApp-shareable image instead.
**Depends on:** Demo feedback — do coaching center owners actually ask for a printed format?
