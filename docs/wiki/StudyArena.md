# Study Arena (Classroom Engine)

## Features

- **AI Classroom:** A virtual classroom environment enhanced with AI capabilities (e.g., automated test generation, study plans).
- **Test Management:** Creating tests, listing tests, and a dedicated test-taking interface (`create-test.tsx`, `tests-list.tsx`, `test-page.tsx`).
- **Analytics & Progress:** Tracking student progress, academic calendar integration, and AI-driven insights (`analytics.tsx`, `my-progress.tsx`, `achievements.tsx`).
- **OCR Scanning:** Ability to scan documents (presumably written assignments or tests) for automated processing (`ocr-scan.tsx`).

## Test Status

- Tests in `ai_classroom.test.ts`, `ai_evaluation.test.ts`, `study-arena-integration.test.ts`, and `ocr_routes.test.ts` are passing. Note that some integration tests are skipped by default (`study-arena-integration.test.ts`), which is common for heavy integration tests but should be run in CI.

## Simplification Recommendations

- **Component Bloat:** The client side has many specialized pages (`ai-study-plans.tsx`, `study-plan.tsx`, `focus.tsx`, `tasks.tsx`). Consider combining "Focus", "Tasks", and "Study Plans" into a single "Student Hub" view to reduce the number of distinct React routes and pages the user has to navigate.
- **Study Arena Service:** The `server/services/study-arena` directory might be over-abstracting normal CRUD operations. Ensure that features only exist as separate services if they truly require decoupled, independent lifecycle management.
