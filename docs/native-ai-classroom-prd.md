# PRD: Native All-Subject AI Classroom

**Status:** Draft, revised after strategy review  
**Owner:** Class-mode  
**Reference:** [OpenMAIC](https://github.com/THU-MAIC/OpenMAIC), adapted conceptually under its MIT license. This is a native Class-mode product, not a fork or embedded upstream application.

## 1. Product decision

Class-mode will evolve Study Arena into a native, all-subject AI classroom. The destination is a structured, interactive lesson system with visual scenes, guided attempts, formative checks, and persistent learning evidence.

The first product is narrower: a teacher assigns one curriculum-grounded mastery activity to a class, students complete bounded attempt-first practice and independent transfer checks, and the teacher receives an actionable intervention group. This teacher-owned mastery loop must demonstrate repeat use, learning evidence, and willingness to pay before the platform expands into multi-agent scenes, simulation, and broad subject templates.

The system must not become a generic answer chatbot or a passive AI lecture player. Each instructional scene ends with a learner action or a deliberately configured assessment gate.

## 2. Problem

Students can ask a general AI tool to explain nearly any subject, but it has no durable course structure, learner model, curriculum context, proof of student effort, or teacher visibility. Rich AI presentations alone can improve engagement while still allowing cognitive offloading.

Teachers need a way to produce and assign interactive, curriculum-grounded learning experiences without manually creating slides, activities, and checks for understanding.

## 3. Target users

- **Students:** secondary-school learners across mathematics, science, language, social studies, and skills-based topics.
- **Teachers:** create, inspect, assign, and review interactive AI lessons tied to their class materials.
- **School leaders:** view aggregate evidence of completion, help depth, and concept-level mastery.

## 4. Success criteria

The first mastery-wedge pilot is successful when:

1. One pilot teacher assigns one curriculum-aligned unit to at least 20 enrolled students in one grade band.
2. At least 70% of assigned students complete the immediate independent transfer check; at least 50% complete the 72-hour recall check.
3. The teacher uses the intervention report in at least two class decisions and assigns a second activity without operator help.
4. Immediate and delayed transfer results are compared with a pre-specified non-AI baseline or matched prior activity; completion alone never counts as learning proof.
5. The system records attempt quality, formative result, hint depth, transfer result, assessment/evaluator version, and teacher follow-up, without requiring the teacher to inspect raw student transcripts.
6. The experience stays within the configured AI-cost budget per completed lesson, and teacher review plus assignment takes less time than the agreed incumbent workflow.

The wedge is stopped or redesigned if the teacher does not assign a second activity, fewer than 50% of assigned students reach the immediate transfer check, recall completion is below 30%, assessment disagreement exceeds the declared review threshold, or the activity costs more than the validated willingness-to-pay budget.

## 5. Product principles

1. **Attempt before assistance.** Student reasoning unlocks support; empty-answer progress is forbidden.
2. **Visuals serve reasoning.** Whiteboards, diagrams, simulations, and agent dialogue explain the next idea, not the final answer.
3. **One authoritative learner model.** A single Postgres writer commits mastery, scheduling, and interaction evidence.
4. **Teacher source material wins.** Approved class content constrains lesson generation whenever it is available.
5. **All subjects, typed actions.** A shared scene contract supports subject-specific renderers without turning each subject into a separate application.
6. **No hidden learning claims.** Engagement, correctness, and delayed recall are measured separately.
7. **Evidence before spectacle.** Assignment, source provenance, valid checks, and teacher action ship before optional visual or multi-agent breadth.

## 6. Core user journey

1. A teacher selects one approved unit, objective, grade level, and supported source input.
2. The compiler creates a bounded diagnostic-practice activity, with source spans, objectives, rubric, and independent transfer checks.
3. The teacher reviews the objective, generated checks, and source provenance, then assigns the version to one class or selected students.
4. A student opens the activity through the existing course/class context, completes attempt-first practice, and receives only the configured hint ladder.
5. The student completes an immediate no-AI transfer check and receives a scheduled delayed recall check.
6. The learner-model writer records immutable, scoped evidence and a report groups students by verified follow-up need.
7. The teacher uses the report to make an intervention decision, then can repeat the loop for the next objective.

## 7. Functional requirements

### 7.1 Lesson compiler

- Initially accept teacher-pasted text or one supported document type, grade/level, subject, objective, and language.
- Produce a validated `LessonScript` with concepts, scenes, actions, objective coverage, and assessment IDs.
- Generate an outline before expensive scene generation; teachers must approve the objective, source evidence, and assessment form before publication.
- Reject malformed, unsupported, unsafe, source-ungrounded, or assessment-answer-leaking output before publication.
- Generate asynchronously, report progress, support cancellation, and avoid duplicate jobs for the same request.

### 7.2 Typed scene runtime

The scene contract must support the following action families:

| Action       | Purpose                                              | Required learning control                                    |
| ------------ | ---------------------------------------------------- | ------------------------------------------------------------ |
| `speak`      | Short teacher, coach, or classmate explanation       | Must not reveal a gated answer                               |
| `showSlide`  | Text, images, and formula overview                   | Must be accessible and keyboard navigable                    |
| `write`      | Animated equation, text, or formula step             | Must render from validated structured data                   |
| `draw`       | Diagram, graph, timeline, map, or labelled structure | Must use a constrained renderer specification                |
| `highlight`  | Focus attention on a visual element                  | Must not replace a student explanation                       |
| `ask`        | Free-text, choice, or worked-response attempt        | Must gate progression after non-empty student effort         |
| `assessment` | Immediate or delayed no-AI transfer check            | Must disable AI hints and grade through a verified evaluator |
| `simulation` | Sandboxed interactive model or experiment            | Must have a declared learning objective and checkpoint       |

### 7.3 Subject coverage

- Mathematics: formula writing, graphs, algebraic transformations, numeric checks.
- Science: diagrams, labelled processes, graphs, variables, constrained simulations.
- Languages: reading passages, vocabulary retrieval, writing plans, oral/voice activities when enabled.
- Social studies: timelines, maps, source analysis, structured evidence prompts.
- Skills and vocational topics: procedures, decision trees, scenario practice, project checkpoints.

The first renderer set is deliberately constrained to text/formula writing, diagrams, highlighting, and quizzes for the selected wedge. Subject-specific templates are configuration and content work, not separate runtimes. Simulations are not part of the pilot until the mastery loop has passed its success criteria.

### 7.4 Multi-agent behavior

- **Teacher:** owns instructional explanation and asks the primary learning question.
- **Coach:** provides only the allowed graduated hint level and prompts reflection.
- **Classmate:** is deferred until a controlled comparison shows it improves comprehension or engagement without adding contradictory instruction.
- **Director:** selects the next allowed role and action from a bounded state machine.

The director cannot directly persist learner state, bypass assessment policy, or emit arbitrary client code. The existing learner-model single writer remains the only state mutator.

### 7.5 Teacher workflows

- Create an activity from approved material for the selected curriculum objective.
- Edit objective, concept, scene, prompt, and assessment metadata before publishing.
- Assign lessons to a class or selected students.
- Preview the exact learner experience without contaminating learner metrics.
- View intervention groups based on transfer result, hint depth, and declared uncertainty, plus the source and evaluator version behind each recommendation.

### 7.6 Student workflows

- Start, resume, and exit a lesson safely across desktop and mobile.
- Use keyboard and screen-reader accessible controls.
- Receive a clear distinction between network errors, feedback, hints, and assessment results.
- Access scheduled recall checks from the Learn Hub.
- Export or view their own learning activity according to existing privacy controls.

## 8. Technical architecture

Class-mode retains its existing React/Vite client, Express server, PostgreSQL data model, AI gateway, auth, workspace controls, and deployment pipeline.

```text
Teacher/topic/source material
            |
            v
  Lesson compiler job
  outline -> validated scenes -> asset/action specs
            |
            v
 Postgres lesson + assignment records
            |
            v
 React classroom runtime
   scene renderer -> attempt/assessment gate
            |
            v
 Express interaction/assessment routes
            |
            v
 Learner-model single writer
  mastery + review schedule + activity log
            |
            v
 Teacher / student learning reports
```

The implementation must reuse `server/services/study-arena/lesson-script.ts`, the Study Arena beta route, the existing AI gateway, `commitLearnerUpdate`, `gradingService`, upload/OCR facilities, and the existing authentication/workspace boundary. It must not add a parallel Next.js application, LangGraph service, separate account system, or second learner database.

## 9. Data, privacy, and safety

- All lesson, assignment, activity, and learner records are workspace-scoped. Evidence events include immutable workspace, class, assignment, lesson-version, objective, source-policy, assessment-form, evaluator-version, and hint-level metadata.
- Source uploads undergo existing file, OCR, and content validation; unsupported files produce an actionable error.
- Student free-text is minimised. Default evidence is structured rubric result, misconception code, and effort signal; raw answers are retained only when required for teacher review, with documented expiry, access, audit, export, and deletion controls.
- Generated visuals use structured schemas, not raw arbitrary HTML or JavaScript. A simulation, once admitted after the wedge, runs in a sandboxed, allowlisted iframe contract.
- Teacher preview activity is excluded from student mastery, completion, and adoption metrics.
- AI output is checked for unsafe content, unsupported claims, source mismatch, and assessment-answer leakage.

## 10. Delivery phases

### Phase A: Teacher-owned mastery wedge

- Release three separate surfaces: **Teacher Activities**, **Student Assigned Activity**, and **Teacher Report**. Students enter only from an assignment or scheduled recall task; self-serve topic generation is not student navigation.
- Use a four-step creation flow: (1) source and objective, (2) outline with objective/source-span/assessment-form approval, (3) compact preview with targeted edits, (4) recipients, release timing, and publish confirmation. Publication is disabled until every required approval is recorded.
- Add versioned lesson, source, assignment, enrollment-snapshot, attempt-session, assessment, and intervention-report records.
- Make `attempt_session` server-created and opaque, bound to assignment, learner, immutable lesson version, and the permitted action sequence. Every interaction and assessment carries a server-checked action nonce and idempotency key; final-submission policy is explicit.
- Authorize every operation against its resource: teachers own the activity/version and target class, students must match the assignment enrollment snapshot, and report readers require class-scoped permission. Resource workspace is authoritative; “first workspace membership” is never authorization.
- Restrict the pilot to one buyer, grade band, curriculum unit, supported source type, and assessment form.
- Generate a teacher-reviewable diagnostic-practice activity with cited source spans and independent immediate/delayed transfer checks.
- Add role/workspace authorization for teacher creation, student assignment access, preview isolation, and teacher reporting.
- Preserve existing attempt gates, hint ladder, progress resume, usage metering, and learner-model writes while adding scoped evidence metadata.
- Run the pre-specified baseline comparison, teacher-time measurement, assessment-agreement sample, repeat-assignment measure, and stop/go criteria.

### Phase A experience and state contract

| Surface                   | Primary hierarchy                                                                  | Required states and recovery                                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Teacher activity creation | source/objective → review evidence → preview → recipients → publish                | Empty source, unsupported source, queued/generating/cancellable generation, generated-with-warning, failed/retryable generation, saved draft, publication blocked, published version          |
| Student activity          | context → active attempt → bounded help → transfer result → next step              | Assignment not yet available, revoked/expired assignment, invalid saved session, offline/submitted-unconfirmed attempt, incomplete exit, activity complete with transfer pending/pass/revisit |
| Recall                    | due window → no-AI check → result → next step                                      | Upcoming, due, overdue, completed, revoked, unavailable; late completion is tracked separately                                                                                                |
| Teacher report            | class evidence state → priority group → evidence explanation → intervention action | No assignments, no evidence, partial evidence, pending evaluation, insufficient sample, no intervention needed, scoped-access denied                                                          |

Generation errors preserve the teacher’s source and objective. Every error specifies whether retry is safe, whether a job continues in the background, and its support identifier. Assignment revocation preserves student work without counting it as completion or mastery.

The student completion screen always separates **activity completion**, **immediate transfer result**, and **next action**. It never claims mastery from one activity. Failed transfer receives a respectful revisit action; successful transfer records the recall due date.

Hint ladders have declared levels, availability, maximum allowed help, retry behavior, and an accessible exit path. A rejected low-effort response explains the minimum required attempt without shaming the learner. The policy supports an accommodation path where a teacher can release a worked example or alternate response mode.

Teacher report groups declare their inclusion rule, evidence window, sample size, confidence/uncertainty, source/evaluator version, and recommended teacher action. Teachers can mark the recommendation reviewed and record a follow-up; insufficient evidence is shown as such, never as “no need.”

### Phase B: Cross-subject lesson contract and visual foundation

- Move the proven activity contract to a shared, versioned scene schema.
- Add structured `write`, `draw`, `highlight`, and assessment actions plus accessible native playback.
- Add subject templates one subject at a time, each with an explicit objective taxonomy, evidence policy, assessment evaluator, and source-grounding test suite.
- Add the classmate role only after a controlled comparison supports its educational value.

### Phase C: Evidence-driven adaptive classroom

- Add concept/prerequisite maps, calibrated formative grading, adaptive next-scene selection, and spaced recall scheduling.
- Add teacher and student reports that distinguish attempt quality, help depth, immediate transfer, delayed retention, confidence, and observed follow-up.

### Phase D: Advanced media and authoring

- Add optional TTS/ASR, constrained simulations, collaborative/project activities, and teacher scene editing.
- Evaluate exports and external integrations only after the core learning loop and teacher assignment workflow demonstrate demand.

## 11. Explicitly out of scope for initial delivery

- Forking, vendoring, or embedding the OpenMAIC Next.js application.
- A generic unrestricted chatbot or answer-generation surface.
- Raw model-generated JavaScript in the browser.
- PowerPoint, video, and offline HTML export.
- External chat-platform integrations.
- Voice cloning, autonomous web search during lessons, and open-ended multi-agent debate.

## 12. Competitive thesis

Class-mode does not compete on generic lesson generation, avatars, or a presentation engine. The differentiator is a teacher-approved instructional evidence graph: **objective and source provenance → student attempt and bounded help path → independently graded transfer → delayed recall → recommended teacher intervention → observed follow-up.**

The first adoption bridge is the existing Class-mode course/class context and deep links, not generic export. Google Classroom or LMS roster/import integration is evaluated only if pilot evidence shows that existing Class-mode assignment paths materially block teacher activation.

## 13. Acceptance criteria

1. A teacher can create, review, assign, preview, and act on a report for the selected pilot unit.
2. Only assigned students can access the correct immutable lesson version; teacher previews never affect learner evidence.
3. A student can complete the activity on desktop and mobile without bypassing a required attempt or independent assessment gate.
4. A failed generation, invalid action, unavailable source, quota limit, expired session, assignment revocation, and network interruption each result in an actionable user-visible state and a server log.
5. Assessment actions cannot invoke hints or expose correct answers before submission; rubric disagreement enters a teacher-review queue rather than silently changing mastery.
6. Every student interaction affecting mastery is written only through `commitLearnerUpdate` and contains the declared evidence provenance.
7. Learner and teacher reports expose aggregate evidence without requiring raw student answers.
8. Unit, route, component, accessibility, security, and end-to-end tests cover create → source review → assign → learn → assess → recall → report → intervention flow.
9. Every scene action has a semantic name, keyboard operation, focus destination, text alternative, and `aria-live` announcement policy. State changes move focus to the next gate or alert; color never carries meaning alone.
10. The wedge meets WCAG 2.2 AA, supports 200% zoom/reflow, reduced motion, 44×44px touch targets, keyboard-only operation without traps, and portrait/landscape mobile keyboard-open layouts at 320 CSS px.
11. Direct API calls cannot submit an interaction or assessment without a valid unrevoked assignment, server-issued attempt session, expected nonce, and eligible assessment instance. Duplicate and replayed requests are idempotent.
12. Database migrations are forward-compatible and preserve submitted work. Rollout separately enables schema, workspace pilot, teachers, assignments, then students, with workspace/class allowlists and a rollback that blocks new work without deleting evidence.

## 15. Engineering architecture and operational contract

```text
Teacher approval
  -> lesson_version + source_span + evaluator_version
  -> assignment + immutable enrollment_snapshot
  -> server-created attempt_session
  -> nonce-checked interaction / assessment instance
  -> commitLearnerUpdate + immutable evidence_event
  -> report projection by workspace/class/objective/version
  -> teacher intervention action
```

Normalized, indexed records hold workspace, class, assignment, lesson version, objective, source policy, assessment form, evaluator version, and outcome. JSON is limited to bounded supplemental payloads. `commitLearnerUpdate` remains the only learner-model mutator, but receives server-derived evidence rather than client-provided lesson metadata.

Raw student answers are encrypted and time-limited when teacher review requires them. Structured effort, rubric, misconception, and hint fields are default evidence. Export, deletion, audit logging, local-resume clearing on revocation, and retention are defined per evidence class before the pilot writes data.

The compiler uses a durable job state machine with request fingerprint deduplication, cancellation checkpoints, retry classification, provider timeout, workspace/assignment budget reservation, and usage-write reconciliation. Publish is blocked by missing source coverage, moderation/grounding failure, missing approval, or assessment-answer leakage. Independent assessment instances are server-issued once per eligible attempt and delayed recall event; answer keys are not exposed in broad application artifacts.

Report projections are keyed and indexed by workspace, class, assignment, lesson version, objective, and evidence window. Aggregates distinguish zero evidence, pending evaluation, insufficient sample, and no intervention need. Evidence growth has a declared retention and partitioning policy.

## 16. Verification plan

| Flow                 | Required verification                                                                                                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create and approve   | Unit + route tests for source span coverage, rubric/evaluator version, approval invalidation, malformed renderer payload, moderation and grounding failures                                                                               |
| Assign and authorize | PostgreSQL integration tests with two workspaces/classes, cross-tenant access, enrollment snapshot, teacher preview isolation, revocation, expiry, and report scopes                                                                      |
| Attempt and assess   | Unit/route tests for nonce validation, replay/idempotency, concurrency, hint boundary, no-AI assessment enforcement, evaluator disagreement, recall due windows, and persistence failure isolation                                        |
| Runtime recovery     | Component/E2E tests for keyboard focus/live announcements, reduced motion, 320px mobile keyboard layout, offline/submitted-unconfirmed recovery, corrupt saved state, and revoke-after-resume                                             |
| Report and privacy   | Integration tests for cohort predicates, insufficient evidence, intervention-action audit, raw-answer access audit, export, delete, retention, and report projection reconciliation                                                       |
| Pilot safety         | Feature-flag/allowlist rollout test, job retry/cancel/dedup, AI usage reconciliation, cost-budget enforcement, rollback preserving evidence, and an end-to-end create → approve → assign → learn → recall → report → intervention journey |

## 14. Deferred experience decisions

- School-leader aggregate reporting is deferred until the teacher report proves trustworthy and role-scoped.
- Phase A supports targeted edits to source, objective, prompt, rubric, and recipients. Freeform scene editing is a Phase D capability. Editing a published protected field forks a new immutable version; existing assignments retain their published version.
- Notification channels for recall begin with existing in-app Learn Hub cards. Email, WhatsApp, and external LMS reminders require consent, throttle policy, and pilot evidence.

<!-- AUTONOMOUS DECISION LOG -->

## Decision Audit Trail

| #   | Phase  | Decision                                                                                      | Classification | Principle                             | Rationale                                                                                                                                  | Rejected                            |
| --- | ------ | --------------------------------------------------------------------------------------------- | -------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| 1   | CEO    | Use a native Class-mode PRD, not a fork/embed of OpenMAIC                                     | User premise   | User decision                         | Preserves the existing stack, auth, learner model, and attempt-first rule                                                                  | Separate upstream application       |
| 2   | CEO    | Put an all-subject platform behind a teacher-owned mastery wedge                              | User challenge | User decision after dual-voice review | Both independent reviewers found that assignment, trustworthy assessment, and intervention evidence must be proven before renderer breadth | Renderer-first all-subject sequence |
| 3   | Design | Add separate teacher, student, and report surfaces with a defined lifecycle state matrix      | Mechanical     | P1/P5                                 | The plan otherwise leaves recovery, roles, and success states to implementer invention                                                     | One shared self-serve screen        |
| 4   | Design | Define accessible, responsive scene and assessment behavior as testable acceptance criteria   | Mechanical     | P1                                    | Visual renderers without semantic and mobile contracts exclude learners and make QA subjective                                             | Aspirational accessibility wording  |
| 5   | Eng    | Make server-authoritative assignment/session/evidence the Phase A foundation                  | Mechanical     | P1/P5                                 | Client-supplied lesson metadata and unscoped learner events cannot protect assessment integrity or tenant reports                          | Extending the beta request contract |
| 6   | Eng    | Require resource-scoped authorization, immutable provenance, retention, and replay protection | Mechanical     | P1/P2                                 | The pilot handles minors’ learning evidence and direct API misuse is within the implementation blast radius                                | Authentication-only beta routes     |

## 17. Mandatory pre-implementation contracts

### Authorization and resource policy

Every request resolves the target resource first, then its workspace and class. Teachers may create or edit drafts they own, publish only to classes they administer, and read only their assigned-class evidence. Students may read and submit only an unrevoked assignment whose immutable enrollment snapshot includes their user ID. A student, parent, other teacher, or another workspace cannot infer resource existence. Preview uses a non-learner actor and never writes evidence.

### Relational lifecycle

`lesson_version`, `source_artifact`, `source_span`, `assignment`, `assignment_enrollment`, `attempt_session`, `evidence_event`, `assessment_instance`, `assessment_evaluation`, and `intervention_action` are immutable lifecycle records with FK, tenant-consistency, and uniqueness constraints. Sessions bind a learner, assignment, version, and action sequence. Nonces and idempotency keys prevent replay. Corrections create a new evaluator version and invalidate affected reports and recall schedules without destroying the original evidence.

### Evidence governance

The implementation defines evidence class, purpose, access role, retention duration, export/delete behavior, vendor exposure, encryption requirement, and audit event before collection. Teacher raw-answer access is audited. Accommodation metadata is protected and does not lower mastery confidence by default. Withdrawn unsafe content has a kill switch, student-safe message, and incident-review record.

### Worker, rollout, and reliability topology

Durable generation jobs run outside the web request with provider timeout, dedupe fingerprint, cancellation checkpoints, retry policy, cost reservation, usage reconciliation, and support IDs. Migrations follow expand → backfill → validate → contract, remain compatible across mixed deployments, and have an explicit Cloud Run migration owner. Workspace/class allowlists enable rollout in schema → teacher → assignment → student order; rollback blocks new work while preserving submitted evidence.

### Verification environment

CI adds deterministic fake AI/evaluator behavior plus a Redis-backed integration lane for job state, real PostgreSQL concurrency tests, and a private-storage adapter fake for source artifacts. The suite covers migrations from the previous schema, cross-tenant authorization, worker interruption, provider partial billing, nonce races, source/prompt fuzzing, retention/export/delete, and synchronized classroom/report load.

## GSTACK REVIEW REPORT

| Review      | Result                            | Key decision                                                                                                       |
| ----------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| CEO         | Approved after user challenge     | Replace renderer-first delivery with a teacher-owned mastery wedge                                                 |
| Design      | Approved with plan changes        | Separate teacher/student/report surfaces, lifecycle states, and WCAG/mobile requirements                           |
| Engineering | Approved with mandatory contracts | Server-authoritative assignment sessions, immutable scoped evidence, privacy lifecycle, and realistic verification |
| DX          | Not applicable                    | The product is teacher/student facing, not a developer product                                                     |
