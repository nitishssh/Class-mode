# Sprint 4 Technical Design

## Architecture

```
[Web/Mobile] → [Express API] → [Services]
                     ↓
              [MongoDB][Firebase][OpenAI][Stripe]
```

## 1. AI Grading Engine

- `server/services/gradingService.ts` — orchestrates grading pipeline
- `server/lib/rubricParser.ts` — parse/validate rubric JSON
- `shared/grading-schema.ts` — Zod schemas
- `server/routes/grading.ts` — API endpoints

Pipeline: `Submission → rubricParser → OpenAI GPT-4o → parse → store → notify`

## 2. Educator/Parent Portals

- Web: `client/src/pages/educator/`, `client/src/pages/parent/`
- Mobile: `mobile/app/(educator)/`, `mobile/app/(parent)/`
- API: `server/routes/educator.ts`, `server/routes/parent.ts`
- Reuse existing auth middleware with role checks

## 3. LMS Integration

- `server/lib/lms/googleClassroom.ts` — Google OAuth + API
- `server/lib/lms/canvas.ts` — Canvas API client
- `server/routes/lms.ts` — auth, sync, webhook endpoints
- Tokens encrypted at rest in MongoDB `LmsConnection` model

## 4. Monetization

- Tiers: Free (limited), Pro (unlimited), Educator, Institution
- `server/routes/billing.ts` — Stripe checkout, portal, webhooks
- `server/middleware/requireSubscription.ts` — feature gating
- Paywall: `client/src/components/paywall/`, `mobile/hooks/useSubscription.ts`

## 5. Quality & Compliance

- Playwright tests in `e2e/web/`, Detox in `e2e/mobile/`
- GDPR: `server/routes/gdpr.ts` — export/delete endpoints
- Cookie consent: `client/src/components/CookieBanner.tsx`

## Database Additions (mongo-schema.ts)

- `GradingResult` — grading outputs
- `LmsConnection` — encrypted LMS tokens
- `Subscription` — Stripe subscription state
