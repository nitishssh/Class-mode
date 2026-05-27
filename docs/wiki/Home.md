# EduAI Platform - Feature Audit & Product Review

Welcome to the EduAI Platform documentation wiki. This wiki was created as part of a product review to audit the codebase, categorize features, review testing coverage, and identify areas of the application that are "over coded" and candidates for simplification.

## Table of Contents

1. [Authentication & Onboarding](Authentication.md)
2. [Study Arena (Classroom Engine)](StudyArena.md)
3. [IniClaw (AI Gateway & Integrations)](IniClaw.md)
4. [Messaging & Live Classes](Messaging.md)
5. [Database & Storage Layer](Storage.md)

## Overall Simplification Recommendations

During the audit, a few overarching themes for simplification emerged:

*   **Consolidate Dashboard Logic:** There are multiple dashboards (`admin-dashboard.tsx`, `student-dashboard.tsx`, `parent-dashboard.tsx`, `principal-dashboard.tsx`, `school-admin-dashboard.tsx`). While roles differ, a single generic dashboard component that renders widgets dynamically based on user role would significantly reduce code duplication.
*   **Simplify Database Architecture:** The current implementation uses a hybrid approach (PostgreSQL for relational data, Cassandra for high-volume data like messages). Unless there is a massive scale requirement for messages right now, moving everything to a single unified database (like PostgreSQL) would heavily reduce infrastructure and mental overhead.
*   **Reduce AI Abstraction:** The "IniClaw" gateway concept adds a layer of abstraction over simple LLM API calls. Standardizing on a simple `generateText` or `analyzeData` utility without full gateway patterns could simplify the AI integration layer.
