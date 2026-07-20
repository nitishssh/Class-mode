# W29 Sprint Board — 13–19 Jul 2026 (plan day 0–5)

**One job this week: walk out of the pilot school with a written answer.**
Live boards: **GitHub Project** https://github.com/users/NitishKumar-ai/projects/10 (issues #330–#341, milestone "W29") · claude.ai artifact "Class-mode — Week 29 Register". GitHub is the tracking source of truth now — close issues as you go; this file + the Friday commit are the weekly snapshot.

**Deadline clock:** WTP first attempt **Fri Jul 17** · day-14 preconditions Jul 29 · day-30 fail line Aug 14 · day-40 checkpoint ~Aug 24 · streak must start Sep 8.
**Baseline (prod, W29):** attendance 0 · active teachers 0 · fees 0 · accounts 14/0/3 · 2 live bugs queued. Zeros stay zeros.

## Demand — the school (CEO hat, ~50%)

- [ ] **S1 (P0)** Call the principal, book the visit — DoD: date+time on calendar, before Friday — _SLIPPED Thu 16 Jul; must happen Fri morning, visit itself is the Friday deadline_
- [x] **S2 (P0)** Draft the one-page paid-pilot offer — DoD: ₹20/student/mo, term, manual-vs-automated stated, signature line, printed — _done 16 Jul: `docs/dashboard/pilot-offer.md` + one-page A4 PDF ready to print_
- [ ] **S3 (P0)** Workflow audit at the school (1 hr) — DoD: paper-vs-app map; register's actual marks; what school pays today; who signs
- [ ] **S4 (P0)** The ask: WTP close attempt, offer on the table — DoD: verbatim written answer + named signer, same day
- [ ] **S5 (P1)** List 3–5 candidate schools for the parallel test — DoD: names + intro paths in the playbook file

## Build — the product (CTO hat, ~30%)

- [ ] **B1 (P0)** Fix fabricated WhatsApp toast on attendance page — DoD: no automation claims in UI copy; test updated; deployed + health check verified — _before the visit_ — _16 Jul: fixed + e2e green on `w29-build-merge`; DEPLOY PENDING_
- [ ] **B2 (P1)** Fix NULL school*code on admin attendance writes — DoD: regression test green (8e3d2b8 pattern); deployed — \_16 Jul: root-caused (admin stamped own null school), fail-closed fix + 4-test regression suite green on `w29-build-merge`; DEPLOY PENDING*
- [ ] **B3 (P1)** Wire attendance*view / report_view usage events — DoD: feature_usage rows from real navigation — \_16 Jul: POST /api/usage + client wiring done, rows verified from real e2e navigation on `w29-build-merge`; DEPLOY PENDING*
- [ ] **B4 (P2)** Push dashboard commit + verify rollout — DoD: CD green AND health check flipped — _16 Jul: superseded by `w29-build-merge` (B1+B2+B3, 429 unit + 17 e2e green) — one push deploys everything_

## Ops — the company (COO hat, ~20%)

- [ ] **O1 (P1)** Apply: Microsoft for Startups Founders Hub — DoD: submitted ($1K Azure credits → pays the prod bill)
- [ ] **O2 (P2)** Entity + DPIIT paperwork: start the checklist — DoD: entity type decided; document list written
- [ ] **O3 (P2)** Friday ritual: update this file + dashboard, commit — DoD: statuses ticked; W29 report narrative final

## Risk register

- **TD1 open:** pilot school's language unnamed — vernacular work blocked on one word.
- **Zero teachers in prod:** the audit may reveal onboarding, not features, as problem #1.
- **Gemini free-tier quota:** don't demo AI generation as reliable until billing linked.
- **Solo bandwidth rule:** if anything slips, it's B3/O2 — never S1–S4.

## Definition of a won week

Visit happened with a written answer + named signer · both honesty bugs live-fixed before a teacher saw that screen · Founders Hub submitted · Friday register updated even if the news is bad — silence is the only failure.
