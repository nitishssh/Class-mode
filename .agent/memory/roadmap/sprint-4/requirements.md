# Sprint 4 Requirements

## Goal

Production-hardening: AI grading, educator/parent portals, LMS integration, monetization, quality & compliance.

## Features

### 1. AI Grading Engine

- Auto-grade assignments/code/essays via OpenAI GPT-4o + rubric support
- Multiple content types: text, code (Python/JS/TS), PDF
- Store results in MongoDB with version history

### 2. Educator Portal (Web + Mobile)

- Dashboard: class overview, student progress, pending grading
- Task assignment CRUD with attachments
- Grade review: approve/override AI grades
- Student roster management

### 3. Parent Portal (Web + Mobile)

- Child progress: tasks, scores, time spent
- Notifications: due soon, low scores, missed deadlines
- Reports: weekly/monthly PDF exports

### 4. LMS Integration

- Google Classroom: sync assignments, grades, rostering
- Canvas LMS: assignment push/grade passback
- OAuth 2.0 for educator account linking

### 5. Monetization

- Stripe tiers: Free, Pro, Educator, Institution
- Feature gating: AI Tutor limited for free
- Web + mobile paywall UI

### 6. Quality & Compliance

- E2E tests: Playwright (web), Detox (mobile)
- Performance: bundle analysis, lazy loading
- GDPR: data export/deletion, cookie consent
- Accessibility: WCAG 2.1 AA audit

## Success Criteria

- [ ] AI grading: 50+ submissions/min, <5% error rate
- [ ] Educator + Parent portals live on web and mobile
- [ ] 1 LMS integration working end-to-end
- [ ] Stripe payments collecting in production
- [ ] E2E coverage >80% for critical paths
- [ ] GDPR export/deletion endpoints pass audit
