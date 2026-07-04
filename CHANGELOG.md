# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [1.8.5.0] - 2026-07-05

### Added

- **Landing page contact form now captures pilot requests** — School leaders and educators can submit their name, school, contact info, and learning goals via the landing page. Submissions are persisted to a `leads` table and the team is notified automatically by email so no request falls through the cracks.
- **Feature explainers for parents and principals** — New public pages `/for-parents` and `/for-schools` walk through every Class Mode feature from each audience's perspective: parents see progress insights, attendance alerts, AI tutor, and fees; principals see live dashboards, at-risk flags, teacher productivity tools, and institution-wide KPIs. Deep-dive links from the main landing page make these easy to find.

### Changed

- **Landing page navigation** now includes direct links to the audience-specific feature pages so visitors can read what matters to their role before signing up.

### Fixed

- **Contact form success messages now display** — the form was calling toast notifications but the Sonner toast provider was never mounted, so submission confirmations silently no-op'd. Sonner Toaster is now wired into the app root.

## [1.8.4.0] - 2026-07-04

### Changed

- **New buyer-focused landing page that tells a story instead of listing features** — the page now walks a principal through one school morning: the hero shows attendance marked at 8:02 and Mum's WhatsApp reply by 8:03 (animated register → phone → live-dashboard mockup), the problem section names the paper-register pain, and an interactive WhatsApp AI-tutor simulator lets visitors play scripted study conversations (typing indicators, per-topic threads). Pricing is now an honest "Founding School Pilot — Free" card and the contact form asks school-specific questions. (`client/src/components/landing/*`, `client/src/pages/landing.tsx`)
- Page title, meta description, and new Open Graph tags now pitch attendance/fees/parent alerts instead of generic AI learning, so shared links preview the buyer story. (`client/index.html`)
- Landing animations respect the visitor's reduced-motion preference, pause while off-screen (hero storyboard loop, ambient glows), and the demo conversation starts when scrolled into view instead of finishing before anyone sees it.

### Fixed

- Footer tagline now actually shows the new school-operations copy — a stale i18n dictionary entry was silently overriding it. Orphaned landing keys removed, new ones added. (`client/src/lib/i18n.tsx`)
- Contact-form feedback is now visible: sonner toasts (validation errors, success message) never rendered anywhere in the app because no sonner `<Toaster/>` was mounted. (`client/src/App.tsx`)
- Phone-first form usability: 16px inputs stop iOS Safari zoom-jumping on focus, pinch-zoom is no longer blocked (`maximum-scale` removed), and fields gained labels + autocomplete for mobile autofill.
- Tutor chat renders bold/italic markers as real formatting instead of literal asterisks, and no longer yanks the reader to the bottom while they're rereading an earlier message.
- WhatsApp chat wallpaper is now a first-party bundled asset instead of a hotlink to a third-party GitHub image that could vanish; both mockups use authentic WhatsApp header colors.
- Heading fonts load the weights they use (DM Sans 700/800, Crimson Pro italic — no more faux-bold), the unused Inter/Kalam font download is gone, and anchor links no longer hide section tops under the fixed navbar.
- Accessibility: decorative mockups and background images are hidden from screen readers, the mobile menu button announces its state, and a React duplicate-key bug in the hero chat animation is fixed.

### Added

- Playwright coverage for the landing page (14 tests): hero CTAs, demo playback and mid-conversation topic switching, contact-form validation branches, and the mobile menu. (`e2e/web/landing.spec.ts`)

### Removed

- Dead student-focused landing sections (`features.tsx`) and their orphaned notebook CSS.

=======
>>>>>>> 2e292bf (chore: bump version to 1.8.4.0 and update changelog)
## [1.8.3.1] - 2026-07-04

### Fixed

- **WhatsApp sends no longer report phantom success in production** — when `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` were unset, `sendMessage` returned `success: true` (simulated) in every environment, so a misconfigured production deploy looked healthy while every parent absence alert silently went nowhere. In production, a missing-credential send now fails loud (`success: false` + error log); simulation is preserved outside production so dev/test/CI keep working offline. (`server/services/whatsapp.ts`)

### Added

- First test coverage for the parent-notification path — `handleAttendanceMarked` (one send per absentee, empty-roster no-op, and partial/outright send failures logged not thrown) and the production fail-loud behavior above. (`server/tests/notifications_consumer.test.ts`, `server/tests/whatsapp_integration.test.ts`)

## [1.8.3.0] - 2026-07-03

### Fixed

- **No more fabricated data on real accounts** — dashboards, analytics, and the calendar previously showed hardcoded sample content (e.g. "Level 12 / 450 XP / 6 day streak" on brand-new student accounts, "Class average 78% / Jatin Mehta 96%", "Annual Sports Day", seeded exams and holidays) regardless of any demo setting. Real schools now see their actual data or an honest empty state.
  - Student dashboard: XP, level, and streak come from the account instead of being hardcoded server-side; the streak dots reflect the real streak; the XP card no longer mislabels total XP as "earned today" or shows a fake "Master" rank.
  - Analytics: class average, student counts, and completion rate are computed from real student records (with a clear empty state when there's nothing to show yet); the performance chart and "top students" no longer fall back to sample rows.
  - Calendar: shows a genuinely empty schedule (no invented exams/quizzes/holidays) and opens on the current month.

### Changed

- **Principal dashboard "Demo Data" is now off by default** and actually hides everything sample when toggled off — upcoming events, notifications, staff distribution/overview, finance status, and infrastructure are all sample content gated behind the toggle, replaced by honest empty panels when it's off. Turning it on is an explicit opt-in for demos and screenshots.

## [1.8.2.0] - 2026-07-03

### Added

- **Domain event bus (Redis Streams)** — `server/lib/events.ts`: append-only topics with consumer groups, explicit acks, dead-consumer reclaim (XAUTOCLAIM) and bounded history. Kafka-shaped interface so a future Kafka migration is a driver swap, not a rearchitecture — Kafka itself was deliberately not added (single-service pilot; Streams give the same guarantees on infra we already run). Topics: `attendance.marked`, `fee.created`, `fee.paid`.
- **Durable absence alerts** — with Redis on, parent WhatsApp notifications flow through the event bus: a crash between the register save and the sends no longer loses alerts (verified: event published while the app was down was delivered on restart). Without Redis, the previous inline fire-and-forget send remains as fallback.
- Health endpoints now report `redis: { connected, configured }`.

### Changed

- **Redis consolidation** — one shared, lazy, gated ioredis client (`server/lib/redis.ts`) replaces the previous split (`redis` pkg in lib + ad-hoc `ioredis` connections in BullMQ services). With `REDIS_URL` unset, everything degrades gracefully instead of the old behavior — two services unconditionally dialing localhost:6379 and spamming ECONNREFUSED at boot. Study Arena / SIS-automation queues now surface a clear "requires Redis" error instead of hanging. Dropped the now-unused `redis` npm package.

### Changed

- **Repo organization** — Docker artifacts now live under `docker/` (`Dockerfile`, all three compose files, `nginx.conf`); compose is invoked with `--project-directory .` so every relative path resolves as before. Removed stale root files: `schema.sql` (June pg_dump snapshot — `scripts/pg-schema.sql` is the source of truth; recoverable from git history), empty `diff.txt` and `proxy.log`. `.dockerignore` stays at the repo root (build-context requirement).

## [1.8.1.0] - 2026-07-02

### Added

- **Parent loop: absence alerts on WhatsApp** — Marking a student absent now automatically WhatsApps their parent ("Attendance alert: … was marked absent today"), fire-and-forget so the teacher's save never blocks. New `parent_phone` on student records, editable inline from the attendance roster (`PATCH /api/attendance/roster/:studentId/parent-phone`, tenant-guarded). The save toast reports how many parents were notified.
- **Fee reminders prefill the parent's number** — the fees Remind dialog auto-fills from the same `parent_phone`, so sending a reminder is one click once the number is on file.
- **Attendance & Fees pages** — Teachers get `/attendance` (class + date picker, per-student Present/Absent/Late/Excused toggles, all-present shortcut, live summary chips); admins get `/fees` (pending/collected cards, create-fee dialog, status filter, mark-paid, WhatsApp reminder dialog). Both wired into the sidebar for every relevant role, with teacher-accessible tenant-scoped roster endpoints (`GET /api/attendance/classes`, `GET /api/attendance/roster`).
- **Boot-time migration (opt-in)** — `AUTO_MIGRATE=true` applies the idempotent `scripts/pg-schema.sql` at startup under a Postgres advisory lock (no cross-instance DDL races). The production image ships the schema file and enables it, so deploys never run against a stale schema.
- **Daily attendance (operational moat)** — Tenant-scoped `attendance` system-of-record: `POST/GET /api/attendance` and `GET /api/attendance/summary/:studentId`. One row per student/day (upsert on re-mark), fail-closed school scoping. The daily-use lock-in loop. (#266)
- **Fee collection + WhatsApp reminders** — Tenant-scoped `fees` (amounts in minor units; pending/paid/waived) with `POST/GET /api/fees`, `/summary`, `/:id/mark-paid`, and `/:id/remind` (sends a fee reminder over the WhatsApp channel). Cross-school guarded. (#269)
- **WhatsApp Business Cloud API integration** — Real Meta Graph API outbound send (falls back to simulation without creds) plus the public inbound webhook (`GET/POST /api/whatsapp/webhook`) with the Meta verification handshake. Configure via `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_VERIFY_TOKEN`. (#213)
- **Feature-usage dashboard** — `feature_usage` tracking + `GET /api/admin/feature-usage` (fail-closed tenant-scoped) to see which features get daily use vs zero; attendance and test-generation instrumented as the first tracked features. (#270)
- **Learner Mastery & Spaced-Repetition dashboard** — New **Progress** tab in the Learn Hub (`/learn?mode=progress`) shows students their per-concept BKT mastery levels, confidence, and SM-2 review schedule (due-now vs. upcoming review cards). Backed by `GET /api/learn/mastery`, which reads the single-writer learner model (`learner_mastery` + `review_schedule`).
- **Gemini provider boot health check** — At startup the server now verifies the Google API key with a lightweight probe and logs a loud, actionable warning when the key is missing or **blocked** (`API_KEY_SERVICE_BLOCKED`), instead of surfacing an opaque 403 deep inside a feature.
- **Web search for AI agents** — New `webSearch` service + `POST /api/ai/web-search`. Works keyless out of the box via DuckDuckGo and transparently upgrades to Tavily or Serper when `TAVILY_API_KEY` / `SERPER_API_KEY` is configured. Completes the last open item in the Study Arena roadmap.

### Changed

- **AI gateway is now the sole chokepoint** — Every AI call (grading, tutor chat, test/lesson generation, study-arena director, SIS enrichment, answer evaluation, PDF extraction) routes through `server/lib/ai/gateway.ts`; no module imports `lib/openai` / `lib/gemini` directly anymore. Adds central per-feature observability and Gemini→OpenAI fallback, and makes model/provider swaps a one-line registry change. (#265, #268)
- **Dashboard cleanup** — Removed dead duplicate pages (`study-arena`, `study-plan`) and extracted a shared `StatCardGrid` component. (#264)

### Fixed

- **Cross-school leaks on student listings** — `GET /api/analytics/students` (previously fully unscoped) and the educator dashboard/students endpoints now fail closed via a shared `resolveTenantScope` guard, matching the admin-dashboard fix.
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
