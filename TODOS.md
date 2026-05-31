# TODOS

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
