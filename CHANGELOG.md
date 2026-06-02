# Changelog

All notable changes to this project will be documented in this file.

## [1.7.0.0] - 2026-06-02

### Added

- **Gamified onboarding quest panel** — new teachers now see a floating "Get Started" button with a slide-in panel listing three activation quests: create a test, set up a class, and invite a student. Completing all three fires a confetti celebration. Quest state persists in localStorage (v0). Panel auto-hides after 7 days or when all quests are done.

### Fixed

- Test creation now correctly attributes the test to the authenticated teacher — previously the route compared a Firebase UID against a numeric session ID, causing all teacher test-create requests to return 403. The teacherId is now derived server-side from the session.
- Test update (PATCH) no longer accepts a client-supplied `teacherId`, closing a potential test re-attribution vector.
