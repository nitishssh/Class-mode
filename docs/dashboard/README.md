# Class-mode Project Dashboard

Single page of truth for where the company is. Updated weekly (`npm run report:weekly`, ideally Friday). Honesty rule is constitutional: every number here is derived from real data or real task state — no aspirational percentages.

- **Production:** https://classmode.inmodel.in (Azure Container Apps; health check = post-deploy gate)
- **Plan of record:** the Sharpened Company 90-day plan (`~/.gstack/projects/NitishKumar-ai-Class-mode/` — design doc + CEO plan, /autoplan-cleared 2026-07-15)
- **Deferred work:** [TODOS.md](../../TODOS.md) · **Weekly reports:** [weekly/](weekly/) · **Metric snapshots:** [metrics/](metrics/) · **Programs pipeline:** [PROGRAMS.md](PROGRAMS.md)

## 90-day objectives (day 0 = 2026-07-15)

| #   | Objective                                                                                    | Deadline                                                                | Status                                           |
| --- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | WTP close attempt at pilot school (audit → term report + paid-pilot offer → ask + who-signs) | first attempt this week; hard fail line day 30 (escalation, not freeze) | 🔴 not started                                   |
| 1b  | Same offer at 3–5 additional schools (parallel demand test)                                  | weeks 2–6                                                               | 🔴 not started                                   |
| 2   | Wedge workflow = school's primary record, 30 consecutive school days unprompted              | primary-record by day ~40; streak started by day 55                     | ⚪ awaiting wedge audit                          |
| 3   | Dependence probe live: metrics weekly, definitions fixed, baseline captured                  | preconditions (usage events wired + Gemini billing) by day 14           | 🟡 script shipped; view-events + billing pending |
| 4   | Learning-record schema                                                                       | GATED on graduation trigger (payment or signed commitment)              | ⏸ gated                                          |

## Build workstreams (from the reviewed plan)

| Workstream                                                                                                                                         | Priority | Done                 | Status / next action                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------- | ----------------------------------------------------------------------- |
| Honesty fixes (fake WhatsApp toast; NULL school_code on admin writes)                                                                              | P1       | 0/2                  | Fix chips spawned — do first, they sit on the measured screen           |
| Paid-pilot offer page + buyer-mapping & price-anchor questions                                                                                     | P1       | 0%                   | Draft before the school visit                                           |
| `metrics:weekly` engine + snapshots                                                                                                                | P1       | **80%**              | Script + snapshots shipped; wire `attendance_view`/`report_view` events |
| Term report (full design+eng spec: hierarchy, thin-data denominators, A4 grayscale, bilingual, aggregate-only, fail-closed queries, hostile tests) | P1       | 0%                   | Build after wedge audit confirms data shape                             |
| Custody baseline (FKs off CASCADE, transactional corrections audit, tested restore, CSV export)                                                    | P1       | 0%                   | Schema ALTER first (idempotent pattern)                                 |
| Constitution + DECISIONS.md (incl. segment paragraph, amendment clause)                                                                            | P2       | 0%                   | Written the evening AFTER the WTP conversation — not before             |
| Vernacular pass (wire t(), locale, switcher, toasts/errors) — language: **TBD (TD1)**                                                              | P2       | 0%                   | Blocked on naming the pilot school's language                           |
| Attendance mobile-first reorder (remembered class, sticky save, 44px targets)                                                                      | P2       | 0%                   | Pairs with vernacular pass                                              |
| School #2 playbook + conversations                                                                                                                 | P2       | 0%                   | Written within a week of first WTP conversation                         |
| Offline-first attendance (E9 contract)                                                                                                             | GATED    | spec 100% / build 0% | Post-graduation-trigger by gate decision UC3                            |

## Feature behavior (from latest snapshot)

See the newest file in [metrics/](metrics/) and the table in the newest [weekly report](weekly/). Definitions and decision thresholds live in [`scripts/metrics-weekly.ts`](../../scripts/metrics-weekly.ts) so they can't drift silently. Known probe history: two AI-generation outages produced zero user complaints (both negative signals — nobody depends on AI features yet).

## Standing rules (don't re-litigate without a written reason)

- Moat = daily habit + earned trust + trustworthy custodianship. Never "our AI is smarter." Data is exportable on demand.
- Models are swappable suppliers behind `server/lib/ai/gateway.ts`.
- No fabricated data to real accounts, ever — including UI copy that claims automation that isn't running.
- WhatsApp/Meta automated pipe stays paused until WTP validated (manual, honestly-labeled previews allowed).
- Day-30 without a written WTP answer ⇒ build pauses, escalation only (real buyer → school #2).
