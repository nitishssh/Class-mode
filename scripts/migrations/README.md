# Versioned migrations

`scripts/pg-schema.sql` stays the baseline and still runs on every deploy. It is
idempotent by convention (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD
COLUMN IF NOT EXISTS`), and that convention covers most schema work — adding a
table or a nullable column needs nothing in this directory.

Put a file here only for a change the idempotent convention **cannot** express:

- a data backfill (running it twice is not the same as running it once)
- a destructive or narrowing change (dropping a column, tightening a constraint)
- anything that must be applied exactly once, in a known order

## Rules

- Name files `NNNN_short_description.sql`, zero-padded, applied in filename order.
- One file is executed as ONE statement batch inside an explicit transaction.
  Never split a file on semicolons: `pg-schema.sql` contains a `DO $$ ... $$`
  block with internal semicolons, and session-scoped settings like
  `SET maintenance_work_mem` must stay in the same session as the statements
  they affect.
- A file that has been applied to any deployed database is immutable. Fix a bad
  migration with a new one, never by editing history — the runner records a
  checksum and refuses to run if a recorded file changed.
- Prefer forward fixes to down migrations. There is deliberately no automatic
  rollback: reversing a data migration is a bespoke act, not a generic one.

## Before running against production

`npm run migrate` takes an advisory lock, so two concurrent deploys cannot race.
It does not take a backup. Take one first — see `manual-deploy.sh`.
