# ClassMode Platform Contract

## Brand glossary

- **ClassMode** is the master school platform and public brand.
- **ClassMode Studio** is the teacher authoring and lesson-preview application.
- **ClassMode AI** is the private generation, orchestration, media, and agent service.
- **ClassMode Mobile** is the native role-based companion.
- **Thinking Ledger** is the shared experience grammar: attempt, bounded help, transfer evidence, recall, and teacher action.

Legacy names remain only in attribution, database identifiers, compatibility imports, and migration documentation. They must not appear as current product names in user-visible copy.

## Ownership boundary

| Concern                                      | Authority                                   |
| -------------------------------------------- | ------------------------------------------- |
| Identity, roles, sessions, workspaces        | ClassMode backend                           |
| Classes, assignments, billing                | ClassMode backend                           |
| Attempts, assessments, evidence, mastery     | ClassMode backend via `commitLearnerUpdate` |
| Provider routing and generation jobs         | ClassMode AI                                |
| Materials, scenes, media, authoring sessions | ClassMode AI                                |
| Web and mobile authorization                 | ClassMode backend                           |

Web and mobile clients call `/api/classmode-ai/*` on the ClassMode backend. Only the backend calls ClassMode AI `/api/v1/*`, with `Authorization`, `x-classmode-workspace-id`, and `x-request-id` headers.

## Compatibility policy

- Existing OpenMAIC and Study Arena HTTP routes remain available during migration.
- Existing `@classmind/*` and upstream package identifiers remain compatibility surfaces until `@classmode/*` wrappers ship and usage telemetry reaches zero.
- Existing stored lesson documents and database names are never renamed in place.
- `CLASSMODE_AI_*` is the canonical service configuration. Legacy bridge variables may be read only as documented fallbacks.

## Rollout controls

Enable the service boundary per workspace. A rollback blocks new generation requests while preserving jobs, assignments, attempts, and evidence. ClassMode AI never writes learner mastery directly.

## Vertical slice

The teacher workflow at `/study-arena/create` uses the existing durable compiler job. Set
`CLASSMODE_AI_COMPILER_ENABLED=true` to delegate its generation stage to ClassMode AI. The backend
submits the source and objective with a workspace-scoped service credential, polls the versioned
job, and converts the returned presentation draft into ClassMode's gated lesson schema.

ClassMode AI never returns an answer key or mastery mutation. ClassMode adds attempt gates, selects
only registered server-owned transfer checks, validates the script, and persists a teacher-reviewable
draft. The existing approval and publish flow creates immutable enrollment. Web and Mobile learners
open only server-issued assignment sessions; gated attempts and assessment nonces continue through
the existing idempotent evidence and `commitLearnerUpdate` pipeline.
