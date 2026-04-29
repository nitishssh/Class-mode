# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **AI Classroom Features**: Enhanced classroom player with interactive quizzes, keyboard navigation, PBL (Project-Based Learning) support, and real-time SSE progress tracking.
- **Job Management**: Implemented job cancellation via API and UI, including AbortSignal support during classroom generation.
- **Whiteboard Integrations**: Added whiteboard clear/erase actions, limited ledger size, and incorporated UI controls for managing whiteboard state.
- **API Enhancements**: Added endpoints for deleting classrooms, cancelling jobs, and pagination support for classroom listings.

### Fixed
- **Memory Management**: Added maximum buffer size to the orchestrator chunk parser and limited whiteboard ledger size to prevent OOM errors.
- **Generation Pipeline**: Implemented parallel scene generation, LLM timeouts, and HTML sanitization for stability.
- **Background Tasks**: Implemented job cleanup and staleness tracking in the StudyArena service.
- **Security & Authorization**: Fixed classroom access authorization and enforced authentication checks on the `my-classrooms` route.

### Changed
- **Caching**: Implemented in-memory caching for study arena prompts and snippets.

## [1.1.0] - 2026-02-20

### Added

- **Dockerization**: Comprehensive Docker setup including `Dockerfile`, `docker-compose.yml`, and `.dockerignore` for easier environment setup and containerized deployment.
- **Project Documentation**: Added `CONTRIBUTING.md`, `LOCAL_SETUP.md`, `CLA.md`, and `CODE_OF_CONDUCT.md` to prepare for open-source contributions.
- **Environment Management**: Improved handling of environment variables with documented optional dependencies for Firebase and OpenAI.

### Fixed

- **Tailwind CSS Integration**: Resolved issues with `@tailwind` and `@apply` directives in `index.css`.
- **TypeScript Compliance**: Fixed numerous TypeScript errors across the codebase, particularly in `ocr-upload.tsx`, `create-test.tsx`, and `routes.ts`.
- **Frontend Hygiene**: Removed redundant layout components (`Sidebar`, `Header`, `MobileNav`) from individual pages now covered by `AppLayout`.

### Changed

- **UI Refinement**: Established a cohesive design system with updated color palettes, typography, and enhanced dark mode support.
- **Code Structure**: Refactored various frontend components and backend logic for better modularity and stability.
- **Dependencies**: Updated numerous library versions for better compatibility and security.

## [1.0.0] - 2026-02-17

### Added

- Initial release of the AI-Powered Personalized Learning Platform.
- Core features: AI Tutor, AI Test Generation, OCR Test Scanning, and Performance Analytics.
