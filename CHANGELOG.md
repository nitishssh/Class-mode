# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **Learner Mastery & Spaced-Repetition dashboard** — New **Progress** tab in the Learn Hub (`/learn?mode=progress`) shows students their per-concept BKT mastery levels, confidence, and SM-2 review schedule (due-now vs. upcoming review cards). Backed by `GET /api/learn/mastery`, which reads the single-writer learner model (`learner_mastery` + `review_schedule`).
- **Gemini provider boot health check** — At startup the server now verifies the Google API key with a lightweight probe and logs a loud, actionable warning when the key is missing or **blocked** (`API_KEY_SERVICE_BLOCKED`), instead of surfacing an opaque 403 deep inside a feature.
- **Web search for AI agents** — New `webSearch` service + `POST /api/ai/web-search`. Works keyless out of the box via DuckDuckGo and transparently upgrades to Tavily or Serper when `TAVILY_API_KEY` / `SERPER_API_KEY` is configured. Completes the last open item in the Study Arena roadmap.

### Fixed

- **Grading failures no longer masked** — When grading errored, the failure-record write in `gradeSubmission`'s catch block could itself throw (e.g. DB unavailable) and overwrite the real error. That secondary write is now best-effort, so the original cause propagates.
- **Pilot simulation harness** — `scripts/simulate-pilot-school.ts` now connects to PostgreSQL before grading (fixing the "pool not initialized" failure in the predictive report) and renders the detailed-grading section from the correct field.

## [1.8.0.2] - 2026-07-01

### Fixed

- **Cross-school data isolation on admin dashboards** — Admin, principal, and school-admin dashboards no longer leak users, activity, and audit logs from other schools. The user directory (`GET /api/users`), audit log (`GET /api/admin/logs`), and analytics stats/trends (`GET /api/admin/stats`, `GET /api/admin/trends`) now scope strictly to the signed-in admin's own school; only the platform super-admin sees cross-school data. An admin account not yet associated with a school is denied rather than shown every school's data (previously the school filter was skipped when no school code was set, exposing all tenants).

## [1.8.0.1] - 2026-06-27

### Added

- **Asynchronous Background Tutor Grading** — Integrated a Gemini 2.0 Flash powered background grading service (`gradeTutorTurn`) executing out-of-band on Express `res.on("finish")` to evaluate student attempts against SM-2 recall scores (0-5) and update BKT mastery without blocking chat rendering.
- **Grader Resiliency and Timeout Checks** — Implemented 8-second request abort signal timeouts and robust regex-based JSON extraction in `grader-service.ts` to ensure clean recovery from malformed or fenced AI responses.
- **Frontend Active Concept Displays and Event badges** — Passed active concepts from the Learn Hub into the tutoring sheet, showing the concept name dynamically in the header and intercepting automatic hint requests to render them as compact, non-invasive system event badges instead of standard user chat bubbles.
- **Inline Chat Error Bubbles and Retries** — Introduced red system-error panels in the chat conversation log allowing students to retry requests inline after network or quota failures.
- **Accessible Hint Touch Targets** — Configured a minimum 44px mobile touch target for the "Unlock Hint" trigger.

### Added

- **Admin Dashboard Trends** — New `GET /api/admin/trends` endpoint returns a daily activity time series (signups, tests created, submissions, logins) over a configurable window plus an average-score-by-class breakdown. School admins and principals are scoped to their own school; super admins see all schools.
- **Overview activity chart** now plots real submissions, logins, and new signups over the trailing week instead of a single login-only series derived client-side.
- **Reports tab** Average-score-by-class chart now uses real graded-submission data with an empty state, replacing the previous hardcoded mock distribution.

## [1.8.0.0] - 2026-06-25

### Added

- **Workspace invitations work end-to-end over email.** Opening an invite link lands you on the workspace join page where you can accept (if already signed in), sign in and accept, or — for a brand-new email — set a name and password to create your account and join in one step.
- **One-step join for new members** — `POST /api/auth/workspace-invite/signup` creates a verified account, adds you to the workspace, and signs you in from a single form, so an invited person goes straight into the workspace with no separate signup/login detour.
- **Resend invites** from Settings → Invites. Pending or expired invites can be re-armed with a fresh link and a new 7-day expiry.
- **`npm run migrate`** applies the database schema (`scripts/pg-schema.sql`) so a new or out-of-date database gets every required table.

### Fixed

- **Workspace invite emails no longer dead-end.** The link pointed at the school-invite page, which doesn't own workspace invite tokens, so every workspace invite failed with "Invalid invite link." Links now open the workspace join page that owns the token.
- **No more duplicate invites.** Inviting someone who is already a member is rejected, and re-inviting a still-pending email re-arms the existing invite instead of stacking a second one.
- **Clear startup warning on schema drift.** If core tables (including `workspace_invites`) are missing, the server now logs an actionable warning at boot telling you to run `npm run migrate`, instead of failing later with an opaque error.

## [1.7.1.1] - 2026-06-23

### Security

- **Privilege escalation on first onboarding blocked (M1)** — `POST /api/onboarding/complete` previously included `student` in the set of roles allowed to self-select a new role during first onboarding. An invited student could escalate to `teacher`, `principal`, or `school_admin` within their tenant. Students are now excluded; only self-signup `school_admin`/`admin` defaults may change role. Added a regression test.
- **Onboarding routes no longer bypass authentication (H2)** — `/api/onboarding` was listed in the auth middleware's EXEMPT set, so `authenticateToken` returned `next()` without populating `req.user` for every onboarding route. Authenticated routes (e.g. `/complete`, `/school/setup`) ran without a verified identity. Removed the blanket exemption; genuinely public routes (`/invite/accept`, `/invite/validate/:token`) do not invoke `authenticateToken` and are unaffected.

## [1.7.1.0] - 2026-06-10

### Added

- **Admin Dashboard v2** — Unified control center with real-time user management, class CRUD, timetable scheduling grid, security audit log, and API key generation. All mutations are audit-logged.
- **PDF → Test Generator** — Upload any PDF and Gemini AI generates MCQ questions automatically (`POST /api/ai/generate-from-pdf`). Supports file upload and base64 input.
- **Timetable Scheduling Grid** — Weekly period grid with real-time conflict detection for teacher, class, and room collisions. Accessible from the admin dashboard.
- **Audit Log Dashboard** — School admins can view a live feed of security events: login attempts, tenant access denials, validation failures, and API key issuance.
- **API Key Generation** — School admins can generate long-lived tokens for embedding test widgets in external sites (`POST /api/admin/keys`), with full audit trail.
- **Zod Input Validation** — All class, school, and user update routes now validate through Zod schemas, preventing malformed and over-privileged writes.
- **Pilot School Seeding** — `server/scripts/seed-pilot.ts` seeds a full institutional environment for testing and demos.
- **AI Predictive Reporting** — Initial support for generating predictive learning outcome reports in the analytics dashboard.

### Changed

- **AbortController timeouts** — AI calls (test generation and PDF generation) now time out after 30 seconds with proper AbortSignal forwarding to Gemini and OpenAI SDKs.
- **Timetable API** — Response now uses camelCase fields (`dayOfWeek`, `className`, `teacherId`) consistently. Route corrected to mount at `/api/timetable`.
- **Test editing by URL** — Teachers can navigate directly to `/tests/:id/questions` to resume adding questions to an existing test.
- **Auth flow** — Login and signup now correctly bypass Firebase exchange when `firebaseExchangeEnabled` is false, enabling local-auth deployments.

### Fixed

- **Mass assignment blocked** — `PUT /api/users/:id` now validates through `updateUserSchema`; `role`, `passwordHash`, and `emailVerified` can no longer be escalated via the API.
- **Tenant isolation** — School admins can no longer update or delete users or classes outside their own school. Cross-school operations return 403 and are audit-logged.
- **JWT secret handling** — Hardcoded fallback string removed from optional-auth and API key signing paths; uses `process.env.JWT_SECRET` directly.
- **Sidebar cleanup** — Removed disabled "School Overview", "Staff Directory", "Reports" stub links.

## [1.7.0.0] - 2026-06-02

### Added

- **Gamified onboarding quest panel** — new teachers now see a floating "Get Started" button with a slide-in panel listing three activation quests: create a test, set up a class, and invite a student. Completing all three fires a confetti celebration. Quest state persists in localStorage (v0). Panel auto-hides after 7 days or when all quests are done.

### Fixed

- Test creation now correctly attributes the test to the authenticated teacher — previously the route compared a Firebase UID against a numeric session ID, causing all teacher test-create requests to return 403. The teacherId is now derived server-side from the session.
- Test update (PATCH) no longer accepts a client-supplied `teacherId`, closing a potential test re-attribution vector.
