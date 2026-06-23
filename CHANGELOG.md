# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **Admin Dashboard Trends** — New `GET /api/admin/trends` endpoint returns a daily activity time series (signups, tests created, submissions, logins) over a configurable window plus an average-score-by-class breakdown. School admins and principals are scoped to their own school; super admins see all schools.
- **Overview activity chart** now plots real submissions, logins, and new signups over the trailing week instead of a single login-only series derived client-side.
- **Reports tab** Average-score-by-class chart now uses real graded-submission data with an empty state, replacing the previous hardcoded mock distribution.

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
