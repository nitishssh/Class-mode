## Useful Commands

### Development

- `npm run dev` - Start dev server (port 5001)
- `npm run check` - Type check
- `npm run migrate` - Apply DB schema from `scripts/pg-schema.sql` (idempotent; run on new or drifted databases)
- `npm run lint` - Lint
- `npm run format` - Format code
- `npm test` - Run unit/integration tests
- `npx playwright test` - Run E2E tests

### Weekly adoption metrics

- `npm run metrics:weekly` - Print this week's adoption numbers and persist a snapshot
- `npm run report:weekly` - Same, plus scaffold `docs/dashboard/weekly/<week>.md`
- `npx tsx scripts/metrics-weekly.ts --dry-run` - Print without persisting

**Always use `--dry-run` against a QA or local database.** A persisted snapshot
joins the trend permanently, and afterwards there is no way to tell which rows
produced it. The measurement rules are frozen and versioned in
`docs/METRIC-SEMANTICS.md` — changing one requires bumping `METRIC_VERSION`.

### Pilot School & Testing

- `npx tsx server/scripts/seed-pilot.ts` - Seed pilot school data
- `npx tsx scripts/simulate-pilot-school.ts` - Run pilot school AI simulation
- `npx tsx scripts/test-db.ts` - Test database connectivity

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:

- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

## Deploy Configuration (configured by /setup-deploy)

- Platform: GitHub Actions
- Production URL: https://classmode.inmodel.in
- Deploy workflow: .github/workflows/cd.yml
- Deploy status command: HTTP health check
- Merge method: squash
- Project type: web app
- Post-deploy health check: https://classmode.inmodel.in

### Custom deploy hooks

- Pre-merge: none
- Deploy trigger: automatic on push to main
- Deploy status: poll production URL
- Health check: https://classmode.inmodel.in

## Design System

The visual system is "Ruled Paper", specified at `OpenMAIC-main/DESIGN.md` (the
Class Mode Studio repo). It governs this app and Studio together: one system,
two surfaces. Read it before any visual or UI decision.

Palette tokens live in `client/src/index.css` and are mirrored by hand in
Studio's `app/globals.css`. Change one, change the other.

Three rules are load-bearing, not preferences:

1. **`--energy` #f0a500 (marigold)** means exactly one thing in Studio: the lesson
   has stopped and the student owns the next move. Do not spend it on badges or
   decoration here, or it stops meaning anything there.
2. **`--accent` #cc785c (terracotta)** is the student's colour: their answers,
   marks and progress. Never lesson decoration.
3. **True red is for institutional facts only** (absent, fees overdue). An
   unfinished thought is not an error; it uses `--not-yet`.

This app inherits the paper, margin rule and mono numerals. It does NOT inherit
Studio's slate gate inversion.

**Not yet ported:** the Literata + Anek typeface stack. Changing typefaces on a
live school product deserves its own verified change, not a drive-by.
