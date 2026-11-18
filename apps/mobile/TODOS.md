# TODOS

Deferred items from /autoplan review (2026-07-09). Context lives in the reviewed plan:
`~/.gstack/projects/NitishKumar-ai-classmode-mobile/main-mobile-app-plan-20260708-033601.md`

- [ ] **Teacher→class assignment** (M, P2) — server schema + admin UI so the app can answer "which classes does this teacher teach"; today `GET /api/attendance/classes` returns every class in the school and `school_classes.teacher_firebase_uid` is legacy/unwired. v1 ships all-classes-sorted-by-marking-status. Blocked by: nothing; unblocks a sharper teacher home.
- [ ] **In-app fee payment** (XL, P2) — gateway + reconciliation; where willingness-to-pay lives. Revisit immediately after the Phase-3 demand gate passes. Blocked by: paying pilot school.
- [ ] **Principal 10am daily-digest push** (M, P3) — needs a server cron + W-5 sender; expectation copy already lands in W-4.
- [ ] **Home-screen widget / app shortcuts for today's marking** (M, P3) — native-module work; post-wedge polish.
- [ ] **Hindi/vernacular i18n** (M, P2-if-pilot-asks) — scaffold is cheap now but every string becomes a translation liability; decide after pilot feedback (gate decision D3).
- [ ] **Tap-to-remind unmarked classes (principal)** (M, P3) — requires W-5 scope; v1 nudge is display-only.
- [ ] **DESIGN.md via /design-consultation, then /design-shotgun mockups** (M, P2) — no design system exists in either repo; do before heavy UI polish.
- [ ] **authenticateToken per-request session write + double DB lookup** (M, P3, Class-mode) — middleware.ts:60-64 dirties the PG session store on every token-authenticated request; a mobile fleet multiplies this. Shared web debt.
- [ ] **Google OAuth on mobile** (M, P3) — expo-web-browser flow; password/invite covers the pilot.
