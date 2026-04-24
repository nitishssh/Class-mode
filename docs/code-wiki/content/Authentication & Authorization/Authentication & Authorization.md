# Authentication & Authorization

<cite>
**Referenced Files in This Document**
- [firebase.ts](file://client/src/lib/firebase.ts)
- [firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx)
- [firebase-auth-dialog.tsx](file://client/src/components/auth/firebase-auth-dialog.tsx)
- [LoginPage.tsx](file://client/src/pages/LoginPage.tsx)
- [register.tsx](file://client/src/pages/register.tsx)
- [App.tsx](file://client/src/App.tsx)
- [index.ts](file://server/index.ts)
- [middleware.ts](file://server/middleware.ts)
- [routes.ts](file://server/routes.ts)
- [storage.ts](file://server/storage.ts)
- [express-session.d.ts](file://server/types/express-session.d.ts)
- [schema.ts](file://shared/schema.ts)
- [chat.ts](file://client/src/types/chat.ts)
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

## Introduction

This document explains the authentication and authorization system for PersonalLearningPro. The platform integrates Firebase Authentication for user identity and session lifecycle, while maintaining a custom session store on the server for role-based access control (RBAC). It covers:

- Firebase-based user registration and login flows
- Role-based access control with five roles (Student, Teacher, Admin, Principal, Parent)
- Session handling and middleware enforcement
- Security considerations and best practices
- Authorization patterns and UI routing per role

## Project Structure

The authentication system spans the client and server:

- Client-side Firebase integration and UI dialogs
- Server-side session management and RBAC middleware
- Shared schemas for validation and data contracts

```mermaid
graph TB
subgraph "Client"
FB["Firebase SDK<br/>client/src/lib/firebase.ts"]
Ctx["Auth Context<br/>client/src/contexts/firebase-auth-context.tsx"]
UI["Auth UI<br/>client/src/components/auth/firebase-auth-dialog.tsx"]
App["Routing & Dashboards<br/>client/src/App.tsx"]
end
subgraph "Server"
Sess["Express Session<br/>server/index.ts"]
MW["Middleware<br/>server/middleware.ts"]
Routes["Routes & RBAC<br/>server/routes.ts"]
Store["Storage & Session Store<br/>server/storage.ts"]
end
FB --> Ctx
Ctx --> UI
App --> Ctx
Sess --> MW
MW --> Routes
Routes --> Store
```

**Diagram sources**

- [firebase.ts](file://client/src/lib/firebase.ts#L1-L212)
- [firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx#L1-L267)
- [firebase-auth-dialog.tsx](file://client/src/components/auth/firebase-auth-dialog.tsx#L1-L500)
- [App.tsx](file://client/src/App.tsx#L1-L165)
- [index.ts](file://server/index.ts#L1-L114)
- [middleware.ts](file://server/middleware.ts#L1-L18)
- [routes.ts](file://server/routes.ts#L1-L800)
- [storage.ts](file://server/storage.ts#L1-L519)

**Section sources**

- [firebase.ts](file://client/src/lib/firebase.ts#L1-L212)
- [firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx#L1-L267)
- [firebase-auth-dialog.tsx](file://client/src/components/auth/firebase-auth-dialog.tsx#L1-L500)
- [App.tsx](file://client/src/App.tsx#L1-L165)
- [index.ts](file://server/index.ts#L1-L114)
- [middleware.ts](file://server/middleware.ts#L1-L18)
- [routes.ts](file://server/routes.ts#L1-L800)
- [storage.ts](file://server/storage.ts#L1-L519)

## Core Components

- Firebase Authentication client library and user profile model
- React context for centralized auth state and actions
- Authentication dialog supporting email/password and Google OAuth
- Server-side session middleware and RBAC enforcement
- Route-level authorization guards and protected endpoints
- Shared validation schemas for user and resource creation

**Section sources**

- [firebase.ts](file://client/src/lib/firebase.ts#L47-L63)
- [firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx#L18-L34)
- [firebase-auth-dialog.tsx](file://client/src/components/auth/firebase-auth-dialog.tsx#L39-L233)
- [middleware.ts](file://server/middleware.ts#L3-L17)
- [routes.ts](file://server/routes.ts#L110-L132)
- [schema.ts](file://shared/schema.ts#L4-L13)

## Architecture Overview

The system combines Firebase Authentication with a custom server session:

- Firebase manages identity and emits auth state changes
- The client context hydrates user profiles from Firestore
- The server sets and validates session cookies for RBAC
- Middleware enforces authenticated and role-based access
- Routes implement fine-grained authorization checks

```mermaid
sequenceDiagram
participant Browser as "Browser"
participant Firebase as "Firebase Auth<br/>client/lib/firebase.ts"
participant Context as "Auth Context<br/>client/contexts/firebase-auth-context.tsx"
participant Server as "Express Server<br/>server/index.ts"
participant Routes as "Protected Routes<br/>server/routes.ts"
Browser->>Firebase : "Sign in with email/password"
Firebase-->>Context : "Auth state change"
Context->>Context : "Fetch user profile from Firestore"
Context-->>Browser : "currentUser + profile"
Browser->>Server : "Subsequent requests with session cookie"
Server->>Routes : "Apply isAuthenticated / hasRole middleware"
Routes-->>Browser : "Authorized response or 401/403"
```

**Diagram sources**

- [firebase.ts](file://client/src/lib/firebase.ts#L66-L78)
- [firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx#L43-L71)
- [index.ts](file://server/index.ts#L35-L44)
- [routes.ts](file://server/routes.ts#L49-L76)

## Detailed Component Analysis

### Firebase Authentication Client

- Provides typed user roles and profile shape
- Implements login, register, Google sign-in, logout, and password reset
- Updates Firestore user documents and timestamps

```mermaid
flowchart TD
Start(["Client Action"]) --> Choose["Choose Auth Method"]
Choose --> |Email/Password| EmailLogin["loginWithEmail()"]
Choose --> |Google| GoogleLogin["loginWithGoogle()"]
EmailLogin --> UpdateTS["Update lastLogin in Firestore"]
GoogleLogin --> CheckDoc{"Existing Firestore doc?"}
CheckDoc --> |No| NewUser["Return isNewUser flag"]
CheckDoc --> |Yes| UpdateTS
UpdateTS --> Done(["Ready for client routing"])
```

**Diagram sources**

- [firebase.ts](file://client/src/lib/firebase.ts#L66-L150)

**Section sources**

- [firebase.ts](file://client/src/lib/firebase.ts#L47-L63)
- [firebase.ts](file://client/src/lib/firebase.ts#L66-L150)
- [firebase.ts](file://client/src/lib/firebase.ts#L179-L197)

### Authentication Context and UI

- Centralizes auth actions and exposes loading state
- Handles Google OAuth first-time user flow with role selection
- Provides toast feedback and error handling

```mermaid
sequenceDiagram
participant UI as "Auth Dialog<br/>firebase-auth-dialog.tsx"
participant Ctx as "Auth Context<br/>firebase-auth-context.tsx"
participant FB as "Firebase<br/>firebase.ts"
participant Router as "App Router<br/>App.tsx"
UI->>Ctx : "login(email,password)"
Ctx->>FB : "loginWithEmail()"
FB-->>Ctx : "User credential"
Ctx->>FB : "getUserProfile(uid)"
FB-->>Ctx : "UserProfile"
Ctx-->>UI : "currentUser + profile"
UI->>Router : "Navigate to role dashboard"
```

**Diagram sources**

- [firebase-auth-dialog.tsx](file://client/src/components/auth/firebase-auth-dialog.tsx#L98-L118)
- [firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx#L73-L95)
- [firebase.ts](file://client/src/lib/firebase.ts#L199-L212)
- [App.tsx](file://client/src/App.tsx#L113-L124)

**Section sources**

- [firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx#L38-L267)
- [firebase-auth-dialog.tsx](file://client/src/components/auth/firebase-auth-dialog.tsx#L39-L233)
- [App.tsx](file://client/src/App.tsx#L93-L150)

### Server Session and RBAC Middleware

- Express session configured with a memory store and secure cookie
- Middleware enforces authenticated access and role checks
- Routes embed role-based authorization logic

```mermaid
flowchart TD
Req["Incoming Request"] --> IsAuth{"Has req.session.userId?"}
IsAuth --> |No| Deny401["401 Not Authenticated"]
IsAuth --> |Yes| HasRole{"hasRole(roles)?"}
HasRole --> |No| Deny403["403 Forbidden"]
HasRole --> |Yes| Next["Call next() -> Route Handler"]
```

**Diagram sources**

- [index.ts](file://server/index.ts#L35-L44)
- [middleware.ts](file://server/middleware.ts#L3-L17)
- [routes.ts](file://server/routes.ts#L110-L115)

**Section sources**

- [index.ts](file://server/index.ts#L30-L44)
- [middleware.ts](file://server/middleware.ts#L3-L17)
- [routes.ts](file://server/routes.ts#L49-L76)
- [routes.ts](file://server/routes.ts#L110-L132)

### Role-Based Access Control (RBAC)

- Roles: Student, Teacher, Admin, Principal, Parent
- Session carries role for enforcement
- Route-level checks restrict endpoints to permitted roles

```mermaid
classDiagram
class Role {
+Student
+Teacher
+Admin
+Principal
+Parent
}
class Session {
+userId : number
+role : string
}
class Middleware {
+isAuthenticated()
+hasRole(roles : string[])
}
Role <.. Middleware : "enforced by"
Session --> Middleware : "validated by"
```

**Diagram sources**

- [firebase.ts](file://client/src/lib/firebase.ts#L48)
- [express-session.d.ts](file://server/types/express-session.d.ts#L4-L9)
- [middleware.ts](file://server/middleware.ts#L10-L17)

**Section sources**

- [firebase.ts](file://client/src/lib/firebase.ts#L48)
- [express-session.d.ts](file://server/types/express-session.d.ts#L4-L9)
- [routes.ts](file://server/routes.ts#L110-L132)

### Protected Routes and Authorization Patterns

- Authentication: require session presence
- Role-based: restrict endpoints to specific roles
- Ownership: ensure users act on their own resources
- Class scoping: limit access to class-associated data

Examples:

- Tests creation: Teachers only
- Test attempts: Students only
- Answers submission: Students only
- Channel/message access: membership or ownership checks

**Section sources**

- [routes.ts](file://server/routes.ts#L110-L132)
- [routes.ts](file://server/routes.ts#L319-L370)
- [routes.ts](file://server/routes.ts#L417-L463)
- [routes.ts](file://server/routes.ts#L722-L777)

### JWT Token Structure and Security Notes

- The server does not issue JWT tokens; session cookies are used instead
- Session cookie includes userId, role, and other attributes
- Cookie security is configured based on environment (secure flag)

**Section sources**

- [index.ts](file://server/index.ts#L35-L44)
- [express-session.d.ts](file://server/types/express-session.d.ts#L4-L9)

### Password Policies and Account Management

- Client-side validation enforces minimum length for email/password
- Firebase handles password reset flows
- Account management features include profile updates and role-specific fields

**Section sources**

- [LoginPage.tsx](file://client/src/pages/LoginPage.tsx#L20-L38)
- [register.tsx](file://client/src/pages/register.tsx#L36-L46)
- [firebase.ts](file://client/src/lib/firebase.ts#L189-L197)

## Dependency Analysis

- Client depends on Firebase SDK and Firestore for identity and profile persistence
- Server depends on Express session and a storage abstraction for user data
- Shared schemas unify validation across client and server boundaries

```mermaid
graph LR
FB["client/lib/firebase.ts"] --> Ctx["client/contexts/firebase-auth-context.tsx"]
Ctx --> App["client/App.tsx"]
App --> Routes["server/routes.ts"]
Routes --> Store["server/storage.ts"]
Store --> Sess["server/index.ts"]
Routes --> MW["server/middleware.ts"]
Routes --> Schema["shared/schema.ts"]
```

**Diagram sources**

- [firebase.ts](file://client/src/lib/firebase.ts#L1-L212)
- [firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx#L1-L267)
- [App.tsx](file://client/src/App.tsx#L1-L165)
- [routes.ts](file://server/routes.ts#L1-L800)
- [storage.ts](file://server/storage.ts#L1-L519)
- [index.ts](file://server/index.ts#L1-L114)
- [middleware.ts](file://server/middleware.ts#L1-L18)
- [schema.ts](file://shared/schema.ts#L1-L142)

**Section sources**

- [routes.ts](file://server/routes.ts#L1-L800)
- [storage.ts](file://server/storage.ts#L1-L519)
- [schema.ts](file://shared/schema.ts#L1-L142)

## Performance Considerations

- Client auth state hydration uses a race between profile fetch and a timeout to avoid long hangs
- Firestore reads are minimized by caching user profile in context
- Server session store uses memory store; consider scaling to Redis in production

**Section sources**

- [firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx#L53-L59)
- [storage.ts](file://server/storage.ts#L114-L118)

## Troubleshooting Guide

Common issues and resolutions:

- Firebase not configured: client disables auth features and logs a warning
- Authentication errors: client shows user-friendly toasts and rethrows for upstream handling
- Session not set: server routes return 401 for missing session
- Role mismatch: server routes return 403 for unauthorized roles
- CORS/session cookie problems: verify cookie settings and origin configuration

**Section sources**

- [firebase.ts](file://client/src/lib/firebase.ts#L27-L37)
- [firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx#L73-L95)
- [routes.ts](file://server/routes.ts#L88-L107)
- [middleware.ts](file://server/middleware.ts#L3-L8)
- [index.ts](file://server/index.ts#L35-L44)

## Conclusion

PersonalLearningPro’s authentication and authorization combine Firebase Authentication for identity with server-managed sessions and RBAC for access control. The system provides:

- Secure, role-aware routing
- Clear middleware and route-level guards
- Extensible role model and profile management
- Practical UI flows for login, registration, and Google OAuth
