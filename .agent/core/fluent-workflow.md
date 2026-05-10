# Fluent Agentic Workflow (FAW)

A self-correcting, backpressure-driven workflow for production-grade feature development. Designed for the EduAI monorepo based on 2026 agentic design patterns.

## Core Loop

```
┌─────────────────────────────────────────────────────────┐
│                    FLUENT AGENTIC LOOP                    │
│                                                         │
│  ┌─────────┐   ┌──────────┐   ┌─────────┐   ┌────────┐ │
│  │ SPECIFY │──▶│  PLAN    │──▶│ EXECUTE │──▶│ VERIFY │ │
│  └─────────┘   └──────────┘   └─────────┘   └───┬────┘ │
│       ▲                                          │      │
│       │     ┌────────────┐     ┌──────────┐      │      │
│       └─────│  REVIEW    │◀────│ ITERATE  │◀─────┘      │
│             └────────────┘     └──────────┘             │
└─────────────────────────────────────────────────────────┘
```

Each phase runs autonomously. State lives on disk, not in context. Each iteration starts fresh.

---

## Phase 1: SPECIFY

**Purpose:** Define what success looks like before writing code.

### When to use
- New features (3+ tasks)
- Architecture changes (5+ files)
- API contract changes

### Format

Create `.agent/memory/roadmap/{feature-name}/` with:

**`requirements.md`**
```md
# Feature: {Name}
Goal: {single sentence}
Stakeholders: {roles affected}
Acceptance Criteria:
- [ ] {criterion 1}  # Must be machine-verifiable (test, type, lint)
- [ ] {criterion 2}
Out of scope: {what we're NOT doing}
Dependencies: {related features or PRs}
```

**`design.md`**
```md
# Design: {Name}
## Data Model
- {new/updated Zod schemas in shared/}

## API Contract
- {endpoint, method, request/response shape}

## Component Tree
- {new components and their data flow}

## State Machine
- {loading → empty → error → success transitions}
- {role-based access guards}
```

**`tasks.md`**
```md
# Tasks: {Name}
Backpressure: npm run check && npm run lint && npm test && npm run build

## Phase 1: {dependency-first area}
- [ ] {task}  # Estimated: {time}, Verifies: {test/type/lint}
```
Rules:
- Tasks must be completable in 1 session (15-60 min)
- Each task must have a machine-verifiable completion signal
- Order by dependency graph, not priority

### For bug fixes (skip SPECIFY)
Write a concise commit message with root cause analysis instead.

---

## Phase 2: PLAN

**Purpose:** Single pass to decompose, no over-planning.

The agent reads `requirements.md` + `design.md` and produces `IMPLEMENTATION_PLAN.md`:

```md
# Implementation Plan
## Task Queue (priority order)
1. {task} → {files to touch} → {verification}
2. {task} → {files to touch} → {verification}
## Risk Areas
- {areas where things might go wrong}
```

**Rules:**
- Plan is **disposable** — regenerate if stale
- No code written in this phase
- Plan lives on disk (not in context)
- Max 10 minutes on planning for small features

---

## Phase 3: EXECUTE (The Autonomous Loop)

**Purpose:** One task at a time, verified before moving on.

```
┌──────────────────────────────────────────────┐
│           EXECUTE LOOP (per task)             │
│                                              │
│  ┌──────────┐   ┌─────────┐   ┌───────────┐ │
│  │  READ    │──▶│  EDIT   │──▶│  VERIFY   │ │
│  │  context │   │  files  │   │  locally  │ │
│  └──────────┘   └─────────┘   └─────┬─────┘ │
│       ▲                             │       │
│       └─────────────────────────────┘       │
│           FAIL → back to EDIT               │
└──────────────────────────────────────────────┘
```

### Per-task steps:

1. **READ** — Read current task from `IMPLEMENTATION_PLAN.md`, scan relevant files
2. **GATHER** — Run `git diff` + `git status` to understand current state
3. **EDIT** — Implement the change (single task only)
4. **VERIFY (local backpressure):**
   ```
   npm run check      # TypeScript check — MUST pass
   npm run lint       # ESLint — MUST pass
   npm run format:check  # Prettier — MUST pass
   npm test           # Unit tests — MUST pass
   ```
5. **FAIL?** — Read errors, diagnose, return to EDIT (max 3 retries per task)
6. **PASS?** — Mark task done in `IMPLEMENTATION_PLAN.md`, move to next task

### Backpressure chain
```
TypeScript errors  ──▶  block (fix types)
       │
ESLint warnings    ──▶  block (fix lint)
       │
Formatting issues  ──▶  block (run format)
       │
Test failures      ──▶  block (fix tests)
       │
Build failures     ──▶  block (fix build)
       │
      ✅  PASS
```

### Exit conditions
- All tasks complete and verified → Phase 4
- 3 consecutive task failures → STOP (flag for human review)
- Max iterations exceeded → STOP (flag for human review)

---

## Phase 4: VERIFY (Full Integration)

**Purpose:** Ensure the whole system still works, not just individual pieces.

```
npm run check          # Full type check
npm run lint           # Full lint
npm run format:check   # Full format check
npm test               # Full test suite
npm run build          # Full production build
```

**If anything fails:** Diagnose → fix → re-run full verification (max 2 cycles).

---

## Phase 5: REVIEW

**Purpose:** Human-in-the-loop at the merge point, not at every step.

### Create a review summary:
```md
## Summary
- Feature: {name}
- Tasks completed: {N}/{M}
- Files changed: {list}
- Verification: ✅ check | ✅ lint | ✅ test | ✅ build

## What was done
1. {brief description of change}
2. {brief description of change}

## What to watch
- {potential concerns for reviewer}
- {edge cases not covered}

## Test evidence
- {test output summary}
```

### Rules
- Human must approve before merge
- Review is **holistic** — look at the whole diff, not incremental steps
- Never skip Phase 4 before review

---

## Workflow Selection Guide

```
Task Type                    │ Workflow
─────────────────────────────┼─────────────────────────────────────
Bug fix (1-2 files)          │ EXECUTE → VERIFY → REVIEW
                              │   (skip SPECIFY + PLAN)
                              │
Small feature (1-3 files)    │ PLAN → EXECUTE → VERIFY → REVIEW
                              │   (lightweight PLAN, skip full SPECIFY)
                              │
Large feature (5+ files)     │ SPECIFY → PLAN → EXECUTE → VERIFY → REVIEW
                              │   (full 5-phase workflow)
                              │
Architecture change          │ SPECIFY → PLAN → VERIFY(on empty) → 
                              │   EXECUTE → VERIFY → REVIEW
                              │   (validate design before writing code)
                              │
Refactoring (10+ files)      │ SPECIFY → PLAN → EXECUTE(per-module) → 
                              │   VERIFY → REVIEW
                              │   (one module at a time, verify each)
                              │
Dependency update            │ EXECUTE → VERIFY → REVIEW
                              │   (update, check, verify)
                              │
Emergency fix                │ EXECUTE → VERIFY → REVIEW
                              │   (document root cause in commit)
```

---

## Context Freshness Rules

1. **Each EXECUTE loop iteration gets a fresh context** — close and restart between tasks
2. **State lives on disk** — `IMPLEMENTATION_PLAN.md`, `STATUS.md`, file system
3. **AGENTS.md is the single source of truth** for build/test/lint commands
4. **Never carry context across iterations** — always re-read from disk

## Cost Guardrails

| Guard | Limit | Action |
|-------|-------|--------|
| Retries per task | 3 | After 3 failures, flag for human |
| Backpressure commands | 5s each | If command hangs, kill and retry |
| Concurrent tasks | 1 | Serial execution per phase |
| Plan freshness | 2 sessions | Regenerate plan if stale |

## Failure Recovery

```
Failure Type              │ Recovery
─────────────────────────┼─────────────────────────────────────
TypeScript error          │ Fix type, re-run check
Test failure              │ Read error → fix code → re-run test
ESLint error              │ Read rule → fix code → re-run lint
Build failure             │ Read build log → fix → re-build
Context exhaustion        │ Save state to disk → restart with fresh context
Loop detected             │ Stop after 3 same-task retries → human review
Tool failure (npm, git)   │ Retry with fresh shell → escalate if persists
```
