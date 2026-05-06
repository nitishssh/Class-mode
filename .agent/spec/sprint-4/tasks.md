# Sprint 4 Tasks

## 1. AI Grading Engine
- [x] `shared/grading-schema.ts` — Zod schemas
- [x] `shared/mongo-schema.ts` — GradingResult model
- [x] `server/lib/rubricParser.ts` — rubric validation
- [x] `server/lib/prompts/grading.ts` — GPT-4o prompts
- [x] `server/services/gradingService.ts` — grading pipeline
- [x] `server/routes/grading.ts` — API endpoints
- [ ] Wire into task submission flow

## 2. Educator Portal
- [x] `server/routes/educator.ts` — dashboard, students, grading
- [ ] `client/src/pages/educator/` — web pages
- [ ] `mobile/app/(educator)/` — mobile pages

## 3. Parent Portal
- [x] `server/routes/parent.ts` — dashboard, reports
- [ ] `client/src/pages/parent/` — web pages
- [ ] `mobile/app/(parent)/` — mobile pages

## 4. LMS Integration
- [ ] `server/lib/lms/googleClassroom.ts`
- [ ] `server/routes/lms.ts`
- [ ] `shared/mongo-schema.ts` — LmsConnection model

## 5. Monetization
- [x] `server/routes/billing.ts` — Stripe integration
- [ ] `server/middleware/requireSubscription.ts`
- [ ] `client/src/components/paywall/`
- [ ] `mobile/app/(modals)/pricing.tsx`

## 6. Quality & Compliance
- [ ] Playwright E2E tests (`e2e/web/`)
- [ ] Detox E2E tests (`e2e/mobile/`)
- [ ] GDPR endpoints + cookie banner
- [ ] Accessibility audit (WCAG 2.1 AA)

## Progress
| Feature | Done | Total | Progress |
|---------|------|-------|----------|
| AI Grading | 6 | 7 | 86% |
| Educator Portal | 1 | 3 | 33% |
| Parent Portal | 1 | 3 | 33% |
| LMS | 0 | 3 | 0% |
| Monetization | 1 | 4 | 25% |
| Quality | 0 | 4 | 0% |
