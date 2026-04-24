# 🔐 Login Flow System Design

## AI-Powered Personalized Learning App — Firebase Implementation

---

## 👥 User Roles

| Role         | Access Level                                    | Firebase Custom Claim  |
| ------------ | ----------------------------------------------- | ---------------------- |
| Student      | Personal dashboard, tests, chatbot, leaderboard | `role: "student"`      |
| Teacher      | Classroom dashboard, test creation, analytics   | `role: "teacher"`      |
| School Admin | School-wide reports, teacher management         | `role: "school_admin"` |
| Admin        | Full system access, institution management      | `role: "admin"`        |

> Roles are set using **Firebase Custom Claims** via Admin SDK on the backend.

---

## 🗺️ Master Login Flow

```
[App Launch]
      │
      ▼
[Splash Screen / Onboarding]
      │
      ├──── New User? ────────────────────► [Register Flow]
      │
      └──── Returning User? ─────────────► [Login Screen]
```

---

## 1️⃣ Registration Flow

```
[Register Screen]
      │
      ├─ Select Role: [Student] [Teacher] [School Admin]
      │
      ▼
[Enter Basic Info]
  - Full Name
  - Email / Phone Number
  - Password + Confirm Password
      │
      ▼
[Role-Specific Info]
  ┌───────────────────────────────────────────────┐
  │ Student          │ Teacher       │ School Admin│
  │ - Class/Grade    │ - Subject(s)  │ - School    │
  │ - School Code    │ - School Code │   Name      │
  │ - Board (CBSE/   │ - Experience  │ - District  │
  │   ICSE/State)    │               │             │
  └───────────────────────────────────────────────┘
      │
      ▼
[Firebase: createUserWithEmailAndPassword(auth, email, password)]
      │
      ▼
[Firebase: sendEmailVerification(user)]
  OR
[Firebase Phone Auth: signInWithPhoneNumber(auth, phoneNumber, appVerifier)]
→ Returns: confirmationResult
→ User enters OTP
→ confirmationResult.confirm(otpCode)
      │
      ├── OTP / Email Verified? ──YES──►
      │                              │
      │                      [Firestore: Create User Document]
      │                      Collection: "users"
      │                      Document ID: firebase_uid
      │                      Fields: {
      │                        name, email, phone,
      │                        role, school_code,
      │                        status: "active",     ← Students
      │                        status: "pending",    ← Teachers
      │                        grade, board,         ← Students only
      │                        subjects,             ← Teachers only
      │                        createdAt: serverTimestamp()
      │                      }
      │                              │
      │                      [Backend: Set Custom Claims]
      │                      admin.auth().setCustomUserClaims(uid, { role })
      │                              │
      │                      [Redirect to Role Dashboard]
      │
      └── Not Verified? ──► [Show Resend Option]
                            [Firebase: sendEmailVerification(user)]
```

---

## 2️⃣ Login Flow

```
[Login Screen]
  - Email + Password
  - [Login with Google]
  - [Login with Apple]
  - [Forgot Password?]
      │
      ▼
[Firebase: signInWithEmailAndPassword(auth, email, password)]
      │
      ├── auth/wrong-password ──────► [Show "Invalid credentials" error]
      ├── auth/user-not-found ──────► [Show "No account found" error]
      ├── auth/too-many-requests ───► [Show "Account temporarily locked" error]
      │                               Firebase auto-locks after repeated failures
      │
      └── SUCCESS?
              │
              ▼
      [Fetch Firestore User Document]
      db.collection("users").doc(uid).get()
              │
              ├── status === "pending"   ──► [Awaiting Approval Screen]
              ├── status === "suspended" ──► [Suspension Notice]
              │
              └── status === "active" ──►
                          │
                          ▼
                  [Get ID Token + Custom Claims]
                  user.getIdTokenResult()
                  → claims.role
                          │
                          ├── "student"      ──► [Student Dashboard]
                          ├── "teacher"      ──► [Teacher Dashboard]
                          ├── "school_admin" ──► [School Admin Panel]
                          └── "admin"        ──► [Super Admin Panel]
```

---

## 3️⃣ Forgot Password Flow

```
[Forgot Password Screen]
  - Enter registered Email
      │
      ▼
[Firebase: sendPasswordResetEmail(auth, email)]
      │
      ▼
[User receives reset link in Email]
  → Firebase handles link generation & expiry automatically
      │
      ▼
[User clicks link → Firebase-hosted Reset Page]
  OR
[Custom Reset Page using Firebase Action Code]
  firebase.auth().verifyPasswordResetCode(actionCode)
      │
      ├── Valid Code? ──►
      │               │
      │       [Show New Password Input]
      │       - Min 8 characters
      │       - 1 Uppercase, 1 Number, 1 Special Char (client-side validation)
      │               │
      │               ▼
      │       [Firebase: confirmPasswordReset(auth, actionCode, newPassword)]
      │               │
      │               ▼
      │       [Password Reset Success → Redirect to Login]
      │
      └── Invalid / Expired Code? ──► [Show Error + Resend Option]
```

---

## 4️⃣ Social Login Flow (Google / Apple)

```
[Click "Login with Google"]
──────────────────────────
[Firebase: signInWithPopup(auth, new GoogleAuthProvider())]
  OR (Mobile)
[Firebase: signInWithRedirect(auth, new GoogleAuthProvider())]
      │
      ├── User Cancels? ──► [Return to Login Screen]
      │
      └── SUCCESS?
              │
              ▼
      [Check Firestore: users collection for uid]
              │
              ├── Document EXISTS? ──►
              │           │
              │   [Check status field]
              │           ├── active    ──► [Get Claims → Role Dashboard]
              │           ├── pending   ──► [Awaiting Approval Screen]
              │           └── suspended ──► [Suspension Notice]
              │
              └── Document NOT EXISTS? (New User)
                          │
                          ▼
                  [Role Selection Screen]
                          │
                          ▼
                  [Role-Specific Info Collection]
                          │
                          ▼
                  [Firestore: Create User Document]
                  [Backend: Set Custom Claims via Admin SDK]
                          │
                          ▼
                  [Redirect to Role Dashboard]


[Click "Login with Apple"]
──────────────────────────
[Firebase: signInWithPopup(auth, new OAuthProvider('apple.com'))]
→ Same flow as Google above
```

---

## 5️⃣ Session & Token Management

```
Firebase handles JWT Access Tokens automatically.
No manual token generation needed.

[Successful Login]
      │
      ▼
[Firebase issues ID Token (1hr TTL) + Refresh Token (auto-managed)]
      │
      ▼
[Firebase SDK auto-refreshes ID Token silently before expiry]
      │
      ▼
[For API/Backend calls: always send ID Token in Authorization header]
  user.getIdToken() → attach as Bearer token
  Backend: admin.auth().verifyIdToken(idToken)
      │
      ├── Token Valid? ──► [Process Request]
      │
      └── Token Invalid / Expired?
              │
              Firebase SDK auto-retries with Refresh Token
              If Refresh Token is also invalid:
              └──► [onAuthStateChanged fires with null] ──► [Redirect to Login]
```

---

## 6️⃣ Auto-Login / Remember Me Flow

```
[App Relaunch]
      │
      ▼
[Firebase: onAuthStateChanged(auth, (user) => { ... })]
      │
      ├── user !== null (Token still valid / auto-refreshed)
      │           │
      │           ▼
      │   [Fetch Firestore user doc]
      │   [Check status + claims]
      │           │
      │           └──► [Redirect to Role Dashboard]
      │
      └── user === null (No session / expired)
                  │
                  ▼
          [Show Login Screen]


Persistence Options:
──────────────────────────────────────────────────────────────────
Web:
  setPersistence(auth, browserLocalPersistence)    ← Remember Me ON
  setPersistence(auth, browserSessionPersistence)  ← Remember Me OFF
  setPersistence(auth, inMemoryPersistence)        ← No persistence

Mobile (React Native):
  Firebase React Native SDK persists session automatically via AsyncStorage
```

---

## 7️⃣ Multi-Device Logout Flow

```
[Logout This Device]
──────────────────────
[Firebase: signOut(auth)]
  → Clears local token
  → onAuthStateChanged fires with null
  → Redirect to Login Screen


[Logout All Devices]
──────────────────────
Firebase does not natively revoke all sessions, so:

Step 1: [Backend: admin.auth().revokeRefreshTokens(uid)]
      │
      ▼
Step 2: [Firestore: update user doc]
  db.collection("users").doc(uid).update({
    tokensValidAfterTime: new Date().toISOString()
  })
      │
      ▼
Step 3: [Backend middleware checks tokensValidAfterTime on every request]
  if (decodedToken.iat < tokensValidAfterTime) → reject request
      │
      ▼
[All existing sessions invalidated → Users redirected to Login]
```

---

## 8️⃣ Teacher Account Approval Flow

```
[Teacher Registers]
      │
      ▼
[Firestore user doc created with status: "pending"]
      │
      ▼
[Firebase Cloud Function triggers on new "pending" teacher doc]
  functions.firestore.document("users/{uid}").onCreate()
  → Sends email notification to School Admin (via Nodemailer / SendGrid)
      │
      ▼
[School Admin logs into Admin Panel]
[Firestore query for pending teachers:]
  db.collection("users")
    .where("role", "==", "teacher")
    .where("status", "==", "pending")
    .get()
      │
      ├── Approved?
      │       │
      │       ▼
      │   [Firestore: update({ status: "active" })]
      │   [Backend: admin.auth().setCustomUserClaims(uid, { role: "teacher" })]
      │   [Cloud Function: send approval email to teacher]
      │
      └── Rejected?
              │
              ▼
          [Firestore: update({ status: "rejected" })]
          [Cloud Function: send rejection email with reason]
```

---

## 🔐 Firestore Security Rules

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read/write their own document
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
      // Only admins can update status or role fields
      allow update: if request.auth.token.role == "admin"
                    || request.auth.token.role == "school_admin";
    }

    // Tests: teachers can create, students can only read
    match /tests/{testId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth.token.role == "teacher"
                             || request.auth.token.role == "admin";
      allow delete: if request.auth.token.role == "admin";
    }

    // Performance data: students own their data, teachers can read their class
    match /performance/{userId} {
      allow read, write: if request.auth.uid == userId;
      allow read: if request.auth.token.role == "teacher"
                  || request.auth.token.role == "admin";
    }
  }
}
```

---

## 🔒 Security Summary

| Rule                  | Firebase Implementation                                                        |
| --------------------- | ------------------------------------------------------------------------------ |
| Account Lockout       | Automatic via `auth/too-many-requests`                                         |
| OTP Expiry            | Firebase Phone Auth manages automatically                                      |
| Password Reset Expiry | Firebase manages action code TTL                                               |
| ID Token TTL          | 1 hour (auto-refreshed by SDK)                                                 |
| Refresh Token         | Managed by Firebase, revocable via Admin SDK                                   |
| 2FA                   | Firebase Identity Platform (Blaze plan) or custom via Twilio + Cloud Functions |
| RBAC                  | Firebase Custom Claims + Firestore Security Rules                              |
| Password Hashing      | Firebase Authentication handles internally                                     |
| Email Verification    | `sendEmailVerification()` built-in                                             |

---

## 🗃️ Firestore Collections (Auth-Related)

```
Collection: "users"
Document ID: firebase_uid
Fields:
  ├── name: string
  ├── email: string
  ├── phone: string
  ├── role: "student" | "teacher" | "school_admin" | "admin"
  ├── status: "active" | "pending" | "suspended" | "rejected"
  ├── school_code: string
  ├── grade: string                   (students only)
  ├── board: string                   (students only)
  ├── subjects: array                 (teachers only)
  ├── tokensValidAfterTime: timestamp (for logout-all-devices)
  ├── createdAt: timestamp
  └── lastLoginAt: timestamp

Collection: "schools"
Document ID: school_code
Fields:
  ├── name: string
  ├── admin_uid: string
  ├── district: string
  └── createdAt: timestamp
```

---

## 🔄 Firebase Auth Methods Reference

| Flow                      | Firebase Method                                               |
| ------------------------- | ------------------------------------------------------------- |
| Register with Email       | `createUserWithEmailAndPassword(auth, email, password)`       |
| Email Verification        | `sendEmailVerification(user)`                                 |
| Phone OTP Send            | `signInWithPhoneNumber(auth, phone, appVerifier)`             |
| Phone OTP Confirm         | `confirmationResult.confirm(otpCode)`                         |
| Login with Email          | `signInWithEmailAndPassword(auth, email, password)`           |
| Login with Google         | `signInWithPopup(auth, new GoogleAuthProvider())`             |
| Login with Apple          | `signInWithPopup(auth, new OAuthProvider('apple.com'))`       |
| Forgot Password           | `sendPasswordResetEmail(auth, email)`                         |
| Confirm Password Reset    | `confirmPasswordReset(auth, actionCode, newPassword)`         |
| Get ID Token              | `user.getIdToken()`                                           |
| Get Claims                | `user.getIdTokenResult()` → `.claims.role`                    |
| Auth State Listener       | `onAuthStateChanged(auth, callback)`                          |
| Set Persistence           | `setPersistence(auth, browserLocalPersistence)`               |
| Logout                    | `signOut(auth)`                                               |
| Revoke All Sessions       | `admin.auth().revokeRefreshTokens(uid)` ← Admin SDK           |
| Set Custom Claims         | `admin.auth().setCustomUserClaims(uid, { role })` ← Admin SDK |
| Verify ID Token (Backend) | `admin.auth().verifyIdToken(idToken)` ← Admin SDK             |

---

_Built on Firebase Authentication + Firestore + Firebase Admin SDK + Cloud Functions._
_Custom Claims power RBAC. Firestore Security Rules enforce access control at the data layer._
