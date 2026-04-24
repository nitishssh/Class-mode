# Database Architecture

## Overview

PersonalLearningPro uses a multi-database architecture optimized for different data access patterns:

- **MongoDB**: Primary structured data store for users, tests, analytics, and application state
- **Cassandra (Astra DB)**: High-performance message storage with automatic fallback to MongoDB
- **Firebase**: Authentication and user identity management

## MongoDB Schema

### Collections

#### Users

Stores user profiles and authentication data.

```typescript
{
  id: number,              // Auto-incrementing ID
  username: string,        // Unique username
  email: string,           // Unique email
  password: string,        // Hashed password
  name: string,            // Display name
  role: enum,              // student | teacher | parent | principal | school_admin | admin
  status: enum,            // active | pending | suspended | rejected
  school_code: string,     // School identifier
  grade: string,           // Student grade level
  board: string,           // Education board
  subjects: string[],      // Enrolled subjects
  district: string,        // Geographic district
  class: string,           // Class/section
  subject: string,         // Primary subject (for teachers)
  firebaseUid: string,     // Firebase auth bridge
  createdAt: Date,
  lastLoginAt: Date
}
```

**Indexes:**

- `{ id: 1 }` (unique)
- `{ username: 1 }` (unique)
- `{ email: 1 }` (unique)
- `{ firebaseUid: 1 }` (sparse, unique)

#### Tests

Test definitions created by teachers.

```typescript
{
  id: number,
  title: string,
  description: string,
  subject: string,
  class: string,
  teacherId: number,
  totalMarks: number,
  duration: number,        // Minutes
  testDate: Date,
  questionTypes: string[],
  status: enum,            // draft | published | completed
  createdAt: Date
}
```

**Indexes:**

- `{ id: 1 }` (unique)
- `{ teacherId: 1, status: 1 }` (compound)
- `{ class: 1, status: 1 }` (compound)
- `{ testDate: 1, status: 1 }` (compound)

#### Questions

Individual questions belonging to tests.

```typescript
{
  id: number,
  testId: number,
  type: enum,              // mcq | short | long | numerical
  text: string,
  options: mixed,          // For MCQ questions
  correctAnswer: string,
  marks: number,
  order: number,
  aiRubric: string
}
```

**Indexes:**

- `{ id: 1 }` (unique)
- `{ testId: 1, order: 1 }` (compound)

#### TestAttempts

Student attempts at tests.

```typescript
{
  id: number,
  testId: number,
  studentId: number,
  startTime: Date,
  endTime: Date,
  score: number,
  status: enum             // in_progress | completed | evaluated
}
```

**Indexes:**

- `{ id: 1 }` (unique)
- `{ studentId: 1, status: 1 }` (compound)
- `{ testId: 1, status: 1 }` (compound)

#### Answers

Student answers to questions.

```typescript
{
  id: number,
  attemptId: number,
  questionId: number,
  text: string,
  selectedOption: number,
  imageUrl: string,
  ocrText: string,
  score: number,
  aiConfidence: number,
  aiFeedback: string,
  isCorrect: boolean
}
```

**Indexes:**

- `{ id: 1 }` (unique)
- `{ attemptId: 1, questionId: 1 }` (compound)

#### TestAssignments

Assignments of tests to students.

```typescript
{
  id: number,
  testId: number,
  studentId: number,
  assignedBy: number,
  assignedDate: Date,
  dueDate: Date,
  status: enum,            // pending | started | completed | overdue
  notificationSent: boolean
}
```

**Indexes:**

- `{ id: 1 }` (unique)
- `{ studentId: 1, status: 1 }` (compound)
- `{ testId: 1 }` (single)
- `{ dueDate: 1, status: 1 }` (compound)

#### Analytics

AI-generated learning insights.

```typescript
{
  id: number,
  userId: number,
  testId: number,
  weakTopics: string[],
  strongTopics: string[],
  recommendedResources: string[],
  insightDate: Date
}
```

**Indexes:**

- `{ id: 1 }` (unique)
- `{ userId: 1, insightDate: -1 }` (compound)
- `{ testId: 1 }` (single)

#### Workspaces

Collaboration spaces for teams.

```typescript
{
  id: number,
  name: string,
  description: string,
  ownerId: number,
  members: number[],
  createdAt: Date
}
```

**Indexes:**

- `{ id: 1 }` (unique)
- `{ members: 1 }` (single)
- `{ ownerId: 1 }` (single)

#### Channels

Communication channels within workspaces.

```typescript
{
  id: number,
  workspaceId: number,
  name: string,
  type: enum,              // text | announcement | dm
  class: string,
  subject: string,
  pinnedMessages: number[],
  category: enum,
  isReadOnly: boolean,
  participants: string[],
  unreadCounts: Map,
  typingUsers: string[],
  createdAt: Date
}
```

**Indexes:**

- `{ id: 1 }` (unique)
- `{ workspaceId: 1, type: 1 }` (compound)
- `{ type: 1, name: 1 }` (compound)
- `{ class: 1, subject: 1 }` (compound)

#### Messages (MongoDB Fallback)

Messages when Cassandra is unavailable.

```typescript
{
  id: number,
  channelId: number,
  authorId: number,
  content: string,
  type: enum,              // text | file | image
  fileUrl: string,
  isPinned: boolean,
  isHomework: boolean,
  gradingStatus: enum,     // pending | graded | null
  readBy: number[],
  senderRole: enum,
  messageType: enum,
  replyTo: number,
  mentions: string[],
  isDoubtAnswered: boolean,
  assignmentData: object,
  deliveredTo: string[],
  createdAt: Date
}
```

**Indexes:**

- `{ id: 1 }` (unique)
- `{ channelId: 1, createdAt: -1 }` (compound)
- `{ channelId: 1, isPinned: 1 }` (compound)
- `{ authorId: 1, createdAt: -1 }` (compound)
- `{ isHomework: 1, gradingStatus: 1 }` (compound)

#### Sessions

User authentication sessions.

```typescript
{
  id: number,
  userId: number,
  refreshTokenHash: string,
  deviceInfo: string,
  ipAddress: string,
  createdAt: Date,
  expiresAt: Date
}
```

**Indexes:**

- `{ id: 1 }` (unique)
- `{ userId: 1 }` (single)
- `{ refreshTokenHash: 1 }` (single)
- `{ expiresAt: 1 }` (TTL index - auto-cleanup)

#### OTPs

One-time passwords for verification.

```typescript
{
  id: number,
  userId: number,
  otpHash: string,
  type: enum,              // registration | password_reset | 2fa
  expiresAt: Date,
  used: boolean
}
```

**Indexes:**

- `{ id: 1 }` (unique)
- `{ userId: 1, type: 1, used: 1 }` (compound)
- `{ expiresAt: 1 }` (TTL index - auto-cleanup)

#### LiveClasses

Scheduled live video classes.

```typescript
{
  id: number,
  title: string,
  description: string,
  teacherId: number,
  class: string,
  scheduledTime: Date,
  durationMinutes: number,
  status: enum,            // scheduled | live | completed | cancelled
  dailyRoomName: string,
  dailyRoomUrl: string,
  startedAt: Date,
  endedAt: Date,
  recordingUrl: string,
  createdAt: Date
}
```

**Indexes:**

- `{ id: 1 }` (unique)
- `{ class: 1, scheduledTime: -1 }` (compound)
- `{ teacherId: 1, status: 1 }` (compound)
- `{ status: 1, scheduledTime: 1 }` (compound)

#### LiveSessionAttendance

Attendance tracking for live classes.

```typescript
{
  id: number,
  sessionId: number,
  studentId: number,
  joinedAt: Date,
  leftAt: Date,
  durationMinutes: number
}
```

**Indexes:**

- `{ id: 1 }` (unique)
- `{ sessionId: 1, studentId: 1 }` (compound)

#### Tasks

Student task management.

```typescript
{
  id: number,
  userId: number,
  title: string,
  status: enum,            // backlog | todo | in-progress | review | done
  priority: enum,          // low | medium | high | urgent
  tags: string[],
  dueDate: string,
  comments: number,
  attachments: number,
  createdAt: Date
}
```

**Indexes:**

- `{ id: 1 }` (unique)
- `{ userId: 1 }` (single)

#### Notifications

User notifications.

```typescript
{
  id: number,
  userId: number,
  type: enum,              // test | result | announcement | message | achievement | reminder
  title: string,
  body: string,
  isRead: boolean,
  meta: string,
  createdAt: Date
}
```

**Indexes:**

- `{ id: 1 }` (unique)
- `{ userId: 1, createdAt: -1 }` (compound)

#### FocusSession

Pomodoro timer sessions.

```typescript
{
  id: number,
  userId: number,
  subject: string,
  mode: enum,              // work | short | long
  durationSeconds: number,
  completedAt: Date
}
```

**Indexes:**

- `{ id: 1 }` (unique)
- `{ userId: 1, completedAt: -1 }` (compound)

#### FCMTokens

Firebase Cloud Messaging tokens for push notifications.

```typescript
{
  id: number,
  userId: number,
  token: string,
  deviceType: string,
  updatedAt: Date
}
```

**Indexes:**

- `{ id: 1 }` (unique)
- `{ userId: 1, token: 1 }` (compound, unique)

## Cassandra Schema

### Messages Table

High-performance message storage partitioned by channel.

```cql
CREATE TABLE messages (
  channel_id      text,
  message_id      text,
  author_id       bigint,
  content         text,
  type            text,
  file_url        text,
  is_pinned       boolean,
  is_homework     boolean,
  grading_status  text,
  read_by         list<bigint>,
  attachments     list<text>,
  created_at      timestamp,
  PRIMARY KEY (channel_id, message_id)
) WITH CLUSTERING ORDER BY (message_id DESC)
AND compaction = {'class': 'TimeWindowCompactionStrategy'}
AND default_time_to_live = 0;
```

**Indexes:**

- `messages_is_pinned_idx` on `is_pinned`

**Partition Key:** `channel_id` - All messages for a channel are stored together
**Clustering Key:** `message_id` - Messages sorted by Snowflake ID (time-sortable)

## Connection Configuration

### MongoDB

```typescript
{
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  retryReads: true
}
```

### Cassandra

```typescript
{
  pooling: {
    coreConnectionsPerHost: { [0]: 2, [1]: 1 }
  },
  queryOptions: {
    consistency: LOCAL_ONE,
    prepare: true
  },
  socketOptions: {
    connectTimeout: 5000,
    readTimeout: 12000
  }
}
```

## Best Practices

### Query Optimization

1. Always use indexed fields in queries
2. Limit result sets with pagination
3. Use projection to fetch only needed fields
4. Avoid N+1 queries with aggregation

### Data Consistency

1. Use transactions for multi-document updates
2. Implement optimistic locking for concurrent updates
3. Validate data at application layer before database writes

### Performance

1. Cache frequently accessed data
2. Use compound indexes for common query patterns
3. Monitor slow queries (>500ms warning, >1000ms alert)
4. Batch operations when processing multiple items

### Monitoring

- Health check endpoint: `GET /api/health`
- Detailed health: `GET /api/health/detailed`
- Connection status tracked in real-time
- Automatic reconnection with exponential backoff

## Maintenance

### Index Creation

Indexes are created automatically on application startup. To manually create:

```javascript
// MongoDB
db.collection.createIndex({ field: 1 })

// Cassandra
CREATE INDEX IF NOT EXISTS index_name ON table (column);
```

### Data Cleanup

- Sessions: Auto-expire via TTL index
- OTPs: Auto-expire via TTL index
- Old messages: Manual cleanup recommended (implement retention policy)

### Backup Strategy

1. MongoDB: Use mongodump or Atlas automated backups
2. Cassandra: Astra DB provides automatic backups
3. Frequency: Daily incremental, weekly full backup
4. Retention: 30 days minimum

## Troubleshooting

### Connection Issues

1. Check environment variables
2. Verify network connectivity
3. Check connection pool exhaustion
4. Review error logs for specific errors

### Performance Issues

1. Check slow query logs
2. Analyze index usage
3. Monitor connection pool metrics
4. Review query patterns

### Data Inconsistency

1. Check for failed transactions
2. Verify dual-write operations (Cassandra + MongoDB)
3. Review application logs for errors
4. Implement data reconciliation scripts if needed
