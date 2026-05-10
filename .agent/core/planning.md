# Planning

## Methodology

We follow the **Fluent Agentic Workflow (FAW)** — see `fluent-workflow.md`. Planning is Phase 2 of the 5-phase loop. This doc covers the SPECIFY + PLAN phases.

## When to Plan

- **New features** (any feature with 3+ tasks) — always plan
- **Bug fixes** — no formal plan needed; document root cause in commit message
- **Refactoring** — plan if touching 5+ files or changing architecture
- **Infrastructure changes** — always plan (Docker, K8s, CI/CD, Terraform)

## Planning Template

### 1. Requirements (`requirements.md`)

```
# Feature: {Name}
- Goal: {single sentence}
- Stakeholders: {roles affected}
- Acceptance Criteria:
  - [ ] {criterion 1}
  - [ ] {criterion 2}
- Out of scope: {what we're NOT doing}
```

### 2. Design (`design.md`)

```
# Design: {Name}
## Data Model
- {new/updated schemas}

## API Contract
- {endpoints, methods, request/response shapes}

## Component Tree
- {new components and their relationships}

## State Management
- {loading, empty, error, edge cases}
```

### 3. Tasks (`tasks.md`)

```
# Tasks: {Name}
## Phase 1: {area}
- [ ] {task description}
- [ ] {task description}

## Phase 2: {area}
- [ ] {task description}
```

## Task Breakdown Rules

- Each task should be completable in a single session (15-60 minutes)
- Tasks should be testable independently
- Order tasks by dependency (backend → frontend, core → polish)
- Mark completion status with ✅ / 🔄 / ❌

## When NOT to Plan

- Trivial changes (single file, < 20 lines)
- Dependency updates
- Documentation typo fixes
