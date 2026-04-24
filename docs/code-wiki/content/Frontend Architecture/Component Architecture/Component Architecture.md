# Component Architecture

<cite>
**Referenced Files in This Document**
- [App.tsx](file://client/src/App.tsx)
- [main.tsx](file://client/src/main.tsx)
- [index.css](file://client/src/index.css)
- [config.ts](file://client/src/config.ts)
- [dashboard.tsx](file://client/src/pages/dashboard.tsx)
- [sidebar.tsx](file://client/src/components/layout/sidebar.tsx)
- [header.tsx](file://client/src/components/layout/header.tsx)
- [ChatLayout.tsx](file://client/src/components/chat/ChatLayout.tsx)
- [MessageBubble.tsx](file://client/src/components/chat/MessageBubble.tsx)
- [firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx)
- [theme-context.tsx](file://client/src/contexts/theme-context.tsx)
- [chat-role-context.tsx](file://client/src/contexts/chat-role-context.tsx)
- [button.tsx](file://client/src/components/ui/button.tsx)
- [form.tsx](file://client/src/components/ui/form.tsx)
</cite>

## Table of Contents

1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction

This document describes the component architecture of PersonalLearningPro’s React application. It explains the component hierarchy, reusable UI components, and page-level components. It also covers composition patterns, how prop drilling is prevented using context providers, lifecycle management, and the custom component library built with Radix UI primitives. Specialized educational components such as chat bubbles and performance charts are documented alongside naming conventions, folder organization, testing strategies, accessibility, and responsive design patterns.

## Project Structure

The client application is organized by feature and layer:

- Pages: route-level views such as dashboards and feature pages
- Components: reusable UI building blocks grouped by domain (layout, chat, dashboard, ui)
- Contexts: cross-cutting concerns (authentication, theme, chat role)
- Hooks: custom hooks for UI behavior (e.g., mobile detection, toast)
- Lib: shared utilities and API clients
- Types: TypeScript type definitions
- Assets and styles: Tailwind CSS base tokens and animations

```mermaid
graph TB
subgraph "Entry Point"
MAIN["main.tsx"]
APP["App.tsx"]
end
subgraph "Routing Layer"
ROUTER["Router() in App.tsx"]
LAYOUT["AppLayout wrapper"]
end
subgraph "Pages"
DASHBOARD["pages/dashboard.tsx"]
OTHER_PAGES["Other pages..."]
end
subgraph "Layout"
HEADER["layout/header.tsx"]
SIDEBAR["layout/sidebar.tsx"]
end
subgraph "Chat Domain"
CHAT_LAYOUT["chat/ChatLayout.tsx"]
MSG_BUBBLE["chat/MessageBubble.tsx"]
end
subgraph "UI Library"
BUTTON["ui/button.tsx"]
FORM["ui/form.tsx"]
end
subgraph "Contexts"
AUTH_CTX["contexts/firebase-auth-context.tsx"]
THEME_CTX["contexts/theme-context.tsx"]
ROLE_CTX["contexts/chat-role-context.tsx"]
end
MAIN --> APP
APP --> ROUTER
ROUTER --> LAYOUT
LAYOUT --> HEADER
LAYOUT --> SIDEBAR
ROUTER --> DASHBOARD
ROUTER --> CHAT_LAYOUT
CHAT_LAYOUT --> MSG_BUBBLE
DASHBOARD --> BUTTON
DASHBOARD --> FORM
APP --> AUTH_CTX
APP --> THEME_CTX
CHAT_LAYOUT --> ROLE_CTX
```

**Diagram sources**

- [main.tsx](file://client/src/main.tsx#L1-L8)
- [App.tsx](file://client/src/App.tsx#L1-L165)
- [dashboard.tsx](file://client/src/pages/dashboard.tsx#L1-L338)
- [sidebar.tsx](file://client/src/components/layout/sidebar.tsx#L1-L332)
- [header.tsx](file://client/src/components/layout/header.tsx#L1-L133)
- [ChatLayout.tsx](file://client/src/components/chat/ChatLayout.tsx#L1-L185)
- [MessageBubble.tsx](file://client/src/components/chat/MessageBubble.tsx#L1-L157)
- [button.tsx](file://client/src/components/ui/button.tsx#L1-L57)
- [form.tsx](file://client/src/components/ui/form.tsx#L1-L177)
- [firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx#L1-L267)
- [theme-context.tsx](file://client/src/contexts/theme-context.tsx#L1-L72)
- [chat-role-context.tsx](file://client/src/contexts/chat-role-context.tsx#L1-L59)

**Section sources**

- [main.tsx](file://client/src/main.tsx#L1-L8)
- [App.tsx](file://client/src/App.tsx#L1-L165)

## Core Components

- App and Routing: The application bootstraps via main.tsx and renders App.tsx. App.tsx defines a provider stack (React Query, Theme, Firebase Auth) and a role-aware Router that conditionally renders pages and applies a layout wrapper.
- Layout Wrapper: AppLayout centralizes sidebar and main content margins, supporting full-width and constrained layouts.
- Authentication and Theme Contexts: FirebaseAuthProvider and ThemeProvider encapsulate auth state and theme persistence, exposing hooks for consumption.
- UI Library: A set of Radix UI–based components (button, form, input, etc.) with Tailwind-based variants and consistent APIs.

Key responsibilities:

- App.tsx: Routing orchestration, role-based dashboard selection, loading/auth UI, and layout wrapping
- AppLayout: Container with sidebar width control and responsive constraints
- FirebaseAuthProvider: Auth state, profile hydration, and toast-driven UX
- ThemeProvider: System-aware theme persistence and DOM class updates
- UI components: Consistent variants, slots, and accessibility attributes

**Section sources**

- [App.tsx](file://client/src/App.tsx#L1-L165)
- [main.tsx](file://client/src/main.tsx#L1-L8)
- [firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx#L1-L267)
- [theme-context.tsx](file://client/src/contexts/theme-context.tsx#L1-L72)
- [button.tsx](file://client/src/components/ui/button.tsx#L1-L57)
- [form.tsx](file://client/src/components/ui/form.tsx#L1-L177)

## Architecture Overview

The app follows a layered architecture:

- Entry point initializes React root and providers
- Routing layer decides which page to render based on role and route
- Layout layer composes header and sidebar around page content
- Domain components (chat, dashboard) encapsulate feature logic
- UI primitives (Radix + Tailwind) provide reusable, accessible building blocks

```mermaid
graph TB
ENTRY["main.tsx"] --> ROOT["App.tsx"]
ROOT --> PROVIDERS["Providers:<br/>QueryClient, Theme, Auth"]
ROOT --> ROUTING["Router()<br/>Role-aware routes"]
ROUTING --> WRAPPER["AppLayout wrapper"]
WRAPPER --> HEADER["Header"]
WRAPPER --> SIDEBAR["Sidebar"]
ROUTING --> PAGES["Pages (dashboards, features)"]
PAGES --> DOMAIN["Domain Components<br/>(chat, dashboard)"]
DOMAIN --> UI["UI Library<br/>(Radix + Tailwind)"]
```

**Diagram sources**

- [main.tsx](file://client/src/main.tsx#L1-L8)
- [App.tsx](file://client/src/App.tsx#L1-L165)
- [header.tsx](file://client/src/components/layout/header.tsx#L1-L133)
- [sidebar.tsx](file://client/src/components/layout/sidebar.tsx#L1-L332)
- [dashboard.tsx](file://client/src/pages/dashboard.tsx#L1-L338)
- [ChatLayout.tsx](file://client/src/components/chat/ChatLayout.tsx#L1-L185)
- [button.tsx](file://client/src/components/ui/button.tsx#L1-L57)

## Detailed Component Analysis

### Routing and Layout Composition

- App.tsx orchestrates:
  - Provider stack: React Query, Theme, Firebase Auth
  - Router: role-aware selection of dashboard and feature routes
  - Loading and auth dialogs
  - Layout wrapper injection around pages
- AppLayout:
  - Renders Sidebar and main content area
  - Controls left margin via CSS variable for sidebar width
  - Supports full-width mode for immersive pages

```mermaid
sequenceDiagram
participant Root as "main.tsx"
participant App as "App.tsx"
participant Providers as "Providers"
participant Router as "Router()"
participant Layout as "AppLayout"
participant Page as "Page Component"
Root->>App : render()
App->>Providers : wrap children
App->>Router : render()
Router->>Router : check auth state
Router->>Layout : wrap selected page
Layout->>Layout : render Sidebar + main
Layout->>Page : render children
```

**Diagram sources**

- [main.tsx](file://client/src/main.tsx#L1-L8)
- [App.tsx](file://client/src/App.tsx#L1-L165)

**Section sources**

- [App.tsx](file://client/src/App.tsx#L1-L165)

### Authentication and Theme Contexts

- FirebaseAuthProvider:
  - Subscribes to auth state, hydrates profile, and exposes login/register/logout/reset helpers
  - Toasts provide feedback; loading state prevents UI flicker
- ThemeProvider:
  - Persists theme preference and applies system fallback
  - Updates document root classes for Tailwind variants

```mermaid
sequenceDiagram
participant App as "App.tsx"
participant AuthCtx as "FirebaseAuthProvider"
participant ThemeCtx as "ThemeProvider"
participant UI as "UI Components"
App->>AuthCtx : wrap children
App->>ThemeCtx : wrap children
AuthCtx->>AuthCtx : subscribe onAuthStateChanged
ThemeCtx->>ThemeCtx : apply theme to document.documentElement
UI->>AuthCtx : useFirebaseAuth()
UI->>ThemeCtx : useTheme()
```

**Diagram sources**

- [firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx#L1-L267)
- [theme-context.tsx](file://client/src/contexts/theme-context.tsx#L1-L72)

**Section sources**

- [firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx#L1-L267)
- [theme-context.tsx](file://client/src/contexts/theme-context.tsx#L1-L72)

### Chat Domain: Conversations and Message Bubbles

- ChatLayout:
  - Provides role-aware context for chat
  - Fetches workspaces, channels, and DMs; merges with mock data
  - Manages active conversation, list visibility, and WebSocket connection
- MessageBubble:
  - Renders different message types (announcement, assignment, system, text/media)
  - Applies role-based and type-based styling
  - Handles pinned, doubt, mentions, and status indicators

```mermaid
flowchart TD
Start(["Render ChatLayout"]) --> FetchWS["Fetch Workspaces"]
FetchWS --> FetchCh["Fetch Channels per Workspace"]
FetchCh --> FetchDMs["Fetch DMs"]
FetchDMs --> Merge["Merge Server + Mock Data"]
Merge --> Decide{"Has Conversations?"}
Decide --> |Yes| PickFirst["Pick First Conversation"]
Decide --> |No| UseMock["Use Mock Data"]
PickFirst --> WS["Connect WebSocket"]
UseMock --> WS
WS --> Render["Render Conversation List + Thread"]
Render --> Bubble["Render MessageBubble(s)"]
Bubble --> End(["Done"])
```

**Diagram sources**

- [ChatLayout.tsx](file://client/src/components/chat/ChatLayout.tsx#L1-L185)
- [MessageBubble.tsx](file://client/src/components/chat/MessageBubble.tsx#L1-L157)

**Section sources**

- [ChatLayout.tsx](file://client/src/components/chat/ChatLayout.tsx#L1-L185)
- [MessageBubble.tsx](file://client/src/components/chat/MessageBubble.tsx#L1-L157)

### Dashboard Page Composition

- dashboard.tsx composes:
  - PageHeader, stats cards, quick actions, class schedule, recent tests, performance chart, top students, notifications, and resource suggestions
  - Uses UI primitives (Button, Card, Badge) and educational components (PerformanceChart, TopStudents)
  - Integrates with React Query for notifications and links to feature routes

```mermaid
graph LR
PAGE["dashboard.tsx"] --> PH["PageHeader"]
PAGE --> STATS["Stats Cards"]
PAGE --> QA["Quick Actions Grid"]
PAGE --> CS["ClassSchedule"]
PAGE --> RT["RecentTestsTable"]
PAGE --> PC["PerformanceChart"]
PAGE --> TS["TopStudents"]
PAGE --> NOTIFS["Notifications"]
PAGE --> RES["Resource Suggestions"]
PAGE --> UI["UI Primitives (Button, Card, Badge)"]
```

**Diagram sources**

- [dashboard.tsx](file://client/src/pages/dashboard.tsx#L1-L338)
- [button.tsx](file://client/src/components/ui/button.tsx#L1-L57)

**Section sources**

- [dashboard.tsx](file://client/src/pages/dashboard.tsx#L1-L338)

### UI Primitive Library: Button and Form

- Button:
  - Variants and sizes via class-variance-authority
  - Accepts asChild to render semantic elements
  - Integrates with Radix UI slot for composition
- Form:
  - React Hook Form provider and field utilities
  - Accessible labeling, descriptions, and error messaging
  - Controlled components with proper aria attributes

```mermaid
classDiagram
class Button {
+variant : "default|destructive|outline|secondary|ghost|link"
+size : "default|sm|lg|icon"
+asChild : boolean
}
class Form {
+FormProvider
+FormField
+FormLabel
+FormControl
+FormDescription
+FormMessage
}
Button <.. Form : "used within forms"
```

**Diagram sources**

- [button.tsx](file://client/src/components/ui/button.tsx#L1-L57)
- [form.tsx](file://client/src/components/ui/form.tsx#L1-L177)

**Section sources**

- [button.tsx](file://client/src/components/ui/button.tsx#L1-L57)
- [form.tsx](file://client/src/components/ui/form.tsx#L1-L177)

### Layout Components: Header and Sidebar

- Header:
  - Responsive search toggle, theme toggle, notifications, messages, and user dropdown
  - Uses theme and auth contexts; integrates with sidebar toggle via custom event dispatch
- Sidebar:
  - Role-aware navigation items, collapsible behavior, mobile overlay, and user panel
  - Synchronizes width via CSS variable and Tailwind utilities

```mermaid
sequenceDiagram
participant Header as "Header"
participant Theme as "Theme Context"
participant Auth as "Auth Context"
participant Sidebar as "Sidebar"
Header->>Theme : toggle theme
Header->>Auth : logout
Header->>Sidebar : dispatch toggle-sidebar
Sidebar->>Sidebar : update CSS var (--sidebar-width)
```

**Diagram sources**

- [header.tsx](file://client/src/components/layout/header.tsx#L1-L133)
- [sidebar.tsx](file://client/src/components/layout/sidebar.tsx#L1-L332)
- [theme-context.tsx](file://client/src/contexts/theme-context.tsx#L1-L72)
- [firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx#L1-L267)

**Section sources**

- [header.tsx](file://client/src/components/layout/header.tsx#L1-L133)
- [sidebar.tsx](file://client/src/components/layout/sidebar.tsx#L1-L332)

## Dependency Analysis

- Provider stack: App.tsx wraps children in QueryClientProvider, ThemeProvider, FirebaseAuthProvider
- Context coupling:
  - ChatLayout depends on ChatRoleProvider (derived from auth)
  - UI components depend on Radix UI primitives and Tailwind utilities
- Routing and layout:
  - Router selects pages and applies AppLayout wrapper
  - AppLayout composes Header and Sidebar around page content

```mermaid
graph TB
APP["App.tsx"] --> THEME["ThemeProvider"]
APP --> AUTH["FirebaseAuthProvider"]
APP --> ROUTER["Router()"]
ROUTER --> WRAP["AppLayout"]
WRAP --> HEADER["Header"]
WRAP --> SIDEBAR["Sidebar"]
ROUTER --> PAGES["Pages"]
PAGES --> UI["UI Library"]
CHAT["ChatLayout"] --> ROLE["ChatRoleProvider"]
ROLE --> AUTH
```

**Diagram sources**

- [App.tsx](file://client/src/App.tsx#L1-L165)
- [theme-context.tsx](file://client/src/contexts/theme-context.tsx#L1-L72)
- [firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx#L1-L267)
- [chat-role-context.tsx](file://client/src/contexts/chat-role-context.tsx#L1-L59)
- [header.tsx](file://client/src/components/layout/header.tsx#L1-L133)
- [sidebar.tsx](file://client/src/components/layout/sidebar.tsx#L1-L332)

**Section sources**

- [App.tsx](file://client/src/App.tsx#L1-L165)
- [chat-role-context.tsx](file://client/src/contexts/chat-role-context.tsx#L1-L59)

## Performance Considerations

- Memoization and stable wrappers:
  - AppLayout wrapper memoization avoids recreating components on each render
  - ChatLayout uses useMemo and useCallback to stabilize derived values and handlers
- Query caching:
  - React Query queries use staleTime and retries to balance freshness and performance
- CSS variable-driven layout:
  - Sidebar width controlled via CSS variable reduces layout thrashing
- Lightweight context reads:
  - Context consumers are scoped to small subtrees to minimize re-renders

[No sources needed since this section provides general guidance]

## Troubleshooting Guide

- Authentication flow:
  - If auth state hangs, check onAuthStateChanged subscription and profile hydration timeouts
  - Toast feedback helps diagnose login/register/logout failures
- Theme switching:
  - Verify system preference fallback and local storage persistence
- Chat connectivity:
  - Confirm WebSocket initialization and conversation selection logic
- Layout issues:
  - Ensure CSS variable for sidebar width is set and Tailwind utilities are applied

**Section sources**

- [firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx#L1-L267)
- [theme-context.tsx](file://client/src/contexts/theme-context.tsx#L1-L72)
- [ChatLayout.tsx](file://client/src/components/chat/ChatLayout.tsx#L1-L185)
- [sidebar.tsx](file://client/src/components/layout/sidebar.tsx#L1-L332)

## Conclusion

PersonalLearningPro’s component architecture emphasizes:

- Clear separation of concerns across routing, layout, domain, and UI layers
- Context-based composition to prevent prop drilling and centralize cross-cutting concerns
- A robust UI primitive library built on Radix UI and Tailwind for accessibility and consistency
- Educational domain components (chat, dashboards) integrated with reactive data fetching and responsive design

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Naming Conventions and Folder Organization

- Feature-first grouping:
  - components/layout, components/chat, components/dashboard, components/test, components/ui
- Page-level components:
  - pages/\*.tsx for route-level views
- Contexts and hooks:
  - contexts/_ for providers, hooks/_ for custom hooks
- Utilities and types:
  - lib/_ for shared utilities/API clients, types/_ for TS types
- Tokens and animations:
  - index.css defines CSS variables and Tailwind layers for themes, charts, and chat tokens

**Section sources**

- [index.css](file://client/src/index.css#L1-L344)
- [config.ts](file://client/src/config.ts#L1-L8)

### Accessibility Implementation

- Semantic markup and labels:
  - Buttons, inputs, and form controls use proper roles and labels
  - Radix UI primitives provide accessible defaults
- Keyboard navigation:
  - Focus management and keyboard interactions supported by Radix UI
- ARIA attributes:
  - Form controls expose aria-invalid and described-by IDs
- Color contrast and themes:
  - Dark/light variants and chart tokens ensure readability across modes

**Section sources**

- [button.tsx](file://client/src/components/ui/button.tsx#L1-L57)
- [form.tsx](file://client/src/components/ui/form.tsx#L1-L177)
- [index.css](file://client/src/index.css#L1-L344)

### Responsive Design Patterns

- Breakpoints and spacing:
  - Tailwind utilities for responsive grids and paddings
- Sidebar behavior:
  - Collapsible layout with CSS variable-driven width and mobile overlay
- Typography and cards:
  - Responsive typography scales and card layouts adapt to screen sizes

**Section sources**

- [sidebar.tsx](file://client/src/components/layout/sidebar.tsx#L1-L332)
- [dashboard.tsx](file://client/src/pages/dashboard.tsx#L1-L338)
- [index.css](file://client/src/index.css#L1-L344)
