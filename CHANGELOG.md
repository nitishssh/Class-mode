# Changelog

All notable changes to this project will be documented in this file.

## [1.9.6.0] - 2026-08-30

### Changed

- **The weekly adoption numbers now follow written, versioned rules.** Six choices decide every figure the pilot is judged on — which schools count, which timezone, where a week starts and ends, which week is the baseline, whether two compared weeks are actually adjacent, and what happens to a week that hasn't finished. Those rules are now fixed in one place and stamped onto every weekly snapshot, so a change to any of them has to be declared instead of quietly rewriting the comparison against earlier weeks. The rules are written out in `docs/METRIC-SEMANTICS.md`.
- **Accepting an invitation never alters an existing account.** Previously it could reset that account's password and change its role and school. If the email already has an account, acceptance stops and asks you to sign in with it. Note: linking an invitation to an existing account is not yet supported, so people who already have an account cannot accept one until that flow ships.

### Fixed

- **An invite link could sign you in as someone else.** If an invitation was sent to an email address that already had an account, accepting it logged the sender straight into that account without ever checking a password. Anyone who got hold of the link, including a forwarded email or a shared family inbox, became that user. Invite links can no longer produce a session for an existing account.
- **A second child's invitation no longer overwrites the first.** Student invitations are addressed to the parent, so inviting a second child to the same email used to land on the first child's record and rewrite their name and class, leaving that child's attendance history filed under their sibling. An invitation for an address that already has an account is now refused instead.
- **Invite acceptance no longer reports success when it failed.** If the invitation could not be marked as accepted, the app still replied "account created". It now says what happened and tells you to ask your school to resend.
- **Monday mornings were being counted as the previous week.** Week boundaries were measured in UTC while the schools are on IST, so every mark made before 5:30am IST on a Monday — the start of the school day — landed in the week that had just ended. This understated Mondays and inflated the prior week, on the exact number the September adoption gate reads.
- **A half-finished week can no longer become the baseline.** Running the report mid-week saved that partial week as if it were whole. Because the alert threshold is set at half the baseline, a partial baseline set the bar permanently too low and the alert could never fire. Partial weeks are still recorded, but are now excluded from the baseline and from the two-week check until re-run after the week closes.
- **The two-week alert no longer compares weeks that aren't consecutive.** It previously compared against whatever the most recent saved week happened to be, which could be months earlier, and reported that as two consecutive weeks below target. When there's no adjacent complete week, the check now says it isn't running rather than reporting a breach that never happened.
- **The report now distinguishes "no adoption yet" from "we never finished measuring".** Excluding half-finished weeks from the baseline fixed one silent failure but created another: someone who only ever runs the report mid-week produces nothing complete, so the alert can never arm, and the output looks identical to a pilot that simply has not started. The report now names the unfinished weeks that are holding the baseline back and says a re-run will clear them.
- **A mistyped pilot school code stops the report instead of reading as failure.** Scoping the report to a school that doesn't exist made every number come back zero, which looks identical to a school that did nothing at all.

### Removed

- The `POST /api/invite/accept` and `POST /api/invites/:token/accept` endpoints. Use `POST /api/auth/workspace-invite/signup` for workspace invitations and `POST /api/onboarding/invite/accept` for school invitations.

## [1.9.5.3] - 2026-08-19

### Fixed

- **A console error on every page with a celebration animation is gone.** The confetti library tried to run itself in a background worker built from a blob, which the site's security policy blocks, so it logged a failure and quietly fell back to the main thread. It no longer asks for the worker, and the security policy now states its position on workers explicitly instead of leaving it to a fallback. Confetti looks and behaves the same as before.

## [1.9.5.2] - 2026-08-19

### Changed

- **Dependency updates.** 36 package upgrades, covering the full Dependabot backlog: the Radix UI component set, LangChain, `pg`, `ioredis` 6, `google-auth-library` 11, DOMPurify, cmdk, PostCSS, Prettier and the TypeScript type packages. No downgrades. Five files were reformatted to satisfy the new Prettier release; the change is whitespace only.

## [1.9.5.1] - 2026-08-19

### Fixed

- **Downloading a classroom as a ZIP works again.** The export threw an error on every request. The archiving library had been upgraded to a version that removed the function the code called, but the accompanying type definitions were left a version behind and still described that function as present — so nothing failed to build and the break only appeared when someone actually pressed the button.

## [1.9.5.0] - 2026-08-19

### Fixed

- **Nobody can see conversations they are not part of.** The direct-message list matched participants with a database pattern in which `_` means "any character", so a user numbered 2 was also matched against conversations belonging to users 20, 21 and so on — and the list showed those strangers by name. Two related checks were wrong the same way: one authorised anyone whose id appeared anywhere inside a conversation's identifier, and another let any signed-in account open a conversation between two other people. Participation is now matched exactly, in one place, for the list, the history, sending, and the live connection.
- **Direct messages can actually be opened.** Conversations belong to no workspace, and the screen that loads a conversation's history rejected anything without one — so every conversation refused to open. Sending a message and joining the live connection failed for the same reason, each looking for participants in the wrong format. A conversation you can see is now a conversation you can read and reply to.
- **Direct messages appear again.** The messages screen asked the server for the conversation list at an address the server has never had, so the request failed and the list rendered empty for everyone, with no error shown. It now asks the right address.
- **Conversations show the person's name.** A direct message was titled with the account's username, which is blank for every school-created and invited account — so conversations would have appeared as empty rows. They now show the person's name.
- **Signup no longer claims to have sent a code it couldn't send.** When the provider refuses a message, the verify screen now says the code could not be sent and that checking the inbox won't help, instead of showing "we've dispatched a 4-digit secure code" for a message that never left. The account is still created and saved — only the claim changed.
- **Resending a code reports the real problem.** If the provider is down, pressing Resend now says so. Previously the failure came back as "Not authenticated", which sent a correctly signed-in user off to log in again — something that could never fix it.
- **A missing provider configuration is a failure, not a silent success.** With no credentials set, the server quietly swapped in a stand-in that accepted every message, logged its full contents including the plaintext code, and reported success. In production that reproduced the original fault exactly: a signup told the user a code was on its way when nothing had been sent. Production now treats an unconfigured provider as a delivery failure; local development is unchanged.
- **A stalled provider no longer holds up signup.** Signup now waits for the message to be accepted so it can report the truth, which made the underlying two-minute connection timeout something a person sits through. Waiting is capped so a signup either completes or tells the user it could not send the code, in seconds.
- **Delivery failures are visible in production logs.** Every failure is logged at error level with the kind of message that failed and who it was for, so a dead provider key raises an alert instead of passing silently. Credentials echoed back by the provider are redacted before anything is logged.
- **Signing out clears what was on screen for the previous account.** Server responses already fetched — including the unread notification count — were held in memory for five minutes, keyed without any account identity, so the next person to sign in on a shared device could briefly see the previous account's data. Signing out now discards them, along with the flag that records a code failing to send.
- **The absentee list now says whether parents have been messaged.** The page never mentioned that automatic parent messages are switched off, so a principal could reasonably assume the school had already made contact and skip the calls — the one thing the list is for. It now states plainly, when alerts are off, that nobody has been contacted yet.
- **Copy no longer promises parent alerts that aren't switched on.** The site said parents get a WhatsApp "instantly", "in minutes", and "from the very first morning". Automatic parent messaging is real but is turned on with each school rather than running from day one, so the wording now describes what a school gets on the first morning — the day's absentee call list with every parent's number — and presents WhatsApp alerts as something switched on when the school is ready.
- **The header no longer invents messages and notifications.** A school that had just signed up was shown "3" messages and "5" notifications that did not exist, on two buttons that did nothing when pressed. The bell now shows the real number of unread notifications and nothing at all when there are none, and it opens the notifications page. The message button opens messages; it carries no count, because there is no messages unread total to show yet — an empty space is honest, an invented number is not.
- **A failing at-risk check no longer disappears.** The hourly at-risk student check ran as an uncaught background task, so when it failed the only trace was an anonymous crash line and the check stayed dead until someone read the logs by hand. Failures are now reported with the name of the job, and one bad run no longer decides whether the next hour's run happens.

### Added

- **A programme board.** `docs/PMO.md` records what is in flight, what is blocked on a decision rather than on code, and what is deliberately not being worked on, with the dated milestones each item serves.
- **Shared coordination for the tools that work on this repo.** `scripts/hq-mcp.mjs` and `scripts/discord-notify.mjs` let the assistants working on this project read and post to a shared channel, so work can be claimed and handed over instead of duplicated. Both read their credentials from the environment.

### Changed

- Password reset still answers identically whether or not an account exists, even when the provider is failing. This is deliberately unlike signup: reporting a delivery outcome here would reveal which addresses are registered. The failure is recorded in the logs instead, and the behaviour is now pinned by tests so it cannot be "made consistent" by accident.

## [1.9.4.0] - 2026-08-13

### Added

- **Attendance marks survive a lost signal.** On a patchy connection a teacher's mark is now saved to the device before the network request goes out. If the connection drops, the mark stays queued and syncs automatically the moment the device is back online. Nothing is lost between pressing Save and the network reconnecting.
- **No more double parent-alerts on a retry.** Every attendance save now carries a unique operation ID. If the same save is replayed (offline queue draining after a lost acknowledgement), the server fires parent notifications and adoption tracking exactly once — not twice.
- **Adoption gate is now measurable.** The weekly metrics report now shows a per-teacher × weekday matrix and a pass/fail verdict for the Sep-30 gate (≥60% of teachers marking ≥4 days per week). The number is sourced from the append-only usage log, not the mutable attendance table, so corrections and backfills cannot inflate it.
- **Pilot-school scoping for metrics.** Set `PILOT_SCHOOL_CODE` and every weekly metric — attendance, fees, usage, Study Arena completions and cost — is scoped to that school's cohort. The payment-gate report now cites this school's numbers, not an all-schools aggregate.

### Fixed

- **A read failure can no longer wipe a day's marks.** Previously, if the server failed to return the current attendance for a class, the register silently showed an empty, editable list. A teacher who then pressed Save would overwrite a correctly-recorded day with a blank. The register is now locked and shows a retry prompt until the read succeeds.
- **The save count in the toast is now honest.** The "N students marked" confirmation now uses the server's actual written count. If a stale device clock caused the upsert to skip some rows, the teacher sees the real number, not the submitted count.
- **Offline marks on a shared device are isolated per account.** Queued attendance records are namespaced by user and school. Logging out purges your queue so the next teacher's session cannot see or replay your marks.
- **A transient roster DB fault no longer permanently strands a save.** A database blip that produced an empty student list used to be classified as a permanent rejection, silently dropping the queued save forever. It now surfaces as a transient error and the queue retries it on reconnect.
- **Idempotency keys are scoped per teacher.** The server-side operation-claim table is now keyed by `(op_id, user_id)` so one teacher's retry identifier cannot collide with — or suppress — another teacher's save.
- **Study Arena metrics respect the pilot school filter.** When `PILOT_SCHOOL_CODE` is set, lesson completions and AI cost rows are now filtered to that school's students. Previously those queries aggregated all schools and could cause the payment gate to pass on activity from outside the pilot cohort.

### Changed

- The offline queue only uses a pending queued record as the source of truth for the attendance register. A terminally-rejected record (server declined it permanently) no longer silently seeds the display with its rejected marks.
- `processed_operations` now indexes `created_at` to keep future out-of-band pruning cheap as the table grows.

## [1.9.3.0] - 2026-08-11

### Fixed

- **New teachers can mark the register again.** The "Get started" onboarding panel floated over the attendance screen and physically covered the Present/Absent/Late/Excused buttons, so tapping them did nothing. On a desktop it blocked 6 of the 7 students on screen; on a phone it covered nearly half the display and stayed there as the page scrolled, leaving a teacher unable to finish the register at all without first closing the panel. The panel appears only for teachers in their first week, so the people it stopped were the ones marking their very first register. It no longer opens on the attendance or absentee screens, and returns as soon as the teacher moves to another page.

## [1.9.2.0] - 2026-08-11

### Fixed

- **Assigned Study Arena lessons now actually run.** Every student was blocked from their own lesson: opening a lesson worked, but loading the first step failed, and so did answering, being assessed, and submitting. Two separate faults caused it — student ids arriving from the database as text were compared against numbers and never matched, and the query that advances a lesson to its first scene was rejected outright. Assigned lessons were unusable for every learner before this release.
- **The attempt question is readable in dark mode.** On the attempt card, the question a learner is asked to answer, and their own recorded answer, were near-white text on a near-white panel (about 1:1 contrast). Both now meet accessibility contrast in dark and light themes.
- **Principals can use Study Arena.** A school owner (`school_admin`) hit "Access Denied" on the lesson, report, and create pages, and was refused by the API even though the same role is trusted across attendance, analytics, fees, and exports. School owners can now author lessons, preview them, read their school's reports, and record follow-up. Access stays scoped to their own school, and they still cannot edit another teacher's draft.
- **The teacher and principal evidence report opens.** `/study-arena-report` ignored the assignment in the address bar and always showed its empty "choose an assignment" state, so the report could not be opened by anyone. It now loads the assignment's progress, per-student rows, and adaptive path.

### Changed

- Study Arena authoring and oversight permissions are defined in one place on the server instead of five copies, so the lesson, report, preview, assign, and follow-up surfaces can no longer drift apart.

### Removed

- **A dead end on the evidence report.** The report carried an "Open learner view" button that could never work — it opened the student lesson player, which only students are allowed to start, so every teacher and school owner who clicked it was told "Only assigned students can start a lesson". It went unnoticed because the report page itself could not be opened until this release. Removed rather than shipped as a broken control.

## [1.9.1.1] - 2026-08-05

### Added

- **Adaptive Study Arena (Phase A)** — scene director branches lessons on mastery; concept registry + adaptive recommendations (`continue` / `supported_retry` / `prerequisite_refresh` / `schedule_recall`); server-owned assignment sessions with nonce-checked assessments and teacher reports.
- **Teacher create flow** — four-step `/study-arena/create` with draft → objective/source/assessment approvals → preview → publish (publish blocked until all three approvals).
- **Teacher preview isolation** — preview sessions (`is_preview`) never write learner evidence or mastery.
- **Lesson compiler jobs** — durable fingerprint-deduped compile queue with cancel/retry and sync fallback when Redis is off.
- **Scene a11y contracts** — optional `a11y` on scene actions (name, keyboard, aria-live, text alternative) wired into the player live region.

### Fixed

- Concurrent approval writes no longer drop sibling approvals; compiler enqueue unique races return the in-flight job; cancel after complete cleans orphan drafts.
- Assignment publish/create enrolls only users with `role = 'student'`.

## [1.9.1.0] - 2026-07-31

### Added

- **Study Arena (beta, off by default)** — an attempt-first AI lesson player for students: the lesson pauses at each question until the student genuinely attempts it, and repeated attempts escalate help (nudge → scaffolded hint → reveal and explain back) rather than handing over the answer. Lessons resume where the student left off, behave correctly with a phone keyboard open, and visibly rule out choices already tried. Enabled per-deployment by `STUDY_ARENA_BETA`; **off in production**.
- **Learning activity in personal data exports** — an export now includes `learning-activity.json` alongside the profile, so students' recorded lesson answers carry the same download and deletion guarantees as the rest of their data.
- **Adoption reporting for Study Arena** — `npm run metrics:weekly` reports how many distinct students completed a full lesson and prints the pre-agreed decision rule (≥5 students within 30 days of enabling, else the feature is mothballed).

### Fixed

- **Study Arena never fabricates success and never dead-ends** — a question offering too few choices degrades to free text instead of locking the lesson; a lesson generated with no questions reports an honest failure instead of displaying "Lesson complete"; and errors state what actually happened (session expired, daily AI limit reached, service problem) instead of always blaming the student's topic.

### Changed

- Sign-out no longer passes a deprecated cookie lifetime when clearing auth cookies — Express already expires them immediately, and Express 5 ignores the option. Security and path attributes are unchanged.

### Removed

- **Vendored AI-classroom service tree (~75 MB)** that no part of the application imported. Removing it clears roughly 95 dependency vulnerability alerts, including the only critical one. The MIT/OpenMAIC attribution it carried is preserved at `docs/OpenMAIC-ATTRIBUTION.md`.

### Security

- Dependency advisories for js-yaml, postcss, dompurify, and body-parser resolved. The production dependency tree now reports zero known vulnerabilities.

## [1.9.0.0] - 2026-07-18

### Added

- **Day's absentee call list** (`/absentees`): principals and school admins see every student marked absent today, grouped by class, with tap-to-call parent phone numbers, a printable view, and a date picker. The list refreshes automatically every minute while teachers are still marking. A sidebar "Absentees" link makes it reachable without typing the URL.
- **School data export**: download attendance (with optional date range) and fee records as Excel-compatible CSV files — vernacular names open correctly in Excel, and exported cells are hardened against spreadsheet formula injection.
- Usage instrumentation: attendance and report page visits by staff are now recorded, powering the weekly adoption metrics.

### Changed

- Attendance page copy is now honest about parent notifications: no automation claims while automated WhatsApp alerts remain off. Server-side alert dispatch is additionally gated behind an explicit `WHATSAPP_ALERTS_ENABLED` flag so configuring credentials alone can never silently enable messages to parents.
- Weekly metrics now count attendance by the school day it describes (not the day it was typed), and exclude internal/founder and test activity from adoption numbers.

### Fixed

- Admin-marked attendance no longer saves rows without a school code — the school is derived from the students being marked, and unresolvable writes are rejected instead of silently orphaned.
- **Attendance notes are no longer wiped by a routine re-save**: saving a class's register with statuses only (the web marking page) now preserves any note already stored on a student's record (e.g. entered from the mobile app) instead of silently erasing it.
- **Principals and school admins who joined a school can now send invites** (principals and school admins: teachers; school admins additionally: staff): previously only the account that originally set the school up could send invites — everyone else hit a "Complete school setup first" error. School resolution now falls back to the admin's own linked school (admin roles only), and the pending-invite list no longer exposes the raw invite tokens.
- Attendance and export date inputs reject impossible dates (e.g. 2026-02-31) and inverted ranges (`from` after `to`) with a clear error instead of a server failure or a silently empty file.
- CSV export buttons now show an error message when a download fails instead of silently saving a corrupt file.
- "Today" on the absentees page now uses the device's local date — previously it showed yesterday's list until 5:30 AM IST.
- The weekly adoption report's 50% threshold now arms against the first week with real teacher activity — anchoring on a zero-activity launch week would have left the alert permanently disarmed.

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
