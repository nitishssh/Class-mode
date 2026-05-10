# Memory Management

## Purpose

The `.agent/` directory serves as the agent's long-term memory — preserving context across sessions and enabling consistent decision-making.

## Structure

```
.agent/
├── core/              # Identity, principles, workflows (static)
│   ├── identity.md    # Who the agent is
│   ├── principles.md  # Coding constraints and guidelines
│   ├── workflows.md   # Standard operating procedures
│   ├── architecture.md # Project architecture reference
│   ├── planning.md    # Planning methodology
│   └── memory.md      # This file
├── memory/
│   ├── architecture/  # Architectural decision records
│   ├── decisions/     # ADRs and key technical decisions
│   ├── incidents/     # Postmortems and incident reports
│   ├── research/      # Research notes and evaluations
│   ├── roadmap/       # Feature plans (requirements, design, tasks)
│   └── sessions/      # Session status dashboard
├── hooks/             # Lifecycle automation (pre-commit, session-start)
├── agents/            # Specialized subagent definitions
├── skills/            # Auto-loadable skill instructions
├── commands/          # Slash commands
├── rules/             # Hard constraints and policies
├── templates/         # Reusable document scaffolds
├── plugins/           # External integrations
├── datasets/          # Structured local knowledge
├── evals/             # Agent evaluation framework
├── output-styles/     # Response formatting modes
├── orchestration/     # Multi-agent coordination
└── telemetry/         # Runtime logging and analytics
```

## Memory Rules

1. **Session start** — always read `memory/sessions/STATUS.md` to understand current state
2. **After significant work** — update `memory/sessions/STATUS.md` with new completion status
3. **Architecture decisions** — record in `memory/decisions/` with format: `YYYY-MM-DD-decision-title.md`
4. **Feature planning** — create roadmaps in `memory/roadmap/{feature-name}/`
5. **Incidents** — document in `memory/incidents/` with root cause, impact, and resolution
6. **Core files are static** — `core/*.md` should rarely change; they define persistent identity and rules

## STATUS.md Format

Kept at `memory/sessions/STATUS.md`:

- Active specifications and their completion status
- Top-level project structure reference
- Next steps (immediate and backlog)
- Important notes from recent sessions
