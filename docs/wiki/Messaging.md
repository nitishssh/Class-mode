# Messaging & Live Classes

## Features

*   **Live Classes:** Support for synchronous virtual classrooms (`live-classes.tsx`, `live-classroom.tsx`). Uses Daily.co based on `package.json` dependencies (`@daily-co/daily-js`, `@daily-co/daily-react`).
*   **Chat/Messaging:** A dedicated messaging interface for communication between users (`messages.tsx`).
*   **Notifications:** System for alerting users about events or messages (`notifications.tsx`).

## Test Status

*   `live_classes.test.ts` is passing (13 tests).

## Simplification Recommendations

*   **Live Class Abstraction:** Ensure the integration with Daily.co is straightforward. Over-wrapping the video SDK can lead to brittle implementations. Rely on the vendor's React components directly where possible rather than building custom wrappers unless strictly necessary.
*   **Messaging Scope:** If messaging is just a simple "send message to user" feature, ensure it isn't over-engineered. A simple PostgreSQL table is usually sufficient for a school app until you hit massive concurrent scale.
