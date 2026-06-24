## Useful Commands

### Development
- `npm run dev` - Start dev server (port 5001)
- `npm run check` - Type check
- `npm run migrate` - Apply DB schema from `scripts/pg-schema.sql` (idempotent; run on new or drifted databases)
- `npm run lint` - Lint
- `npm run format` - Format code
- `npm test` - Run unit/integration tests
- `npx playwright test` - Run E2E tests

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
