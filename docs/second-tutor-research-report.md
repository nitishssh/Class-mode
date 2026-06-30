# Building a "Second Tutor," Not a Chatbot — Research Report

**Prepared for:** Class-mode (classmode.inmodel.in)
**Date:** 2026-06-27
**Method:** Multi-agent research sweep (4 parallel agents): tool landscape, learning science, multi-agent architecture, student-efficiency layer.

---

## Executive summary

The goal — _a second tutor that builds understanding, not a chatbot that hands over answers_ — is exactly the right framing, and the 2024–2026 evidence backs it hard:

1. **The defining design move is withholding the answer.** Every strong tutor (Khanmigo, Synthesis, Harvard's PS2 Pal, Google LearnLM) is engineered to _not_ solve the problem for the student. This is the single line separating a "tutor" from an "answer engine."
2. **The gains are real but conditional.** The most rigorous trial to date (Harvard, _Scientific Reports_, June 2025) found ~0.7–1.3 SD learning gains from a deliberately Socratic AI tutor — over 2× active-learning classrooms, in less time. But a parallel 2025 body of research ("metacognitive laziness," knowledge decline, cognitive offloading) shows the _same technology as an unconstrained chatbot reduces learning._ **Design intent, not the model, drives the outcome.**
3. **A tutor is a system, not a prompt.** The 2-sigma effect only appears when you implement the interlocking pieces: a persistent learner model, mastery gating, spaced retrieval, scaffolding that fades, Socratic hinting, and formative feedback loops. Conversational fluency alone buys almost none of it.
4. **Your proposed multi-agent design is essentially a validated reference architecture** (IntelliCode, arXiv 2512.18669). Build it as a thin TypeScript orchestrator over the Anthropic SDK — _not_ a Python framework port — with a single-writer student model in Postgres as the keystone.

**Bottom line:** the product should be _deliberately less convenient than a chatbot_ — and that friction (enforced retrieval, struggle, mastery gates) is the value. Make studying harder in the right way, easier to start and stay consistent.

---

## Part 1 — The landscape: what "second tutor" tools actually do

### Two product categories, both called "AI tutors"

- **Adaptive mastery systems** (Squirrel AI, Amira, Quizlet Learn) — track a knowledge graph, route practice, gate on mastery.
- **Conversational Socratic tutors** (Khanmigo, Synthesis, LearnLM) — dialogue with the student, withhold answers.
- **The best newer products fuse both.**

### Comparison of notable tools

| Tool                                      | Category                                       | "Tutor" mechanism                                                        | Notes                                                                   |
| ----------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **Khanmigo** (Khan Academy)               | Socratic tutor + teacher assistant             | Refuses answers; "what have you tried?"; step hints                      | ~$4/mo; **free for US teachers** (Microsoft-funded); 40k→700k→~1M users |
| **Synthesis Tutor**                       | Voice Socratic math tutor (K-5)                | Real-time voice dialogue, visual manipulatives, coaches through mistakes | Narrow (K-5 math), consumer/homeschool                                  |
| **Squirrel AI**                           | Adaptive mastery                               | 10,000+ knowledge points, diagnoses gaps, routes next item               | RCT gains > expert human teachers; drill-oriented, China-centric        |
| **Google LearnLM / Gemini for Education** | Pedagogically-tuned LLM + Guided Learning mode | "Pedagogical instruction following"; goes beyond the answer              | Now a _toggle on a general model_ others can build on                   |
| **MagicSchool (Raina)**                   | Teacher platform + student tools               | 80+ tools, teacher monitoring                                            | 5M teachers/160 countries; FERPA/COPPA/SOC 2                            |
| **Amira Learning**                        | Adaptive **reading** tutor                     | Listens to oral reading, micro-tutoring, dyslexia screener               | Effect size 0.40 (~2× typical tutoring); enterprise/district            |
| **Photomath / MS Math Solver**            | Step-by-step **solver**                        | Animated worked steps                                                    | Fundamentally gives the answer — cheating risk, not Socratic            |
| **Quizlet AI**                            | Adaptive practice                              | Learn mode adapts in real time                                           | **Q-Chat tutor discontinued June 2025**; now study aids                 |
| **Brisk Teaching**                        | Teacher Chrome extension                       | Turns any web resource into activities; teacher-approved feedback        | Teacher-centric                                                         |

**Industry shift:** standalone "answer apps" are dying/consolidating — Socratic folded into Google Lens (Oct 2024), Quizlet Q-Chat killed (June 2025), Photomath acquired by Google. Platforms win; teacher-productivity tools (MagicSchool, Brisk) adopt fastest, student tutoring follows behind privacy gating.

### The recurring patterns that make these tutors (your product spec)

1. **Answer-withholding by design** — enforced at the system-prompt/training level.
2. **Socratic questioning loop** — lead with a question; diagnose the mental model before responding.
3. **Real-time adaptation** — change the next move based on the _last_ response.
4. **Mastery / knowledge-graph tracking** — know _what_ the student knows, teach prerequisites first.
5. **Brief responses** — avoid the chatbot "answer dump."
6. **Multi-modal coaching** — voice, visuals, animated steps, listening.
7. **Affective scaffolding** — reduce math/reading anxiety.
8. **Teacher-in-the-loop oversight** — dashboards, approve-before-shown.
9. **Anti-cheating framing** — withholding answers doubles as cheating deterrence (a key school adoption reason).

### Evidence on outcomes

- **Harvard RCT (2025):** Socratic AI tutor → >2× gains vs active learning, ES ~0.73–1.3, less time. The tutor _never gave direct answers._
- **LearnLM:** students +5.5pp more likely to solve novel problems; preferred over GPT-4o (+31%) and Claude 3.5 Sonnet (+11%) by pedagogy experts.
- **Squirrel AI / Amira:** RCT gains over human instruction; Amira ES 0.40, ~99% dyslexia-screening accuracy.
- **Cautionary:** Gerlich (2025) found AI use negatively correlated with critical thinking (worst in younger users); a medical-ed meta-analysis (11 RCTs) found _no_ significant difference vs traditional teaching. **Gains are not automatic.**

---

## Part 2 — The learning science (what makes it a tutor)

A tutor is one interlocking system. The pieces, each with how to implement:

1. **Bloom's 2-sigma problem** — 1:1 mastery tutoring ≈ +2 SD. AI ITS reach ES ≈ 0.76 (≈ human tutoring 0.79). _The result is a system spec, not marketing — it only appears with the pieces below._
2. **Socratic method / guided discovery** — a **hint ladder** (clarifying question → conceptual prompt → narrowing hint → partial step → full step only as last resort); anchor every exchange to a target objective + stop condition.
3. **Mastery learning** — knowledge-component/skill graph with prerequisites; gate progression on demonstrated mastery; loop corrective _variants_ (not the same item).
4. **Spaced repetition + retrieval practice (testing effect)** — among the most robust findings in all of learning science (ES ~0.78; retrieval cuts forgetting dramatically). Per-student review queue (SM-2/FSRS), open sessions with low-stakes retrieval, interleave. _This is exactly what a stateless chatbot cannot do._
5. **ZPD / scaffolding / adaptive difficulty** — pick the next item at the edge of competence (~70–85% success); difficulty as a control loop driven by recent performance.
6. **Knowledge tracing / learner modeling** — the engine that turns a chatbot into a tutor with memory. Start with **Bayesian Knowledge Tracing** (interpretable, models guess/slip so one right answer ≠ mastery); move to deep KT with data volume but keep a transparent fallback. _Note: specialized KT models still beat LLMs at predicting mastery — don't assume the LLM "just knows."_
7. **Worked examples → faded scaffolding** — novices learn more from worked examples; the **expertise reversal effect** means heavy guidance _hurts_ once competent. Lead a new skill with a worked example → completion problem → full problem, then **withdraw** support deliberately.
8. **Metacognition / self-explanation** — lightweight "explain your reasoning / predict before you check / how confident are you?" prompts — but **gate frequency by skill** (metacognitive overload is real and can backfire).
9. **Productive struggle vs. immediate help — the #1 risk.** The 2024–26 evidence to internalize:
   - **Metacognitive laziness** (Fan et al. 2025, BJET, n=117 RCT): ChatGPT group got the _best essay scores_ but _no better knowledge/transfer_ and fewer self-regulation behaviors.
   - **Knowledge decline** (Benedek & Sziklai 2025): AI-permitted group's real test knowledge ~20%, exam rankings indistinguishable from random.
   - **Cognitive offloading** (EDUCAUSE "Better Results, Worse Thinking"; Hechinger): fluent answers remove the difficulty signals that trigger learning.
   - **Design against it:** never volunteer the final answer on a learning task; require an attempt/stated approach before help unlocks; ask the student to self-evaluate _before_ the tutor confirms; require re-derivation/re-application after help; **measure delayed retention and transfer, not satisfaction.**
10. **Formative assessment + feedback loops** — Hattie: formative assessment ES ≈ 0.90, feedback ≈ 0.73. Make feedback about _process and strategy_, not just "wrong, the answer is X." Every check updates the model → reschedules review → re-targets difficulty.

**The synthesis:** persistent learner model → ZPD-targeted selection + spaced retrieval → worked examples that fade → Socratic hints gated behind productive struggle → formative checks update the model → metacognitive prompts (sparingly). The tutor's job is to be _designedly less convenient_ than a chatbot.

---

## Part 3 — The multi-agent architecture (how to build it)

### Core principle (from IntelliCode, arXiv 2512.18669 — your design, already validated)

> **One writer to the student model.** The Orchestrator is the _sole_ component that commits to the persisted learner state in Postgres. Every other agent is a pure function: read a snapshot + context, return a typed proposal (hint, mastery delta, quiz, verdict). The orchestrator validates and atomically commits. This is the difference between a coherent tutor and a chatbot that contradicts itself across turns.

### Agent roster + model assignment

| Agent                                 | Role                                                                                 | Model (Claude 4.x)                  | Why                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------ |
| **Orchestrator / Tutor**              | Owns dialogue, Socratic policy, decides which workers to call, **sole state writer** | **Opus 4.8** (effort `high`)        | Pedagogy + judgment core; long-horizon coherence                   |
| **Learner-Model / Knowledge-Tracing** | Infers per-concept mastery deltas from each exchange                                 | **Haiku 4.5** / Sonnet 4.6          | Structured, cheap, frequent (strict JSON)                          |
| **Content / Curriculum (RAG)**        | Retrieves syllabus-aligned material (pgvector)                                       | Haiku 4.5 (query-shaping)           | Constrains to instructor content, curbs hallucination              |
| **Assessment / Quiz**                 | Generates formative checks; grades; locates the _specific_ mistake                   | **Sonnet 4.6** (grade), Haiku (gen) | Grading needs reliability                                          |
| **Hint / Scaffolding**                | **Graduated** hints (nudge → strategy → worked step), never the answer               | **Sonnet 4.6**                      | Core "scaffold on low mastery" path                                |
| **Verifier / Fact-Check**             | Catches hallucinations; **re-runs math** via code execution                          | **Sonnet 4.6** + code tool          | Fresh-context verifier beats self-critique                         |
| **Planner / Study-Coach**             | SM-2/FSRS spaced-repetition scheduling, study plan                                   | **Haiku 4.5**                       | Mostly deterministic arithmetic; LLM narrates                      |
| **Safety / Guardrail**                | Age-appropriate; **blocks answer-giving on graded work**; PII                        | **Haiku 4.5** + rules               | "No answers on graded work" is a product rule, not a model default |

**Cost shape:** one capable model (Opus 4.8) on the orchestrator; reliable mid-model (Sonnet 4.6) where correctness matters (grade/hint/verify); cheap fast model (Haiku 4.5) on high-frequency structured agents.

### Per-turn data flow

1. Student message → React (WebSocket/SSE).
2. Orchestrator loads the **student-model snapshot** (mastery vector, SM-2 schedule, memory) in one Postgres query.
3. Fan out in parallel: Content/RAG (pgvector search) + Learner-Model/KT (scores the _previous_ exchange → mastery deltas).
4. Orchestrator decides the move: Socratic question? If stuck → Hint/Scaffolding returns _next level only_. If a check is due → Assessment/Quiz.
5. Orchestrator drafts the turn → Verifier re-derives math + checks claims.
6. Safety/Guardrail gates: graded assignment → strip any answer, force hint-only rewrite.
7. Orchestrator **atomically commits** validated deltas + SM-2 update + memory note → **streams** the final turn.

### Tech-stack decisions for TS/Node

- **Orchestration:** roll your own **thin TS orchestrator** over `@anthropic-ai/sdk` with the manual tool-use loop. LangGraph/CrewAI/AutoGen/ADK are Python-first; tutoring is a _bounded_ workflow, not open-ended — you don't need them. If step-level durability becomes a real need later: Vercel Workflow (WDK) or LangGraph.js.
- **Workers as Claude tools:** define each as a strict-schema tool (`propose_mastery_delta`, `generate_hint`, `grade_response`, `retrieve_curriculum`, `verify_claim`, `safety_gate`); use the manual loop to keep policy-in-the-loop control.
- **Student model:** Postgres tables — `mastery(student_id, concept_id, p_mastery, confidence)`, `review_schedule(... sm2_ef, interval, due_at)`, `engagement`, `memory_notes`, `interaction_log`. Single source of truth; single-writer invariant lives here.
- **RAG:** **pgvector** in the existing Postgres (one datastore, transactional with the student model). Consider GraphRAG for traceable grading feedback.
- **Math:** Claude code-execution tool inside the Verifier — _run_ arithmetic, don't let the model eyeball it.
- **Caching:** keep the orchestrator's system prompt + tool list byte-stable so prompt caching holds; inject volatile student-state _after_ the cached prefix.

### Evaluating the tutor (accuracy alone is invalid — the goal is learning)

1. **Pedagogical-ability eval (LLM-as-judge):** BEA 2025 four-dimension rubric — mistake identification, mistake location, guidance, feedback actionability. Calibrate against human labels; use a multi-persona judge to reduce single-judge bias.
2. **Behavioral guardrail eval:** SafeTutors-style adversarial "just give me the answer" probes on graded work; must pass before each release.
3. **Learning-gain eval (the one that matters):** offline replay → does the KT mastery trajectory improve and calibrate? Online → pre/post concept tests + A/B Socratic tutor vs plain-chat on normalized learning gain and spaced-interval retention.

### Phased build plan

- **Phase 0 — Foundations (1–2 wks):** Postgres student-model schema + pgvector; ingest one course; define concept graph; single-writer commit helper.
- **Phase 1 — Walking-skeleton tutor (MVP):** Orchestrator (Opus 4.8) + Content/RAG + Safety only. Socratic prompt, streamed turns, hard "no answers on graded work." _This alone is a credible, curriculum-aligned, safe tutor — ship it._
- **Phase 2 — Adaptive:** add Learner-Model/KT (Haiku, strict-JSON) + Hint/Scaffolding (Sonnet, graduated). The IntelliCode core.
- **Phase 3 — Assessment + trust:** add Assessment/Quiz (Sonnet grading + mistake-location) + Verifier (Sonnet + code execution).
- **Phase 4 — Retention:** add Planner/Study-Coach with SM-2/FSRS spaced repetition + study plans.
- **Phase 5 — Eval, scale, harden:** BEA-2025 + SafeTutors gates in CI; multi-persona judge; learning-gain A/B; cost dashboards; per-student memory; cache tuning.

---

## Part 4 — The efficiency layer (study faster, retain more)

Highest-leverage efficiency features, in priority order:

1. **Adaptive (FSRS-style) spaced-repetition engine** with an automatic daily "due today" queue. FSRS cuts review load ~20–30% for the same retention vs SM-2. _The single biggest retention-per-hour lever._
2. **One-click notes/PDF → graded flashcard deck** grounded in the student's own syllabus, feeding straight into the SR scheduler (removes the biggest friction in spaced repetition: card creation).
3. **Retrieval-first interaction design** — every summary/explanation immediately spawns a quiz; never end on passive consumption. (Reading an AI summary _feels_ like learning but decays fast — Roediger & Karpicke: 61% recall with retrieval vs 40% rereading.)
4. **Syllabus/board-aware practice generator** — difficulty- and Bloom's-tagged questions + model answers + exam-blueprint paper assembly (CBSE/ICSE/IB/standardized). Vendors claim 95–98% syllabus-mapping accuracy.
5. **Mastery-gated learning path with explicit weekly dosage targets** ("30 min/week, 2 skills/week"). Khan's published evidence: 30+ min/week → ~20% greater-than-expected MAP Growth gains (ES 0.36) across ~350,000 students.
6. **Explainable progress dashboard** (student + teacher) — converts mastery data into a concrete next-step plan, not vanity metrics. (Learning-analytics dashboards have _mixed_ achievement impact — the GenAI edge is _explaining_ the data: "you're weak on quadratics; here's a 20-min plan.")
7. **Gamified focus sessions** — timer + distraction blocking + streaks/missions, wired to the day's study queue (Forest model: loss-aversion + group accountability).
8. **Accessibility baseline** — read-aloud, on-demand translation, dyslexia-friendly formatting over _all_ content, not a bolt-on (~23% reading-comprehension improvement reported for learning-different students; also serves ESL/multilingual).

**Cross-cutting pitfall:** the cognitive-offloading paradox — AI boosts immediate task performance while eroding durable learning, and students _overestimate_ their competence. Design must **enforce effort**: make the student retrieve, justify, and self-test rather than passively consume.

---

## Key sources

**Tools/outcomes:** Harvard RCT — hechingerreport.org/proof-points-ai-tutor-harvard-physics/ · LearnLM — arxiv.org/abs/2412.16429 · Squirrel AI — arxiv.org/pdf/1901.10268 · Amira — amiralearning.com/research

**Learning science:** Bloom 2-sigma — journals.sagepub.com/doi/10.3102/0013189X013006004 · Metacognitive laziness (Fan 2025) — arxiv.org/abs/2412.09315 · Knowledge decline (Benedek & Sziklai 2025) — arxiv.org/html/2510.16019v1 · EDUCAUSE "Better Results, Worse Thinking" — er.educause.edu/articles/2025/12/the-paradox-of-ai-assistance-better-results-worse-thinking · Hattie effect sizes — visible-learning.org

**Architecture:** IntelliCode — arxiv.org/pdf/2512.18669 · LLM Agents for Education survey — arxiv.org/pdf/2503.11733 · KT+LLM review — arxiv.org/pdf/2412.09248 · MathTutorBench — arxiv.org/pdf/2502.18940 · BEA 2025 — arxiv.org/pdf/2507.10579 · SafeTutors — arxiv.org/pdf/2603.17373

**Efficiency:** FSRS/spaced repetition — notigo.ai/blog/best-flashcard-apps-students-anki-remnote-quizlet-2025 · Khan efficacy (Nov 2024) — blog.khanacademy.org/khan-academy-efficacy-results-november-2024/ · Testing effect meta-analysis — structural-learning.com/post/testing-effect-retrieval-practice
</content>
</invoke>
