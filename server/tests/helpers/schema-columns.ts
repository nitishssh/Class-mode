import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Static schema-drift guard for hand-written SQL.
 *
 * Why this exists (#324.1): `scheduleAtRiskChecks` ran
 * `SELECT id, workspace_id FROM users` in production for weeks. `users` has no
 * `workspace_id` — membership lives in `workspace_memberships` — so the hourly
 * cron died with an unhandledRejection on every single run and at-risk
 * detection was silently dead. Every unit test passed the whole time, because
 * the pg pool is mocked in tests and a mock never validates SQL.
 *
 * There is no real-Postgres unit lane yet (tracked as P1 in TODOS.md). Until
 * there is, this parses `scripts/pg-schema.sql` and checks that the column
 * references in a query — qualified or bare — name columns that actually exist
 * on the table they belong to. It is a static check, not a database: it catches
 * the drift class that caused #324.1, not arbitrary SQL errors.
 */

const SCHEMA_PATH = path.resolve(process.cwd(), "scripts/pg-schema.sql");

/** Words that can follow a table name but are not an alias. */
const NOT_AN_ALIAS = new Set([
  "on",
  "using",
  "where",
  "join",
  "inner",
  "left",
  "right",
  "full",
  "cross",
  "group",
  "order",
  "limit",
  "offset",
  "having",
  "set",
  "as",
  "and",
  "or",
]);

/** Reserved words that start a column definition line but aren't columns. */
const NOT_A_COLUMN = new Set(["primary", "unique", "check", "foreign", "constraint", "exclude"]);

/**
 * SQL keywords and bare literals that scan as identifiers. Only consulted for
 * unqualified column checking; function names are excluded separately by the
 * trailing-paren rule, so `now`, `count` and friends need no entry here.
 */
const SQL_WORDS = new Set([
  "select",
  "distinct",
  "from",
  "where",
  "and",
  "or",
  "not",
  "null",
  "is",
  "in",
  "like",
  "ilike",
  "similar",
  "between",
  "as",
  "on",
  "using",
  "join",
  "left",
  "right",
  "inner",
  "outer",
  "full",
  "cross",
  "lateral",
  "natural",
  "group",
  "by",
  "order",
  "asc",
  "desc",
  "nulls",
  "first",
  "last",
  "limit",
  "offset",
  "fetch",
  "next",
  "rows",
  "only",
  "having",
  "window",
  "over",
  "partition",
  "case",
  "when",
  "then",
  "else",
  "end",
  "exists",
  "union",
  "intersect",
  "except",
  "all",
  "any",
  "some",
  "with",
  "recursive",
  "returning",
  "insert",
  "into",
  "values",
  "update",
  "set",
  "delete",
  "conflict",
  "do",
  "nothing",
  "true",
  "false",
  "unknown",
  "interval",
  "current_date",
  "current_time",
  "current_timestamp",
  "localtime",
  "localtimestamp",
  "filter",
  "within",
  "escape",
  "collate",
  "at",
  "time",
  "zone",
  "numeric",
  "int",
  "integer",
  "bigint",
  "text",
  "boolean",
  "date",
  "timestamp",
  "timestamptz",
  "jsonb",
  "json",
  "uuid",
  "decimal",
  "real",
  "float",
  "varchar",
  "char",
  "day",
  "days",
  "hour",
  "hours",
  "minute",
  "minutes",
  "second",
  "seconds",
  "month",
  "year",
]);

let cached: Map<string, Set<string>> | null = null;

/**
 * table name -> column names, from CREATE TABLE bodies plus every later
 * `ALTER TABLE ... ADD COLUMN`. The schema file leans on ALTER for columns
 * added after a table's original definition, so ignoring those would report
 * real columns as missing.
 */
export function loadSchemaColumns(): Map<string, Set<string>> {
  if (cached) return cached;

  const sql = readFileSync(SCHEMA_PATH, "utf8");
  const tables = new Map<string, Set<string>>();

  const createRe = /CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\n\);/g;
  for (const match of sql.matchAll(createRe)) {
    const [, table, body] = match;
    const columns = new Set<string>();
    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      const columnMatch = /^([a-z_][a-z0-9_]*)\s+/.exec(line);
      if (columnMatch && !NOT_A_COLUMN.has(columnMatch[1].toLowerCase())) {
        columns.add(columnMatch[1]);
      }
    }
    tables.set(table, columns);
  }

  const alterRe = /ALTER TABLE (\w+)\s+ADD COLUMN (?:IF NOT EXISTS )?(\w+)/g;
  for (const [, table, column] of sql.matchAll(alterRe)) {
    if (!tables.has(table)) tables.set(table, new Set());
    tables.get(table)!.add(column);
  }

  cached = tables;
  return tables;
}

/** alias (or bare table name) -> table, from the FROM and JOIN clauses. */
function resolveAliases(sql: string): Map<string, string> {
  const aliases = new Map<string, string>();
  const re = /\b(?:FROM|JOIN)\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi;

  for (const match of sql.matchAll(re)) {
    const table = match[1];
    const candidate = match[2];
    aliases.set(table, table);
    if (candidate && !NOT_AN_ALIAS.has(candidate.toLowerCase())) {
      aliases.set(candidate, table);
    }
  }
  return aliases;
}

export interface UnknownColumnRef {
  /** As written in the SQL, e.g. "u.workspace_id". */
  ref: string;
  table: string;
  column: string;
}

/** Replace string literals with blanks so their contents never scan as identifiers. */
function stripLiterals(sql: string): string {
  return sql.replace(/'(?:[^']|'')*'/g, (match) => " ".repeat(match.length));
}

/**
 * Returns every column reference in `sql` that does not exist on the table it
 * belongs to.
 *
 * Two forms are checked:
 *
 * 1. `alias.column`, whenever the alias resolves to a table in the schema file.
 * 2. bare `column`, but only when exactly one table is in scope and the query
 *    has no CTE or subquery to confuse attribution. #324.1's actual SQL was
 *    `SELECT id, workspace_id FROM users` — entirely unqualified — so a guard
 *    that only understood form 1 would have sailed straight past the bug it
 *    exists to catch.
 *
 * References we cannot attribute (unresolved alias, multi-table query with
 * bare columns, a table absent from the schema file) are skipped rather than
 * reported. This must fail on drift, not on SQL it does not understand.
 */
export function findUnknownColumnRefs(sql: string): UnknownColumnRef[] {
  const schema = loadSchemaColumns();
  const cleaned = stripLiterals(sql);
  const aliases = resolveAliases(cleaned);
  const unknown: UnknownColumnRef[] = [];
  const seen = new Set<string>();

  const report = (ref: string, table: string, column: string) => {
    if (seen.has(ref)) return;
    seen.add(ref);
    unknown.push({ ref, table, column });
  };

  const qualified = new RegExp("\\b([a-z_][a-z0-9_]*)\\.([a-z_][a-z0-9_]*)\\b", "gi");
  for (const [, alias, column] of cleaned.matchAll(qualified)) {
    const table = aliases.get(alias);
    if (!table) continue;
    const columns = schema.get(table);
    if (!columns || columns.has(column)) continue;
    report(`${alias}.${column}`, table, column);
  }

  const tables = new Set(aliases.values());
  const hasSubquery = /\(\s*select\b/i.test(cleaned) || /\bwith\b/i.test(cleaned);
  if (tables.size !== 1 || hasSubquery) return unknown;

  const [table] = tables;
  const columns = schema.get(table);
  if (!columns) return unknown;

  // Bare identifiers: skip anything qualified (preceded by a dot), anything
  // that is a function call (followed by a paren), a cast target, or a keyword.
  const bare = new RegExp("(\\.)?\\b([a-z_][a-z0-9_]*)\\b\\s*(\\()?", "gi");
  for (const match of cleaned.matchAll(bare)) {
    const [, dotted, identifier, paren] = match;
    if (dotted || paren) continue;

    const lower = identifier.toLowerCase();
    if (SQL_WORDS.has(lower) || aliases.has(identifier)) continue;
    if (cleaned[match.index - 1] === ":") continue;
    if (columns.has(identifier)) continue;

    report(identifier, table, identifier);
  }

  return unknown;
}
