# Class Mode Mobile — Full App Plan (Phases 2–6) — CEO-REVIEWED

Repo: `~/Development/classmode-mobile` (Expo SDK 57, expo-router, RN 0.86, React 19.2, TypeScript 6, zod v3 pinned)
Server: `~/Development/Class-mode` (Express, JWT access via cookie OR `Authorization` header; refresh token httpOnly-cookie-only today)
Production API: `https://classmode.inmodel.in` · Dev: `http://localhost:5001` (override `EXPO_PUBLIC_API_URL`)

## Goal

Ship the iOS + Android companion app for Class Mode so teachers mark attendance in one tap, parents see child status and fees, and principals see a live school dashboard — reaching TestFlight / Play internal testing, with each phase gated on real usage evidence from the pilot school.

## Premises (require user confirmation — Phase 1 gate)

P-1. A native mobile app (not PWA) is the right vehicle now: the repo exists, Phase 1 shipped, and app-store presence supports school sales. (Challenged by outside voice — see D1 gate.)
P-2. Teacher attendance is the wedge; everything else rides on daily marking.
P-3. Two-repo split stays; `Class-mode/shared/` remains the API-contract source of truth.
P-4. WhatsApp automated pipe stays paused until a principal validates willingness-to-pay; mobile UI must be honest about delivery state.
P-5. Pilot market is India: Android-dominant devices, intermittent connectivity, DPDP Act applies (minors' data).

## Server-verified corrections (vs the original draft)

1. **Auth needs a server change.** `POST /api/auth/login` returns only `{ token: accessToken, ...payload }`; the refresh token is set exclusively as an httpOnly cookie, and `POST /api/auth/refresh` (server/routes/auth.ts:840) reads only `req.cookies.refresh_token`. "SecureStore + header auth with no server change" is impossible as drafted. → New server workstream W-1.
2. **Parent linking does not exist.** The only `parentId` write in production code is `parentId: null` (server/routes/auth.ts:226). `GET /api/parent/*` (dashboard/tasks/reports) all filter on `pgFindUsers({ parentId })` and return empty for every real parent. → New server workstream W-3, prerequisite for Phase 4.
3. **Principal aggregates don't exist.** attendance.ts exposes per-class-per-date rows, per-student summary, class list, roster — no coverage-by-class or at-risk aggregation. → New server workstream W-4.
4. **Push sender doesn't exist.** Only the token registry (`POST/DELETE /api/tokens`) is live; no Expo push dependency, sender job, receipt handling, or dead-token pruning anywhere in the server. → New server workstream W-5.
5. **Alert feedback needs a delivery-state signal.** `POST /api/attendance` returns `{ success, written, notified }` where `notified` = absentees with a parentPhone on file (attempted, not delivered). With the pipe paused, rendering this as "N parents notified" would violate the honesty invariant. → New server workstream W-2.

## Server workstreams (land in Class-mode first, shared schemas first)

- **W-1 Mobile auth contract** *(spec reshaped by eng review)*: login/refresh accept + return refresh token in JSON body for mobile clients (`X-Client: mobile`); mobile responses **suppress Set-Cookie entirely** (RN's native cookie jar otherwise keeps `connect.sid`/`refresh_token` alive — logout wouldn't log out, and middleware.ts:91's session fallback would mask token bugs in tests); body token takes precedence over any cookie; same atomic rotation (`consumeSessionByRefreshToken`), plus a lost-response answer (short reuse-grace window or client write-ahead "refresh in flight" marker). Exempt `/api/auth/me` + `/api/auth/refresh` from the coarse 10/min/IP prod-only limiter (index.ts:167 — 30 teachers behind one school NAT trip it in seconds) or key it per-user. Client rule: only a definitive 401 clears SecureStore; 429/5xx/network errors back off and keep tokens. Tests: rotation race, cookie-path regression, **no Set-Cookie on mobile responses**, refresh-5xx-keeps-tokens.
- **W-2 Attendance write + alert honesty contract** *(expanded by eng review)*: (a) fix the mark write path — wrap `pgMarkAttendance`'s per-row loop in one transaction, batch to a multi-row insert, stop swallowing errors (today it catches, returns 0, and the route replies `success:true, written:0` — the client queue would dequeue a lost day of marking on the *success* path); client dequeues only when `written === marks.length`. (b) alert-side-effect discipline — server-side dedupe ledger keyed `(studentId, date)`, dispatch only on *transition to absent*, and delay dispatch past the 5s undo window so a mis-tap never texts a parent; at-least-once queue retries must not re-alert. (c) response/config fields `alerts: { channel, enabled, attempted }` so the app renders honest copy. Tests: same marks POSTed twice → one alert; undo within window → zero alerts; DB failure → non-200.
- **W-6 Tenant write-scope validation (SECURITY — ships first, benefits web too)**: `POST /api/attendance` and `POST /api/fees` never validate that `studentId`s belong to the requester's school/class; the global upsert key `(student_id, date)` lets any teacher overwrite another school's rows. Validate `marks[].studentId ⊆` the tenant-scoped roster (fail closed, 403); same ownership check for fees; server-side date-window validation (reject future dates and >3-days-back for non-admin) — this also gives D-13 real enforcement. Also: mobile roster response strips `parentPhone` (minors'-guardian PII must not sit in plaintext AsyncStorage cache). Authz regression tests: cross-school mark → 403, cross-school fee → 403. *(Also spun off as an immediate Class-mode fix — live vuln independent of this plan.)*
- **W-3 Parent linking**: invite/claim flow keyed on `parentPhone` already stored on student records (admin sends invite → parent account claims child → `parentId` written). Plus parent-facing endpoints: children list with today's status, per-child attendance history, per-child fee summary. Tenant-scoped, fail-closed.
- **W-4 Principal dashboard aggregates**: one endpoint returning today's marking coverage by class, absent counts, unmarked classes, scoped by `schoolCode`; honest empty state when nothing is marked (no fabricated numbers, ISSUE-003/011 discipline).
- **W-5 Expo push sender**: server job consuming the notifications table → Expo Push API; receipts, retry, dead-token pruning; behind env flag. (Powers Phase 4 alerts *in-app*; WhatsApp remains paused.)

## Invariants (non-negotiable)

1. **Tenant isolation**: only `role === "admin"` sees cross-school data; null/absent `schoolCode` fails closed (no data), never open.
2. **Demo-data honesty**: no fabricated numbers to real accounts; empty states are honest.
3. **WhatsApp honesty**: alert feedback reflects true delivery state (W-2); never fake "sent".
4. `src/shared/` is a generated copy — never hand-edit; `zod` stays v3 in both repos.

---

## Phase 2 — Auth & session (blocked by W-1)

- Login screen wired to `POST /api/auth/login`: error states for bad creds (401), account-not-active (403), rate-limited (429 from loginLimiter), network offline, server 5xx.
- Token storage: access + refresh in `expo-secure-store`. API client sends `Authorization: Bearer <access>`; refresh via W-1 body contract.
- Silent refresh: single-flight on 401 → `POST /api/auth/refresh` → retry once; refresh failure → clear SecureStore + context → login. Concurrent-request refresh de-dup (one refresh in flight, others await).
- Session bootstrap: cold start → load tokens → `GET /api/auth/me` → hydrate `SessionProvider` `{ user, role, schoolCode }`; offline cold start with stored tokens → cached session with "offline" banner, no unscoped fetches.
- Fail-closed role routing: `(app)/_layout` redirects unauthenticated → login; tabs from `getTabsForRole`; any screen needing `schoolCode` renders a blocked state when null (never fetches unscoped). `role === "admin"` is the only cross-school role.
- Logout + logout-all clear SecureStore and context.
- Biometric unlock (expo-local-authentication) gating app re-entry after first login. *(accepted expansion E-1)*
- Google OAuth: deferred (password + invite flows cover the pilot).

**Exit metric:** pilot teachers log in on their own devices and stay logged in across a week without re-entering passwords.

## Phase 3 — Teacher attendance wedge (the product)

- Teacher home: today's classes (roster/class endpoints), tap into class roster.
- One-tap marking: default-present roster, tap to toggle absent (long-press for late/excused — matches the web's 4-state model, keeps one-tap primary), "mark all present", submit `POST /api/attendance` **immediately**; haptic tick + "Saved · Undo" snackbar for 5s, undo implemented as a follow-up rewrite (safe because `(className,date)` marking is an upsert) *(accepted expansion E-2, amended by design review D-2/D-8)*.
- Offline/latency: queue the submit locally (AsyncStorage, versioned `{v:1}`) with visible "pending sync" state; retry on reconnect; hard failure surfaces a persistent banner — a day's marking is never silently lost. Queue discipline *(eng review)*: each item carries `markedAt`; items coalesce per `(className, date)` keeping only the newest; server skips stale replays (`markedAt < row.updated_at`) so an 11am reconnect never clobbers a 10am web correction; client dequeues only on `written === marks.length`; app-killed-mid-flush re-sends safely (dedupe ledger absorbs the alert side effect). Offline-first is table stakes in this market (rural connectivity).
- Alert feedback (W-2), state-dependent placement: when alerts are **enabled**, success toast reads "Attendance saved — queued alerts for N parents"; when **disabled**, the toast is simply "Attendance saved — 4 absent" and the disclosure lives as a quiet persistent status line on the class screen ("Parent alerts: off for this school"). Honest both ways, never nags the daily-marking behavior the gate depends on *(design review D-5)*.
- History + correction: per-class date view (GET); corrections are **re-POSTs of the mark endpoint** (there is no attendance PATCH route — the upsert is the correction mechanism), window-limited server-side by W-6's date validation.
- Teacher→class reality *(eng review)*: the server cannot answer "which classes does this teacher teach" (`GET /api/attendance/classes` returns every class in the school; `school_classes.teacher_firebase_uid` is legacy and unwired). **v1 decision: teachers see all school classes sorted by marking status** — the D-4 receipt card anchors on the most-recently-marked or first-unmarked class; proper teacher-class assignment is a deferred TODO (schema + admin UI).
- In-app "report a problem" link (mailto/WhatsApp deep link to founder) *(accepted expansion E-4)*.

**Exit metric / demand gate:** ≥80% of school days marked in-app within 2 weeks at the pilot school, and a principal conversation about paying. Phases 4–6 proceed on evidence, not momentum.

## Phase 4 — Parent & principal views (blocked by W-3, W-4, W-5)

- Parent: children list + per-child today status, attendance history with monthly % chip *(accepted expansion E-3)*, alert history. Parent app installs are a bonus channel — the phone/WhatsApp channel remains the primary alert path (parent-app install rates in this market run 25–40%).
- Principal / school_admin: live dashboard — today's coverage by class, absent counts, unmarked-class nudges (W-4); honest empty state until marking happens.
- Push notifications: `expo-notifications`, register token via existing `POST /api/tokens`, deep-link from notification to child/class screen; sender is W-5.

## Phase 5 — Fees

- Admin (school_admin): fee overview (`GET /api/fees`), create entries (`POST /api/fees`), send reminders (existing reminder route).
- Parent: per-child fee detail (due/paid/history) via W-3 endpoints. No in-app payment in v1 — display + reminders only; payment integration is a TODOS.md item (this is where willingness-to-pay lives — revisit priority after the Phase 3 gate).

## Phase 6 — Release & distribution

- EAS Build: development/preview/production profiles; bundle IDs; icons/splash/branding.
- **Android-first distribution**: Play internal testing with named pilot testers (or direct APK) is the pilot path; TestFlight follows once demand is proven (Apple $99/yr + review friction not needed for an Android-dominant pilot). iOS stays in CI bundle checks either way.
- OTA policy: expo-updates for JS-only fixes; store releases for native changes.
- **Compliance checklist (minors' data)**: Google Play Data Safety form, Families policy self-assessment, Apple privacy nutrition labels (when iOS ships), DPDP Act 2023 posture (children's data, parental consent, no tracking/ads SDKs), privacy policy URL; verify existing GDPR routes map to DPDP needs.
- Store metadata + screenshots.

## Testing

- **Now (Phases 2–3)**: unit tests for token refresh single-flight/rotation, fail-closed role routing (null schoolCode), attendance offline queue (Jest + RNTL added to CI). These guard the tenant-isolation invariant and the wedge.
- **Phase 3 exit**: one Maestro E2E on a real Android device: login → mark class → verify server rows (Maestro over Detox: YAML flows, no native build harness).
- Contract: existing check-shared-drift CI; server-side tests for W-1..W-5 live in Class-mode with its Vitest/Playwright suites.

## Risks

- API contract drift between repos — mitigated by sync-shared CI; every W-* schema lands in Class-mode/shared first, then re-sync.
- Cookie-vs-header divergence — W-1 makes the mobile contract explicit instead of relying on RN's implicit cookie jar.
- Push requires EAS project + physical devices; Expo Go won't exercise push (dev builds needed).
- Commoditized category: attendance apps are table stakes (Teachmint-class ERPs, ParentSync, EduGradUP et al.); differentiation is the honest-alert + fees-linked communication loop, not attendance itself.
- Solo-maintainer surface area: two repos, five phases — the Phase 3 demand gate is the kill-switch against unbounded scope.

## NOT in scope (deferred with rationale)

- In-app fee **payment** (gateway, reconciliation) — where WTP lives, but needs a paying pilot first; TODOS.md.
- WhatsApp automated pipe un-pause — blocked on principal WTP validation (standing decision).
- Google OAuth on mobile — password/invite flows cover pilot users.
- Home-screen widget / app shortcuts — post-wedge polish; TODOS.md.
- Principal daily-digest push (server cron) — new infra; TODOS.md.
- Hindi/vernacular i18n — taste decision at final gate (D3); scaffold cost is low now, real cost is translating every string forever.
- Student-role app surface — students have the web app; mobile student home stays a placeholder.
- iOS TestFlight during pilot — Android-first (taste decision D2).

## What already exists (leverage map)

| Sub-problem | Existing code | Reused? |
|---|---|---|
| Role model + guards | `shared/authz.ts` (USER_ROLES, TENANT_ADMIN_ROLES, isUserRole) synced to mobile | Yes — role routing |
| Access-token header auth | `server/middleware.ts` extractAccessToken (cookie OR Authorization) | Yes — API client |
| Refresh rotation | `storage.consumeSessionByRefreshToken` atomic rotation | Yes — W-1 reuses, adds body transport |
| Attendance mark + tenant scoping | `server/routes/attendance.ts` resolveTenantScope + pgMarkAttendance | Yes — Phase 3 core |
| Absence alert event bus | `attendance.marked` → Redis bus / inline fallback, fail-loud | Yes — W-2 reads its state |
| Push token registry | `POST/DELETE /api/tokens` (notifications.ts) | Yes — Phase 4 |
| Fees CRUD + reminders | `server/routes/fees.ts` | Yes — Phase 5 |
| Web reference UIs | client/src/pages attendance.tsx, fees.tsx, parent-/principal-dashboards | Yes — flow reference, not code |
| Role-aware shell, tabs, theme | mobile `src/lib/role-navigation.ts`, components, theme.ts (dark mode already handled) | Yes — Phase 1 output |
| Pilot seed data | `server/scripts/seed-pilot.ts` | Yes — dev/testing |

## Dream state delta

```
CURRENT STATE                      THIS PLAN                         12-MONTH IDEAL
Web app + paused WhatsApp    --->  Teacher marks in 20s on phone;    School's daily OS: marking →
pipe; mobile repo = shell;        parents/principal see truth        instant parent loop → fee
no mobile auth contract           live; honest alert states;         nudges tied to attendance;
                                  Android pilot in teachers' hands   paying schools; push + WhatsApp
                                                                     channels; app-store presence
```
This plan moves toward the ideal iff the Phase 3 gate passes; the gate is the plan's own kill criterion.

---

# CEO REVIEW (Phase 1 of /autoplan — SELECTIVE EXPANSION, [subagent-only])

## Step 0A — Premise challenge
Premises P-1..P-5 extracted above. P-1 (native now, not PWA) is the contested one: the outside voice argues the responsive web client + add-to-home-screen could test the same wedge with zero store/EAS/dual-repo cost, and only push genuinely requires native. Counterweights: repo + CI + shell already exist (sunk but real momentum), store presence aids school sales, offline queue is materially better native, and the user's stated direction is a native app. P-2..P-5 match standing decisions in project memory. **Premises go to the user gate (D1) — not auto-decided.**

## Step 0B — Existing code leverage
See "What already exists" table above. The plan rebuilds nothing; every phase consumes existing server surface plus five named workstreams (W-1..W-5) that are genuinely new product surface, now stated honestly instead of assumed live.

## Step 0C — Dream state
Diagrammed above. Plan is on-trajectory with the gate as kill-switch.

## Step 0C-bis — Implementation alternatives

```
APPROACH A: Native as originally drafted (phases 2–6 straight through)
  Effort: XL (human ~6-8 wk / CC ~1-2 wk)   Risk: High
  Pros: matches README milestones; no re-planning
  Cons: builds on two false server claims; no demand gates; parent phase has no backend
  Reuses: mobile shell, server routes as-believed (incorrectly)

APPROACH B: PWA-first (responsive web + A2HS for pilot; native later)
  Effort: S (human ~1 wk / CC ~1-2 d)        Risk: Low tech / Med strategic
  Pros: zero store friction, instant OTA, one repo; fastest path to a teacher's thumb
  Cons: contradicts committed direction + sunk Phase 1; weaker offline; no push; re-opens a settled decision
  Reuses: entire web client

APPROACH C: Native, corrected + gated (CHOSEN)
  Effort: L-XL total but sliced (Phase 2+3 ≈ human ~2 wk / CC ~2-3 d)   Risk: Med
  Pros: honors committed direction; fixes false premises via W-1..W-5; Android-first cuts
        release cost ~60%; demand gate caps downside at two phases
  Cons: still native-scale investment ahead of a paying school; two-repo tax continues
  Reuses: everything in the leverage map
```
**RECOMMENDATION: C** — completeness of A's ambition with B's discipline (P1 + P3). A-vs-C is decided; **B remains a live taste option surfaced at the final gate (D1)** because the outside voice pressed it and only one model reviewed.

## Step 0D — SELECTIVE EXPANSION analysis
Complexity check: Phases 2–3 touch ~12 new mobile files + 2 server files (W-1, W-2) — acceptable for an app's first real feature; no smell. Minimum set for the stated goal = Phase 2 + Phase 3 + W-1 + W-2; everything else is staged behind the gate.

10x check: the app as the school's daily operating rhythm — marking is the data entry, the fee-linked communication loop is the product. Platform potential: push registry + sender (W-5) becomes infrastructure for homework, announcements, live-class notifications.

**Cherry-pick decisions (auto-decided per autoplan blast-radius rule):**
| # | Expansion | Effort | Decision | Why |
|---|---|---|---|---|
| E-1 | Biometric unlock after first login | S | **ACCEPTED** | in Phase-2 blast radius, 1 lib + 1 gate component (P2) |
| E-2 | Haptics + undo snackbar on marking | S | **ACCEPTED** | in Phase-3 blast radius, tiny (P2) |
| E-3 | Parent monthly attendance % chip | S | **ACCEPTED** | summary endpoint exists; 1 component (P2) |
| E-4 | In-app "report a problem" link | S | **ACCEPTED** | 30 min; pilot feedback channel (P2) |
| E-5 | Hindi/vernacular i18n scaffold | M | **TASTE → gate D3** | borderline: touches every screen; forever translation tax |
| E-6 | Home-screen widget (today's marking) | M | **DEFERRED → TODOS** | native-module work outside pilot need |
| E-7 | Principal 10am daily-digest push | M | **DEFERRED → TODOS** | needs server cron (new infra) |
| E-8 | In-app fee payment | XL | **DEFERRED → TODOS** | needs paying pilot + gateway compliance first |

## Step 0E — Temporal interrogation
- HOUR 1: W-1 contract shape (body field names, client flag) must be fixed before any mobile auth code — decided in W-1 spec.
- HOUR 2-3: refresh single-flight semantics; offline-queue storage key/versioning; roster pagination (assume ≤60 students/class, no pagination v1 — decided).
- HOUR 4-5: how the app learns alert-enabled state (W-2 in mark response AND /api/auth/config for pre-mark UI — decided: both).
- HOUR 6+: Maestro device matrix (one real Android device is enough for pilot — decided); EAS secrets handling (none needed in-app; API URL is public).

## Step 0F — Mode
SELECTIVE EXPANSION (forced by /autoplan). Committed; no drift.

## Landscape check (WebSearch, 3-layer)
- **L1 tried-and-true**: attendance + parent alerts is a solved, free, bundled feature in Indian school ERPs (Teachmint-class suites, EduGradUP, ParentSync, Teachers App). Offline sync and WhatsApp/SMS alerts are baseline expectations.
- **L2 search signal**: parent apps see 25–40% install rates; WhatsApp ~97% open — the market itself pushes alerts to WhatsApp and keeps apps for staff/admin workflows. Offline-first is marketed as table stakes for rural schools.
- **L3 first principles (eureka)**: the defensible mobile surface is the *staff* side (teacher speed + principal visibility + fee workflows), not the parent app. Parent-app installs as v1 alert channel would be strategically wrong; the plan now treats parent app as bonus, phone/WhatsApp as primary. Logged to eureka.jsonl.

## CEO DUAL VOICES — [subagent-only; Codex not installed]

Claude subagent (independent) returned 10 findings: 2 critical (unvalidated-demand scope; parent backend nonexistent), 4 high (auth premise false; no distribution plan; 6-month solo-maintainer regret; PWA alternative unanalyzed), 4 medium (aggregates/push understated; commoditized category; DPDP/store compliance absent; test ceremony ahead of existence). Findings 2, 3, 7 verified directly in server code and absorbed as W-1..W-5. Findings 1, 4, 5, 6, 8, 10 absorbed as demand gates, Android-first distribution, metrics/kill criteria, approach-B gate option, fees-as-product framing, and right-sized testing.

```
CEO DUAL VOICES — CONSENSUS TABLE:
═════════════════════════════════════════════════════════════════
  Dimension                            Claude   Codex   Consensus
  ──────────────────────────────────── ──────── ─────── ─────────
  1. Premises valid?                   NO(P-1)  N/A     → user gate D1
  2. Right problem to solve?           PARTIAL  N/A     → gate D1 (PWA option)
  3. Scope calibration correct?        NO       N/A     fixed: demand gates
  4. Alternatives sufficiently explored? NO     N/A     fixed: 0C-bis added
  5. Competitive/market risks covered? NO       N/A     fixed: landscape + framing
  6. 6-month trajectory sound?         AT RISK  N/A     fixed: gates + metrics
═════════════════════════════════════════════════════════════════
Single-voice run: no row can be CONFIRMED; all critical findings flagged regardless.
```

## Section 1 — Architecture

```
┌──────────────────────── classmode-mobile (Expo) ────────────────────────┐
│ (public)/login ──▶ SessionProvider ──▶ (app)/_layout [role tabs]        │
│                        │    ▲                │                          │
│   SecureStore ◀────────┘    │           screens: home/attendance/       │
│   (tokens)                  │           people/school/admin             │
│                             │                │                          │
│                    src/lib/api.ts (fetch + zod parse, Bearer header,    │
│                    single-flight refresh, offline queue for POSTs)      │
└───────────────┬──────────────────────────────────────────────┬─────────┘
                │ HTTPS                                        │ Expo Push
┌───────────────▼──────────── Class-mode server ───────────────▼─────────┐
│ /api/auth (login/refresh W-1/me/logout)   /api/tokens (registry)       │
│ /api/attendance (mark+W-2, list, summary, patch)   W-5 push sender     │
│ /api/parent (W-3 linking + child endpoints)  W-4 principal aggregates  │
│ /api/fees   · resolveTenantScope on every route (fail closed)          │
└─────────────────────────────────────────────────────────────────────────┘
```
Coupling: mobile↔server coupled only through synced zod schemas (by design). New coupling: offline queue ↔ mark endpoint idempotency — flagged, resolved by (className,date) upsert semantics of `pgMarkAttendance` (re-submit overwrites same rows; safe). 10x load: a school marking simultaneously is ~40 POSTs/min — nothing breaks; W-4 aggregate query needs an index check in eng review. SPOF: single Cloud Run service, already the web app's posture; no new SPOF. Rollback: mobile = expo-updates rollback (JS) or previous build (native); server W-* behind additive routes/fields — additive-only, no migration risk. **Issues: 1 (idempotency) — resolved in-plan. Auto-decided (P5).**

## Section 2 — Error & Rescue map (registry)

```
CODEPATH                    | WHAT CAN GO WRONG            | CLASS/SIGNAL      | RESCUED? | ACTION / USER SEES
----------------------------|------------------------------|-------------------|----------|--------------------------------------
login()                     | bad creds                    | 401               | Y        | "Wrong email or password"
                            | account suspended/rejected   | 403               | Y        | "Account not active — contact school"
                            | rate limited                 | 429 (loginLimiter)| Y        | "Too many tries — wait a minute"
                            | offline                      | TypeError (fetch) | Y        | "You're offline" + retry
                            | 5xx                          | ApiError          | Y        | "Server problem — try again"
refresh() single-flight     | refresh token rotated away   | 401               | Y        | silent → logout → login screen
                            | concurrent refresh race      | atomic consume    | Y        | losers await winner's token
                            | offline at cold start        | fetch fail        | Y        | cached session + offline banner
apiGet/apiPost zod.parse    | contract drift               | ZodError          | Y        | "App update needed" + report link; NEVER render bad data
attendance submit           | offline / timeout            | queue             | Y        | "Pending sync" chip → auto retry
                            | 400 validation               | ApiError          | Y        | inline field error
                            | queue item fails 3x          | persistent banner | Y        | "Attendance NOT saved — tap to retry" (never silent)
                            | duplicate submit (undo race) | upsert semantics  | Y        | last write wins, same rows
alert feedback (W-2)        | alerts disabled              | enabled:false     | Y        | "No messages sent — alerts not enabled"
push register (P4)          | permission denied            | OS                | Y        | settings deep-link prompt, app still works
SecureStore                 | keychain unavailable (rare)  | throws            | Y        | fall back to login screen, log
GAPS: none accepted. Every row above must exist in code with that copy — carried to eng review test plan.
```

## Section 3 — Security & threat model
- Attack surface: no new server endpoints beyond W-1..W-5 (reviewed in Class-mode with its authz test suite); mobile adds token-at-rest surface → SecureStore (Keychain/Keystore), never AsyncStorage for tokens. Threat: stolen device → biometric gate (E-1) + server logout-all. L:M/I:M mitigated.
- IDOR: parent endpoints (W-3) must filter strictly by `parentId = requester` and student endpoints by tenant scope — carried as explicit W-3 acceptance criteria. L:M/I:H mitigated-by-spec.
- Tenant isolation: mobile never sends schoolCode as a parameter for non-admin roles; server derives from session (`resolveTenantScope`) — matches invariant; null scope fails closed client-side too. L:L/I:H mitigated.
- Secrets: none shipped in the app bundle (API URL is public); EAS secrets only for store signing. No new npm deps beyond expo-secure-store, expo-notifications, expo-local-authentication (first-party Expo). Injection: no webviews, no HTML rendering, zod-validated I/O. Audit: login/refresh already write audit events server-side. **Findings: 2 (IDOR spec, token-at-rest) — both resolved in-plan (P1).**

## Section 4 — Data flow & interaction edge cases
Attendance flow with shadow paths:
```
ROSTER ──▶ TOGGLES ──▶ SUBMIT ──▶ QUEUE ──▶ POST /api/attendance ──▶ FEEDBACK
  │           │           │          │              │                    │
 nil: class  empty:      double-   offline:      401: refresh→retry    enabled:false →
 list empty  0 students  tap:      persist,      400: field errors     honest copy
 → honest    → "no       disable   visible       5xx: stay queued     enabled:true →
 empty state students    while     chip          zod fail: report      "queued for N"
 + refresh   in class"   in-flight              (never silent)
```
Interaction edges: double-submit (disabled while in-flight + upsert), navigate-away mid-submit (queue persists), stale roster (pull-to-refresh; version by date), 10k rows N/A (class ≤ ~60), back-button on Android during undo window (flush queue). Push edges (P4): notification tap when logged out → login → deep-link replay; token rotation on reinstall → re-register on every cold start. **Gaps: 0 unhandled accepted.**

## Section 5 — Code quality
Fits existing patterns: screens under `(app)/`, shared components, `src/lib` for logic — matches Phase 1 conventions. DRY: reuse `apiGet/apiPost` for all calls (no per-screen fetch); role gating goes in one `useRequireRole` hook, not per-screen ifs. Naming: `SessionProvider`, `useSession`, `attendanceQueue` — behavior-named. Over-engineering check: no state library needed (React context + hooks suffice at this screen count) — rejected adding Redux/TanStack Query for now (P5; revisit if server-state caching gets hairy in Phase 4). Under-engineering check: the offline queue must be versioned (`{v:1, items:[...]}`) from day one or migrations get ugly. **Findings: 2 (hook consolidation, queue versioning) — resolved in-plan.**

## Section 6 — Test review (diagram → coverage)
```
NEW UX FLOWS: login, logout, biometric re-entry, mark class, undo, view history,
              correct entry, parent child view (P4), principal dashboard (P4), fees (P5)
NEW DATA FLOWS: token lifecycle, offline queue, alert-state read, push token register
NEW CODEPATHS: single-flight refresh, fail-closed null-schoolCode guard, zod-parse failure path
NEW ASYNC: queue retry loop; (server) W-5 sender job
NEW INTEGRATIONS: Expo Push (P4)
ERROR PATHS: all Section-2 rows
```
Coverage plan: unit (Jest) — refresh single-flight (2am-Friday test: 5 concurrent 401s → exactly 1 refresh call), null-schoolCode fail-closed, queue retry/versioning, zod-failure rendering. Component (RNTL) — login error states, roster toggle/undo. E2E (Maestro, Phase-3 exit) — login→mark→verify. Hostile-QA test: kill app between queue-write and POST; relaunch must re-send exactly once (upsert makes dupes safe). Server W-* tested in Class-mode (rotation race test for W-1 mandatory). Flakiness: no time/random deps; queue tests use fake timers. **Gaps flagged: 0 after plan amendments; full test plan artifact lands in eng review phase.**

## Section 7 — Performance
No N+1 on mobile (single aggregate calls); W-4 must aggregate in SQL, not N queries per class — acceptance criterion. Memory: roster ≤ ~60 rows; FlatList anyway. Caching: session + last-known roster cached for offline view (staleness banner). p99 paths: cold-start bootstrap (me + roster) ~2 RTT on 3G ≈ 2-3s — acceptable; mark submit optimistic so perceived latency ≈ 0. **Findings: 1 (W-4 SQL aggregation) — carried into W-4 spec.**

## Section 8 — Observability
Client: lightweight breadcrumb log (ring buffer) attached to "report a problem" (E-4); zod-parse failures and queue hard-failures logged with route + timestamp (no PII). Server: W-* routes inherit existing request-ID + GCP Error Reporting (PR #314); `pgTrackFeatureUsage` already tracks attendance/notify — add `feature: "attendance_mobile"` tag so pilot adoption (the Phase-3 gate metric!) is measurable from existing analytics. Alert: reuse uptime checks; no new dashboards day-1 beyond feature-usage query. Day-1 questions answerable from logs: "did teacher X's marking reach the server?" (request-ID), "is anyone using the app?" (feature tag). **Gap found + fixed: without the usage tag, the demand gate would be unmeasurable (P1).**

## Section 9 — Deployment & rollout
No DB migrations in W-1/W-2 (behavioral + response fields); W-3 adds parentId writes (column exists) + possibly an invite table — AUTO_MIGRATE at boot per existing pipeline; additive only. Order: server W-* deploy first (additive, web unaffected), mobile consumes after re-sync. Old-app/new-server always compatible (additive fields); new-app/old-server prevented by shipping app only after W-* verified in prod (deploy-verification memory: JSON flip + uptime reset). Feature flag: W-5 sender behind env. Post-deploy: health check + one scripted login/refresh against prod before any build ships to testers. Rollback: server revert = git revert (additive); app = expo-updates republish. **Risks flagged: 1 (ship-order discipline) — encoded as rule above.**

## Section 10 — Long-term trajectory
Debt introduced: sync-shared duplication tax (accepted, standing decision); offline queue is bespoke (revisit TanStack Query + persister if it grows). Path dependency: W-1's mobile auth contract is the durable interface — worth the spec care now. Reversibility: 4/5 (all additive; app can be shelved without server damage). 1-year read: phases map to milestones; W-* named and testable — a new engineer can follow. Platform potential: W-5 push infra serves every future notification feature. **Debt items: 2, both accepted consciously.**

## Section 11 — Design & UX
Information hierarchy: teacher home = today's classes + one-tap continue (speed is the product); parent home = child status first, history second; principal = coverage % first, unmarked classes second. State coverage map (every feature): LOADING skeleton / EMPTY honest / ERROR named copy / SUCCESS haptic / PARTIAL "pending sync" — the offline chip is the signature interaction. Journey arc: teacher: open→glance→tap→done in <20s, undo as safety; parent: anxiety→answer ("is my kid in school?") in one screen. AI-slop risk: medium — placeholder copy in `ROLE_HOME_COPY` must be replaced with real content, not generic dashboard-ese; roster rows need student-name-first typography, not card grids. Accessibility: touch targets ≥44pt on roster toggles (teachers use it walking), contrast via existing theme, dynamic type on roster. Screen-flow diagram:
```
login ─▶ (app) home[role] ─▶ teacher: classes ─▶ roster ─▶ submit ─▶ feedback
   │                    └▶ parent: children ─▶ child detail (status|history|fees)
   └ biometric re-entry └▶ principal: dashboard ─▶ class drill-down
```
**Recommendation honored: full /plan-design-review runs as autoplan Phase 2.** Findings: 2 (copy honesty, touch targets) — resolved in-plan.

## Failure Modes Registry
```
CODEPATH            | FAILURE MODE              | RESCUED? | TEST? | USER SEES?          | LOGGED?
--------------------|---------------------------|----------|-------|---------------------|--------
refresh singleflight| rotation race             | Y        | Y     | nothing (silent OK) | Y
attendance queue    | 3x retry exhausted        | Y        | Y     | persistent banner   | Y
attendance queue    | app killed mid-flush      | Y        | Y     | re-send on launch   | Y
zod parse           | contract drift            | Y        | Y     | update prompt       | Y
alert feedback      | pipe paused               | Y        | Y     | honest copy         | Y
push register       | permission denied         | Y        | Y     | prompt + degrade    | Y
session bootstrap   | offline cold start        | Y        | Y     | cached + banner     | Y
W-4 aggregates      | zero marks today          | Y        | Y     | honest empty state  | Y
CRITICAL GAPS: 0 (every row rescued + tested + visible)
```

## Implementation Tasks (CEO phase)
- [ ] **T1 (P1, human: ~1d / CC: ~1h)** — server — Ship W-1 mobile auth contract (body refresh + rotation tests)
  - Surfaced by: correction 1 — refresh is cookie-only (auth.ts:840)
  - Files: Class-mode/server/routes/auth.ts, shared/schema.ts, server/tests/auth_routes.test.ts
  - Verify: curl login with mobile flag returns refreshToken in body; rotation race test green
- [ ] **T2 (P1, human: ~2h / CC: ~20min)** — server — Ship W-2 alert-honesty fields on mark response + config
  - Surfaced by: correction 5 + WhatsApp honesty invariant
  - Files: Class-mode/server/routes/attendance.ts, routes/auth.ts (config), shared schemas
  - Verify: response contains alerts{enabled,attempted}; UI copy switches on it
- [ ] **T3 (P1, human: ~2d / CC: ~3h)** — mobile — Phase 2 auth: SecureStore, single-flight refresh, SessionProvider, fail-closed routing, biometric gate
  - Surfaced by: Phase 2 spec + Sections 2/3
  - Files: src/lib/api.ts, src/lib/session.tsx (new), src/app/(public)/login.tsx, (app)/_layout.tsx
  - Verify: unit tests (refresh race, null schoolCode) + manual login on device
- [ ] **T4 (P1, human: ~3d / CC: ~4h)** — mobile — Phase 3 attendance: roster marking, offline queue v1, undo, honest alert feedback, history+PATCH correction
  - Surfaced by: Phase 3 spec + Sections 4/6
  - Files: src/app/(app)/attendance.tsx + new components, src/lib/attendance-queue.ts
  - Verify: queue kill-test, Maestro login→mark flow, server rows verified
- [ ] **T5 (P2, human: ~1h / CC: ~10min)** — server — Tag mobile feature usage (attendance_mobile) so the Phase-3 demand gate is measurable
  - Surfaced by: Section 8 gap
  - Files: Class-mode/server/routes/attendance.ts (or header-driven tag)
  - Verify: feature_usage rows distinguish mobile
- [ ] **T6 (P2, human: ~4d / CC: ~6h)** — server — W-3 parent linking + child endpoints; W-4 principal aggregates (SQL, tenant-scoped, IDOR tests)
  - Surfaced by: corrections 2-3
  - Files: Class-mode/server/routes/parent.ts, attendance.ts, shared schemas, tests
  - Verify: parent sees only own children (authz test), aggregates honest-empty
- [ ] **T7 (P2, human: ~2d / CC: ~3h)** — server+mobile — W-5 Expo push sender + expo-notifications registration + deep links
  - Surfaced by: correction 4
  - Files: Class-mode/server/services (new sender), mobile notifications module
  - Verify: real-device push received; dead-token pruned on receipt error
- [ ] **T8 (P2, human: ~2d / CC: ~3h)** — mobile — Phase 5 fees screens (admin overview/create/remind; parent detail)
  - Surfaced by: Phase 5 spec
  - Files: src/app/(app)/admin.tsx, people/child detail
  - Verify: RNTL states + manual against seeded fees
- [ ] **T9 (P2, human: ~2d / CC: ~4h)** — release — EAS profiles, Android internal-testing distribution, compliance checklist (Play Data Safety, DPDP), OTA policy
  - Surfaced by: Phase 6 spec + finding 9
  - Files: eas.json, app.json, store metadata
  - Verify: pilot tester installs from Play internal track
- [ ] **T10 (P3, human: ~1d / CC: ~2h)** — mobile — Jest+RNTL CI wiring and the Section-6 unit suites
  - Surfaced by: Section 6
  - Files: package.json, ci workflow, __tests__/
  - Verify: npm test green in CI

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 1 | 0 | Skip /office-hours prereq | Mechanical | P6 | autonomous run; premises captured in-plan for gate | inline office-hours |
| 2 | 0 | DX scope = NO | Mechanical | P3 | end-user app; API is internal contract, not dev product | running Phase 3.5 |
| 3 | 0 | Mode = SELECTIVE EXPANSION | Mechanical | autoplan | forced by pipeline | — |
| 4 | 1 | Approach C (native, corrected+gated) | **TASTE → D1** | P1+P3 | honors user direction; fixes false premises; gates downside | A (as-drafted); B (PWA) kept as gate option |
| 5 | 1 | Add W-1 mobile auth contract | Mechanical | P1 | verified: refresh is cookie-only | relying on RN cookie jar |
| 6 | 1 | Add W-3 parent linking as Phase-4 prerequisite | Mechanical | P1 | verified: parentId never written | claiming parent API "live" |
| 7 | 1 | Add W-4 aggregates workstream | Mechanical | P1 | verified: no aggregate endpoint | client-side aggregation (N calls) |
| 8 | 1 | Add W-5 push sender workstream | Mechanical | P1 | verified: registry only | "small job" hand-wave |
| 9 | 1 | Add W-2 alert-honesty contract | Mechanical | P1 | invariant; `notified` = attempted only | rendering notified as "sent" |
| 10 | 1 | Android-first pilot distribution | **TASTE → D2** | P3 | Android-dominant pilot; cuts release cost | simultaneous TestFlight |
| 11 | 1 | Parent app = bonus channel; phone/WhatsApp primary | Mechanical | P1+L3 | 25-40% install rates; honesty invariant | parent-app-as-alert-channel |
| 12 | 1 | Demand gate after Phase 3 (≥80% marking days, principal WTP talk) | Mechanical | P6+P2 | kill criterion for solo-maintainer scope | unbounded phases |
| 13 | 1 | Testing right-sized: unit now, 1 Maestro at P3 exit | Mechanical | P3+P5 | guards invariants without ceremony | full Detox suite now |
| 14 | 1 | DPDP/Play compliance checklist in Phase 6 | Mechanical | P1 | minors' data; store tripwire | privacy-policy-URL-only |
| 15 | 1 | E-1..E-4 accepted; E-6..E-8 deferred to TODOS | Mechanical | P2 | blast-radius + <1d rule applied per item | — |
| 16 | 1 | E-5 Hindi i18n scaffold | **TASTE → D3** | — | low scaffold cost vs forever translation tax | — |
| 17 | 1 | No state library (context+hooks) | Mechanical | P5 | screen count small; explicit over clever | Redux/TanStack now |

## CEO Completion Summary

```
+====================================================================+
|            MEGA PLAN REVIEW — COMPLETION SUMMARY (CEO)             |
+====================================================================+
| Mode selected        | SELECTIVE EXPANSION (autoplan-forced)       |
| System Audit         | clean repo, 5 commits, 0 TODO debt          |
| Step 0               | 5 premises named; approach C chosen; B live |
| Section 1  (Arch)    | 1 issue (idempotency) — resolved            |
| Section 2  (Errors)  | 14 error paths mapped, 0 GAPS               |
| Section 3  (Security)| 2 issues, 0 High unmitigated                |
| Section 4  (Data/UX) | 9 edge cases mapped, 0 unhandled            |
| Section 5  (Quality) | 2 issues — resolved in-plan                 |
| Section 6  (Tests)   | Diagram produced, 0 open gaps               |
| Section 7  (Perf)    | 1 issue → W-4 acceptance criterion          |
| Section 8  (Observ)  | 1 gap (usage tag) — fixed, gate measurable  |
| Section 9  (Deploy)  | 1 risk (ship order) — encoded as rule       |
| Section 10 (Future)  | Reversibility: 4/5, debt items: 2 accepted  |
| Section 11 (Design)  | 2 issues — resolved; full review = Phase 2  |
+--------------------------------------------------------------------+
| NOT in scope         | written (8 items)                           |
| What already exists  | written (10 rows)                           |
| Dream state delta    | written                                     |
| Error/rescue registry| 8 codepaths, 0 CRITICAL GAPS                |
| Failure modes        | 8 total, 0 CRITICAL GAPS                    |
| TODOS.md updates     | 3 items deferred (E-6, E-7, E-8)            |
| Scope proposals      | 8 proposed, 4 accepted, 3 deferred, 1 gate  |
| CEO plan             | this document (SELECTIVE EXPANSION)         |
| Outside voice        | ran (claude subagent; codex not installed)  |
| Lake Score           | 12/13 recommendations chose complete option |
| Diagrams produced    | 4 (architecture, data flow, screens, dream) |
| Stale diagrams found | 0 (no prior diagrams in repo)               |
| Unresolved decisions | 3 → final gate (D1 premise/PWA, D2, D3)     |
+====================================================================+
```

---

# DESIGN REVIEW (Phase 2 of /autoplan — [subagent-only])

Classifier: **APP UI** (task-focused, data-dense; App UI hard rules apply — calm surfaces, few colors, cards only when the card IS the interaction, utility copy).
Initial design completeness: **5/10** — failure states specified better than success states; the screens users stare at 95% of the time had one clause each. A 10 for this plan = every role's default screen specified for its *dominant* state (not just first-run), a semantic color system, and the parent first-run flow designed.
DESIGN.md: **none in either repo** — flagged; universal principles + App UI rules used; `/design-consultation` recommended (TODO).
Mockups: designer available but the comparison-board feedback loop cannot be auto-decided (variant choice is never auto-decidable) — **deferred to /design-shotgun** before implementing T4's screens.

## Design amendments (all accepted, absorbed into phase specs above)

- **D-1 Parent "not marked yet" state (CRITICAL)**: first-class third status every morning before marking: calm gray "Attendance not taken yet — Class 5B usually marks by 9:15" (marking-time hint from server history when available; plain "not yet marked today" otherwise). Added to error registry. Never renders as absent, blank, or broken.
- **D-2 Status model decided**: web supports present/absent/late/excused; mobile keeps one-tap binary primary + **long-press for late/excused**. History/correction can then render and edit all four. *(taste → final gate D4)*
- **D-3 Parent claim flow is mobile scope (CRITICAL)**: named screen in Phase 4 — claim child via school-issued code tied to `parentPhone` (W-3); error states: wrong code, phone mismatch, already claimed. Unlinked-parent home = "Link your child — enter the code from your school" as the whole screen, not an empty list.
- **D-4 Teacher home = receipt card**: single-class teachers get one dominant card: pre-marking "Class 5B · 32 students · Not marked yet → Mark now"; post-marking it becomes the all-day receipt: "Marked at 8:42 · 28 present, 4 absent · [alert status] · Edit". Multi-class teachers get the card list in marking-status order.
- **D-5 Alert honesty placement**: absorbed above (toast when enabled, persistent quiet status line when disabled).
- **D-6 Forgot password + credential type**: login = **email** + password (loginSchema); "Forgot password?" opens the web reset flow in the system browser. Phase 2 scope.
- **D-7 Semantic color tokens before T4**: extend `theme.ts` `Colors` with `success/danger/warning/pending` (light+dark, sunlight-legible contrast ≥4.5:1); inline hex in screens forbidden (login.tsx's `#F6C945` migrates). New task T-D1.
- **D-8 Undo contradiction resolved**: submit immediately, undo = follow-up rewrite (absorbed above).
- **D-9 Principal time-awareness**: pre-marking state sets expectations ("Marking usually completes by 9:30 — 2 of 6 classes done"); v1 "nudge" is **display-only** (unmarked classes listed above the coverage stat — the principal's question is "who do I chase"). Tap-to-remind deferred (would need W-5 scope).
- **D-10 Web reference blacklist**: `attendance.tsx` is the good reference (real states, honest empty, permission handling). **`parent-dashboard.tsx` is an anti-pattern** — it fabricates children/charts (the ISSUE-003/011 violation) and must not be replicated. `principal-dashboard.tsx`'s gradient stat-cards are dashboard-ese; don't port.
- **D-11 Teacher tabs**: rename Attendance tab → **History** (Home is the marking surface per D-4; second tab gets a distinct job).
- **D-12 Push permission timing + absence landing**: ask in context (parent, after first successful child-status view: "Get notified if [name] is marked absent"), never at cold launch. Absence-notification landing screen includes recourse: "Think this is a mistake? Call the school office" (school phone from tenant record).
- **D-13 Backfill + timezone**: mobile can mark/correct up to **3 days back**; older is read-only with "use the web app" copy. "Today" is server/school-timezone authoritative, never device clock.
- **D-14 Biometric fallback**: `expo-local-authentication` with device-credential fallback (PIN/passcode); no biometrics enrolled → skip the gate entirely (never build a custom PIN).

## Interaction state coverage (per feature, what the user SEES)

```
FEATURE            | LOADING          | EMPTY                        | ERROR                  | SUCCESS                 | PARTIAL
-------------------|------------------|------------------------------|------------------------|-------------------------|------------------
Teacher home       | skeleton card    | "No classes assigned — ask   | named copy + retry     | receipt card (D-4)      | "pending sync" chip
                   |                  |  your school admin"          |                        |                         |  on receipt card
Roster marking     | skeleton rows    | "No students in this class"  | banner, marks kept     | Saved · Undo (D-8)      | queued state visible
Parent child view  | skeleton         | unlinked → claim screen (D-3)| named copy + retry     | today status + % chip   | "not marked yet" (D-1)
Principal dashboard| skeleton         | pre-marking expectation (D-9)| named copy + retry     | coverage + chase list   | some classes marked
Fees (admin)       | skeleton table   | "No fee entries yet — create | named copy             | list + created toast    | reminder send status
                   |                  |  the first one"              |                        |                         |
Fees (parent)      | skeleton         | "No dues recorded"           | named copy             | due/paid clearly split  | —
Login              | button spinner   | —                            | 401/403/429/offline    | route to role home      | —
```

## User journey arcs
- **Teacher**: open → glance (receipt card answers "did I mark?") → tap → 20s marking → Saved·Undo → done. Day-12 emotion: routine, not nagged (D-5). Break fixed: post-marking state existed nowhere before D-4.
- **Parent**: anxiety → one screen answers "is my kid in school?" → D-1 keeps 8:30am truthful and calm; first push is contextual (D-12) so the scariest moment (absence alert) carries a next action.
- **Principal**: open at 9:00 → expectation-framed coverage (D-9) → chase list → done. Trust never hits a fabricated number.

## Litmus scorecard (App UI) — [subagent-only]

```
DESIGN DUAL VOICES — LITMUS SCORECARD:
═══════════════════════════════════════════════════════════════
  Check                                Claude   Codex   Consensus
  ──────────────────────────────────── ──────── ─────── ─────────
  1. Product unmistakable first screen YES(D-4) N/A     flagged OK
  2. One strong visual anchor          YES(receipt card) N/A  OK
  3. Understandable by scanning        YES(after D-1/D-9) N/A OK
  4. Each section has one job          YES(D-11 fixed overlap) N/A OK
  5. Cards actually necessary          YES(card=receipt=interaction) N/A OK
  6. Motion improves hierarchy         PARTIAL(haptic+snackbar only; fine for v1) N/A OK
  7. Premium without decorative shadows YES(calm neutral+4 semantic tokens) N/A OK
═══════════════════════════════════════════════════════════════
Hard-rejection scan: no card-grid mosaics, no gradient stat tiles (D-10 blacklists the
web ones), no placeholder-as-label forms (login must keep visible labels), no
purple-gradient slop. PASS.
```

## Pass ratings

| Pass | Before | After | Notes |
|---|---|---|---|
| 1 Info architecture | 6 | 9 | D-4/D-9/D-11; hierarchy now specified for dominant states |
| 2 State coverage | 7 | 9 | D-1/D-3 filled the two real gaps; table above |
| 3 Journey & arc | 6 | 9 | D-5/D-12 fixed day-12 nagging + scariest-moment recourse |
| 4 AI slop risk | 6 | 9 | D-10 blacklist + D-7 token discipline make it enforceable |
| 5 Design system | 3 | 7 | Semantic tokens added; no DESIGN.md → /design-consultation TODO |
| 6 Responsive & a11y | 5 | 8 | 44pt targets, dynamic type on roster, contrast ≥4.5:1 on tokens, toggle rows get accessibility labels ("Asha Kumar, present, double-tap to mark absent") |
| 7 Unresolved decisions | — | 12 resolved / 2 deferred | D4 (status model) to gate; mockups to /design-shotgun |

Overall: **5/10 → 8.5/10**. Below-8 remainder: no DESIGN.md (deferred to /design-consultation) and unvalidated visuals (deferred to /design-shotgun).

## Design tasks
- [ ] **T-D1 (P1, human: ~2h / CC: ~20min)** — mobile — Semantic color tokens + inline-hex purge (D-7); Files: src/constants/theme.ts, src/app/(public)/login.tsx
- [ ] **T-D2 (P1, folds into T4)** — mobile — Teacher receipt-card home + History tab rename (D-4, D-11); Files: src/app/(app)/index.tsx, src/lib/role-navigation.ts
- [ ] **T-D3 (P1, folds into T6)** — server+mobile — Parent claim-flow screen + unlinked empty state (D-3); marking-time hint in W-4/W-3 payloads (D-1, D-9)
- [ ] **T-D4 (P2, folds into T4)** — mobile — Long-press late/excused + 3-day backfill + server-timezone authority (D-2, D-13)
- [ ] **T-D5 (P2, folds into T7)** — mobile — In-context push permission + absence-landing recourse screen (D-12)
- [ ] **T-D6 (P3)** — repo — Run /design-consultation to produce DESIGN.md; then /design-shotgun for the three core screens before T4 UI work

## Decision Audit Trail (Phase 2 additions)

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 18 | 2 | Accept D-1, D-3..D-14 (13 design amendments) | Mechanical | P1+P5 | each closes a state/flow gap with an explicit spec | leaving to implementer improvisation |
| 19 | 2 | D-2 long-press late/excused | **TASTE → gate D4** | P1 | preserves web parity + one-tap speed | binary-only v1 |
| 20 | 2 | Defer mockups to /design-shotgun | Mechanical | pipeline | board feedback loop is never auto-decidable | generating unreviewable variants |
| 21 | 2 | No DESIGN.md → recommend /design-consultation | Mechanical | P1 | system-level gap, separate scope | inventing a design system inline |

---

# ENG REVIEW (Phase 3 of /autoplan — [subagent-only])

## Step 0 — Scope challenge
Leverage and minimum-set were settled in Phase 1 (approach C). Complexity check: Phases 2–3 now touch ~12 mobile files + ~5 server files across two repos with W-6 added — above the 8-file smell threshold, but the expansion is security- and correctness-driven, not feature creep; reduction would reintroduce the exact silent failures this review found. Proceeding (autoplan P1: never reduce). Search check: SecureStore/expo-notifications/local-authentication are Layer-1 (first-party Expo built-ins) — no custom crypto or push transport rolled. Distribution check: EAS pipeline is Phase 6 scope, explicitly planned, Android-first. **[EUREKA]** logged in Phase 1 stands.

## Independent eng voice — 16 findings, key ones verified in code

| # | Sev | Conf | Finding | Disposition |
|---|-----|------|---------|-------------|
| 1 | P1 | 10/10 ✅verified | `pgMarkAttendance` catches errors → returns 0; route replies `success:true, written:0`; per-row loop, no transaction — queue would discard a day's marking on the success path | → W-2(a); tests added |
| 2 | P1 | 9/10 ✅verified | Cross-tenant write: `marks[].studentId` unvalidated; global upsert key overwrites other schools' rows; same in fees | → **W-6** + immediate Class-mode spin-off task |
| 3 | P1 | 9/10 | Undo + at-least-once retries send duplicate/false absence alerts (inline dispatch, no dedupe) | → W-2(b) dedupe ledger, transition-only, post-undo dispatch |
| 4 | P1 | 9/10 | Plan treated every refresh failure as fatal; transient 5xx/429 would wipe tokens; consumed-token/lost-response race | → W-1 reshape (401-only clears; grace window) |
| 5 | P1 | 8/10 ✅verified | Global `/api/auth` limiter 10/min/IP (prod-only, invisible in dev) breaks one school on shared WiFi | → W-1 (exempt /me,/refresh or per-user key) |
| 6 | P1 | 9/10 | RN cookie jar + session fallback (middleware.ts:91) defeats header-auth model; logout wouldn't log out | → W-1 (suppress Set-Cookie, body precedence, no-Set-Cookie test) |
| 7 | P2 | 8/10 | Stale offline replay clobbers newer corrections (last-write-by-arrival) | → queue `markedAt` + server stale-skip |
| 8 | P2 | 10/10 | E-3 parent % chip premise false: summary endpoint is staff-only, no ownership check; `/api/parent` requires verified email — unverified parents get 403 everywhere | → E-3 re-costed into W-3; resend-verification screen added to claim flow |
| 9 | P2 | 8/10 | Teacher→class assignment doesn't exist server-side; D-4 receipt card assumption broken | → v1 all-classes decision (body amended); assignment → TODO |
| 10 | P2 | 8/10 | Roster cache would put minors' names + parentPhone in plaintext AsyncStorage | → W-6 strips parentPhone from mobile roster |
| 11 | P2 | 9/10 | "Server/school-timezone authoritative" had zero server support; no date-window validation | → W-6 date-window validation; timezone claim dropped |
| 12 | P3 | 10/10 | Plan referenced a nonexistent attendance PATCH route | → body corrected (corrections = re-POST) |
| 13 | P3 | 9/10 | Dep list understated: needs async-storage, expo-haptics, expo-updates, jest-expo, RNTL | → deps list corrected below |
| 14 | P3 | 9/10 | `apiGet(path, schema)` needs response schemas that exist for no endpoint yet; `authMePayload` returns snake_case `school_code` — careless mapping = fail-closed blocks every screen | → W-R response-schema workstream + mapping test |
| 15 | P2 | — | Seven missing tests incl. airplane-mode Maestro E2E for the offline wedge | → test plan updated |
| 16 | P3 | 7/10 | Per-request double DB lookup + session write in `authenticateToken`; 60 sequential INSERTs per class submit | → W-2(a) batching; middleware session-write noted as web-shared debt (TODO) |

**New shared workstream W-R (response schemas)**: every endpoint the app consumes needs a zod *response* schema authored in `Class-mode/shared/` first (me, roster, classes, attendance rows/summary, fees, parent children, W-4 aggregates) — `shared/schema.ts` today has insert/input schemas only. Includes the `school_code → schoolCode` mapping with a unit test (a silent `undefined` here fail-closes the whole app — correct per invariant, but 100% broken UX).

**Mobile dependency list (corrected)**: expo-secure-store, expo-notifications, expo-local-authentication, expo-haptics, expo-updates (all first-party) + @react-native-async-storage/async-storage (community) + dev: jest-expo, @testing-library/react-native, maestro (CLI).

```
ENG DUAL VOICES — CONSENSUS TABLE:
═════════════════════════════════════════════════════════════════
  Dimension                            Claude    Codex   Consensus
  ──────────────────────────────────── ───────── ─────── ─────────
  1. Architecture sound?               NO→fixed  N/A     W-1 reshaped (cookies, limiter)
  2. Test coverage sufficient?         NO→fixed  N/A     7 tests added incl. offline E2E
  3. Performance risks addressed?      PARTIAL→fixed N/A batching+transaction in W-2(a)
  4. Security threats covered?         NO→fixed  N/A     W-6 added; live vuln spun off
  5. Error paths handled?              NO→fixed  N/A     success:true/written:0 contract fixed
  6. Deployment risk manageable?       YES       N/A     additive; ship-order rule stands
═════════════════════════════════════════════════════════════════
Single-voice run: no row can be CONFIRMED; all P1 findings verified directly in code
by the orchestrator before absorption (findings 1, 2, 5 quoted above).
```

## Test coverage diagram (target state for Phases 2–3)

```
CODE PATHS                                                USER FLOWS
[+] src/lib/api.ts + session.tsx                          [+] Login
  ├── singleFlightRefresh()                                 ├── [PLAN ★★★] happy → role home
  │   ├── [PLAN ★★★] 5 concurrent 401s → 1 refresh call    ├── [PLAN ★★★] 401/403/429/offline/5xx copy
  │   ├── [PLAN ★★★] refresh 5xx/429 → tokens KEPT         └── [PLAN ★★ ] forgot-password → web reset
  │   ├── [PLAN ★★★] definitive 401 → logout             [+] Mark attendance (the wedge)
  │   └── [PLAN ★★ ] lost-response race (grace/write-ahead) ├── [PLAN ★★★→E2E] Maestro: login→mark→verify rows
  ├── schoolCode mapping (snake→camel)                      ├── [PLAN ★★★→E2E] Maestro AIRPLANE MODE: mark
  │   └── [PLAN ★★★] null → fail-closed blocked state      │    offline → relaunch → reconnect → rows verified
  └── zodParse failure → update prompt                      ├── [PLAN ★★★] double-submit disabled in-flight
      └── [PLAN ★★★] malformed response → report link      ├── [PLAN ★★★] undo within 5s → zero alerts (server test)
[+] src/lib/attendance-queue.ts                             └── [PLAN ★★★] kill mid-flush → exactly-once effect
  ├── [PLAN ★★★] dequeue only when written===marks.length [+] Parent
  ├── [PLAN ★★★] coalesce per (className,date)              ├── [PLAN ★★ ] not-marked-yet morning state
  ├── [PLAN ★★★] 3x fail → persistent banner               └── [PLAN ★★ ] unlinked → claim screen errors
  └── [PLAN ★★ ] stale replay rejected (server test)      [+] Server (Class-mode suites)
[+] role routing                                            ├── [PLAN ★★★] W-6 cross-school mark/fee → 403
  └── [PLAN ★★★] null schoolCode fail-closed per role      ├── [PLAN ★★★] W-2 dupe POST → one alert
                                                            ├── [PLAN ★★★] DB fail → non-200 (no success:0)
                                                            └── [PLAN ★★★] W-1 no Set-Cookie on mobile
COVERAGE TARGET: 24/24 planned paths specified | GAPS: 0 open (all absorbed into T-tasks)
LOAD: 30-devices-one-IP limiter test (staging, NODE_ENV=production) — W-1 acceptance
```

## Eng tasks (delta over T1–T10 / T-D1–T-D6)
- [ ] **T-E1 (P1, human: ~1d / CC: ~2h)** — server — W-6 tenant write-scope validation + date window + parentPhone strip + authz tests *(also spun off for immediate fix)*
- [ ] **T-E2 (P1, human: ~1d / CC: ~2h)** — server — W-2(a) transaction + batch insert + honest failure status; client dequeue contract
- [ ] **T-E3 (P1, human: ~1d / CC: ~2h)** — server — W-2(b) alert dedupe ledger, transition-only dispatch, post-undo-window delay
- [ ] **T-E4 (P1, human: ~1d / CC: ~2h)** — server — W-1 reshape: Set-Cookie suppression, body precedence, limiter exemption, grace window, no-Set-Cookie test
- [ ] **T-E5 (P1, human: ~2d / CC: ~3h)** — shared — W-R response schemas for all consumed endpoints + snake→camel mapping test
- [ ] **T-E6 (P2, human: ~1d / CC: ~2h)** — mobile+server — queue markedAt/coalescing + server stale-skip; airplane-mode Maestro flow
- [ ] **T-E7 (P2, human: ~2h / CC: ~30min)** — mobile — resend-verification screen in parent claim flow (verifiedAuth 403 path)

## Decision Audit Trail (Phase 3 additions)

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 22 | 3 | Add W-6 security workstream + immediate spin-off | Mechanical | P1 | verified live cross-tenant vuln | deferring to mobile timeline |
| 23 | 3 | W-2 expanded (transaction, dedupe ledger, transition-only alerts) | Mechanical | P1 | verified success:true/written:0; at-least-once re-alerts | trusting upsert for side effects |
| 24 | 3 | W-1 reshaped (no Set-Cookie, 401-only logout, limiter fix) | Mechanical | P1+P5 | verified cookie fallback + 10/min/IP limiter | RN cookie-jar reliance |
| 25 | 3 | Teachers see all classes v1 (assignment deferred) | **TASTE-auto** | P3 | no teacher-class data exists; schema work is separate scope | unplanned schema workstream now |
| 26 | 3 | W-R response-schema workstream added | Mechanical | P1 | zod-parse architecture had no response schemas to parse | parsing with input schemas |
| 27 | 3 | E-3 re-costed into W-3 (was S-sized freebie) | Mechanical | P1 | endpoint is staff-only; ownership check needed | shipping a 403 chip |
| 28 | 3 | Timezone claim → server date-window validation | Mechanical | P5 | no timezone column exists; explicit over aspirational | claiming unenforceable authority |

---

# CROSS-PHASE THEMES (high-confidence signals — flagged independently in 2+ phases)

1. **Honest alert delivery** — CEO (W-2 contract, `notified` = attempted only), Design (D-5 placement so honesty doesn't nag), Eng (dedupe ledger, transition-only dispatch, undo recall). Three independent reviews converged on the same invariant from three angles: the alert side effect is the most dangerous part of the wedge.
2. **Parent linking is a product surface, not an API call** — CEO (parentId never written; W-3), Design (D-3 claim flow is the highest-abandonment moment), Eng (verified-email 403 path, ownership checks). The parent phase is real new product work on both repos.
3. **Offline queue correctness** — CEO (never lose a day's marking), Eng (success:true/written:0, stale replay, exactly-once side effects). The queue is the wedge's engineering core; its contract is now fully specified.
4. **Fail-closed tenancy** — CEO/security (null schoolCode), Eng (live cross-tenant write vuln → W-6). The invariant held on reads and broke on writes; W-6 closes it.

## Recommended build order (dependencies honored)
```
Slice 0 (server, ships alone, fixes prod): T-E1(W-6 security) → T-E2(W-2a) → T-E3(W-2b)
Slice 1 (auth):  T-E4+T1(W-1) → T-E5(W-R schemas) → T3(mobile auth) → T-D1(tokens)
Slice 2 (wedge): T2(W-2 fields) → T4+T-D2+T-D4(marking+home) → T-E6(queue E2E) → T5(gate metric) → T10(CI tests)
   ── PHASE-3 DEMAND GATE: ≥80% marking days in 2 wk + principal WTP conversation ──
Slice 3 (viewers): T6(W-3/W-4) → T-D3(claim flow)+T-E7 → T7(W-5 push)+T-D5 → T8(fees)
Slice 4 (release): T9(EAS, Android-first, DPDP) ; T-D6(design system) anytime before Slice 3 UI
```

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | issues_open→gate | 8 proposals, 4 accepted, 3 deferred, 1 gated; 0 critical gaps |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | unavailable | codex CLI not installed — Claude subagents served as outside voices |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_open→gate | 16 issues (6 P1, 3 code-verified), all absorbed; 0 critical gaps open |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | issues_open→gate | score 5/10 → 8.5/10, 14 findings, 13 absorbed |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | skipped | end-user app; no developer-facing surface |

**VERDICT:** CEO + DESIGN + ENG review complete via /autoplan [subagent-only voices]; plan is implementation-ready pending the final approval gate's 4 taste decisions. Eng review satisfied by plan-eng-review (PLAN via /autoplan).

**Gate outcome (2026-07-09):** APPROVED with all recommendations — D2: Android-first pilot distribution; D3: i18n deferred until pilot feedback; D4: long-press late/excused included; D5: teachers see all classes v1 (assignment deferred).

NO UNRESOLVED DECISIONS
