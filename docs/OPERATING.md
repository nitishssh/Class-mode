# Operating Rhythm — solo founder, run like a company

The cadence that keeps a one-person company honest. Everything here is designed to survive a bad week.

## Weekly loop

| When | Ritual | Output |
|------|--------|--------|
| **Monday (15 min)** | Pick ≤3 priorities from [docs/dashboard/README.md](dashboard/README.md); sanity-check against plan deadlines (day-14 preconditions, day-30 fail line, day-40 checkpoint) | This week's 3 lines in the weekly report draft |
| **Daily** | Build/school work per the time budget: ~50% school-facing / ~30% build / ~20% ops. Ops includes program applications ([PROGRAMS.md](dashboard/PROGRAMS.md)) | — |
| **Friday (30 min)** | `npm run report:weekly` → fill the narrative sections of `docs/dashboard/weekly/<week>.md`; update the dashboard status tables; commit | The weekly report — the investor update you write before having investors |
| **Friday (5 min)** | One program application step (or skip consciously — never silently) | PROGRAMS.md status tick |

## Rules that make it professional

1. **The report ships even on bad weeks.** A report that says "nothing moved, here's why" is a functioning company; silence is a hobby.
2. **Numbers come from the script, never from memory.** `metrics:weekly` definitions are code; zeros stay zeros.
3. **Decisions get written down** the day they're made (DECISIONS.md once the constitution exists; until then, the weekly report's Progress section).
4. **Deferred work goes to [TODOS.md](../TODOS.md)** with context, or it doesn't exist.
5. **Deploys are verified, not assumed:** CD "success" only submits the build — confirm the health check at https://classmode.inmodel.in flipped before calling it shipped.
6. **The calendar serves demand evidence.** Any week where 0% of time was school-facing gets called out in its own report.

## Where things live

- 90-day plan of record: `~/.gstack/projects/NitishKumar-ai-Class-mode/` (design doc + CEO plan)
- Dashboard: [docs/dashboard/README.md](dashboard/README.md) · Weekly reports: `docs/dashboard/weekly/` · Metric snapshots: `docs/dashboard/metrics/`
- Programs pipeline: [docs/dashboard/PROGRAMS.md](dashboard/PROGRAMS.md)
- Deferred register: [TODOS.md](../TODOS.md)
