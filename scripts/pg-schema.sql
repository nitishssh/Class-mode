-- Complete PostgreSQL schema for PersonalLearningPro
-- Replaces MongoDB entirely.
-- Run via: npx tsx scripts/pg-migrate.ts
-- All statements are idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING).

-- Skip CREATE EXTENSION when already installed: managed Postgres (Azure) rejects
-- CREATE EXTENSION for non-trusted extensions from the app role even with
-- IF NOT EXISTS, so the extensions are pre-created by the admin during provisioning.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext') THEN
    CREATE EXTENSION citext;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    CREATE EXTENSION vector;
  END IF;
END $$;

-- Session-only bump: the ivfflat index build (content_chunks, lists=100) needs
-- ~60MB, more than the 32MB default on the memory-capped dev container.
SET maintenance_work_mem = '80MB';

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                   bigserial    PRIMARY KEY,
  auth_provider        text         NOT NULL DEFAULT 'firebase',
  auth_subject         text         NOT NULL,
  email                citext       NOT NULL UNIQUE,
  username             text         UNIQUE,
  password_hash        text,
  name                 text,
  display_name         text,
  avatar               text,
  email_verified       boolean      NOT NULL DEFAULT false,
  role                 text         NOT NULL DEFAULT 'student'
                         CHECK (role IN ('student','teacher','parent','principal','school_admin','admin')),
  status               text         NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','pending','suspended','rejected')),
  school_code          text,
  school_id            bigint,
  parent_id            bigint,
  grade                text,
  board                text,
  subjects             text[]       NOT NULL DEFAULT '{}',
  district             text,
  class_name           text,
  subject              text,
  onboarding_complete  boolean      NOT NULL DEFAULT false,
  study_plan           jsonb        NOT NULL DEFAULT '{}',
  created_at           timestamptz  NOT NULL DEFAULT now(),
  last_login_at        timestamptz,
  UNIQUE (auth_provider, auth_subject)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type TEXT;
-- Parent's WhatsApp number on the student row (parents rarely have accounts);
-- used for absence notifications and fee reminders.
ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_phone text;

-- ─── Schools ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schools (
  id                  bigserial    PRIMARY KEY,
  code                text         NOT NULL UNIQUE,
  name                text         NOT NULL,
  city                text,
  district            text,
  board               text,
  logo                text,
  grades_offered      text[]       NOT NULL DEFAULT '{}',
  created_by_uid      text,
  onboarding_complete boolean      NOT NULL DEFAULT false,
  created_at          timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE schools ADD COLUMN IF NOT EXISTS approximate_students TEXT;

-- ─── RBAC ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id   bigserial  PRIMARY KEY,
  key  text       NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS permissions (
  id   bigserial  PRIMARY KEY,
  key  text       NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS memberships (
  id          bigserial    PRIMARY KEY,
  user_id     bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id   bigint       REFERENCES schools(id),
  status      text         NOT NULL CHECK (status IN ('active','pending','suspended','rejected')),
  created_at  timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (user_id, school_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id        bigint  NOT NULL REFERENCES roles(id),
  permission_id  bigint  NOT NULL REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS membership_roles (
  membership_id  bigint       NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  role_id        bigint       NOT NULL REFERENCES roles(id),
  assigned_by    bigint       REFERENCES users(id),
  assigned_at    timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (membership_id, role_id)
);

-- ─── Invites ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invites (
  id            bigserial    PRIMARY KEY,
  email         citext       NOT NULL,
  name          text,
  role          text         NOT NULL,
  school_id     bigint       REFERENCES schools(id),
  class_id      text,
  grades        text[]       NOT NULL DEFAULT '{}',
  token         text         NOT NULL UNIQUE,
  status        text         NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','expired')),
  invited_by    text,
  expires_at    timestamptz  NOT NULL,
  created_at    timestamptz  NOT NULL DEFAULT now()
);

-- ─── School Classes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS school_classes (
  id                    bigserial    PRIMARY KEY,
  name                  text         NOT NULL,
  grade                 text,
  teacher_firebase_uid  text,
  school_id             bigint       REFERENCES schools(id),
  students              text[]       NOT NULL DEFAULT '{}',
  created_at            timestamptz  NOT NULL DEFAULT now()
);

-- ─── Learning Resources (Learn hub → Read tab) ───────────────────────────────
CREATE TABLE IF NOT EXISTS resources (
  id           bigserial    PRIMARY KEY,
  title        text         NOT NULL,
  description  text,
  type         text         NOT NULL DEFAULT 'textbook',  -- textbook | video | lab
  subject      text,
  topic        text,
  url          text,
  created_at   timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resources_topic_idx ON resources ((lower(topic)));
CREATE INDEX IF NOT EXISTS resources_subject_idx ON resources ((lower(subject)));

-- ─── Audit Events ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_events (
  id              bigserial    PRIMARY KEY,
  actor_user_id   bigint       REFERENCES users(id),
  target_user_id  bigint       REFERENCES users(id),
  school_code     text,
  event_type      text         NOT NULL,
  payload         jsonb        NOT NULL DEFAULT '{}',
  created_at      timestamptz  NOT NULL DEFAULT now()
);

-- ─── Sessions (refresh tokens) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id                  bigserial    PRIMARY KEY,
  user_id             bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash  text         NOT NULL,
  device_info         text,
  ip_address          text,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  expires_at          timestamptz  NOT NULL
);

-- ─── OTPs ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otps (
  id          bigserial    PRIMARY KEY,
  user_id     bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp_hash    text         NOT NULL,
  type        text         NOT NULL CHECK (type IN ('registration','password_reset','2fa')),
  expires_at  timestamptz  NOT NULL,
  used        boolean      NOT NULL DEFAULT false,
  attempts    int          NOT NULL DEFAULT 0,
  created_at  timestamptz  NOT NULL DEFAULT now()
);
ALTER TABLE otps ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0;

-- ─── Tests ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tests (
  id              bigserial    PRIMARY KEY,
  title           text         NOT NULL,
  description     text,
  subject         text         NOT NULL,
  class_name      text         NOT NULL,
  teacher_id      bigint       NOT NULL REFERENCES users(id),
  total_marks     int          NOT NULL DEFAULT 100,
  duration        int          NOT NULL DEFAULT 60,
  test_date       timestamptz  NOT NULL,
  question_types  text[]       NOT NULL DEFAULT '{}',
  status          text         NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','completed')),
  created_at      timestamptz  NOT NULL DEFAULT now()
);

-- ─── Questions ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id              bigserial  PRIMARY KEY,
  test_id         bigint     NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  type            text       NOT NULL CHECK (type IN ('mcq','short','long','numerical')),
  text            text       NOT NULL,
  options         jsonb,
  correct_answer  text,
  marks           int        NOT NULL DEFAULT 1,
  ord             int        NOT NULL,
  ai_rubric       text
);

-- ─── Test Attempts ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_attempts (
  id          bigserial    PRIMARY KEY,
  test_id     bigint       NOT NULL REFERENCES tests(id),
  student_id  bigint       NOT NULL REFERENCES users(id),
  start_time  timestamptz  NOT NULL DEFAULT now(),
  end_time    timestamptz,
  score       numeric,
  status      text         NOT NULL DEFAULT 'in_progress'
                CHECK (status IN ('in_progress','completed','evaluated'))
);

-- ─── Answers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS answers (
  id               bigserial  PRIMARY KEY,
  attempt_id       bigint     NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
  question_id      bigint     NOT NULL REFERENCES questions(id),
  text             text,
  selected_option  int,
  image_url        text,
  ocr_text         text,
  score            numeric,
  ai_confidence    numeric,
  ai_feedback      text,
  is_correct       boolean
);

-- ─── Analytics ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics (
  id                     bigserial    PRIMARY KEY,
  user_id                bigint       NOT NULL REFERENCES users(id),
  test_id                bigint       NOT NULL REFERENCES tests(id),
  weak_topics            text[]       NOT NULL DEFAULT '{}',
  strong_topics          text[]       NOT NULL DEFAULT '{}',
  recommended_resources  text[]       NOT NULL DEFAULT '{}',
  insight_date           timestamptz  NOT NULL DEFAULT now()
);

-- ─── Test Assignments ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_assignments (
  id                 bigserial    PRIMARY KEY,
  test_id            bigint       NOT NULL REFERENCES tests(id),
  student_id         bigint       NOT NULL REFERENCES users(id),
  assigned_by        bigint       NOT NULL REFERENCES users(id),
  assigned_date      timestamptz  NOT NULL DEFAULT now(),
  due_date           timestamptz  NOT NULL,
  status             text         NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','started','completed','overdue')),
  notification_sent  boolean      NOT NULL DEFAULT false
);

-- ─── Workspaces ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
  id           bigserial    PRIMARY KEY,
  name         text         NOT NULL,
  slug         text         UNIQUE,
  type         text         NOT NULL DEFAULT 'business'
                 CHECK (type IN ('business','school','personal')),
  description  text,
  owner_id     bigint       NOT NULL REFERENCES users(id),
  members      bigint[]     NOT NULL DEFAULT '{}',
  created_at   timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS slug text UNIQUE;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'business';

CREATE TABLE IF NOT EXISTS workspace_memberships (
  id            bigserial    PRIMARY KEY,
  workspace_id  bigint       NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          text         NOT NULL CHECK (role IN ('owner','admin','member')),
  status        text         NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','pending','suspended','rejected')),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS workspace_invites (
  id              bigserial    PRIMARY KEY,
  workspace_id    bigint       NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email           citext       NOT NULL,
  name            text,
  role            text         NOT NULL CHECK (role IN ('admin','member')),
  kind            text         NOT NULL CHECK (kind IN ('business_member','student')),
  token_hash      text         NOT NULL UNIQUE,
  status          text         NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','accepted','expired','revoked')),
  invited_by      bigint       REFERENCES users(id),
  student_meta    jsonb        NOT NULL DEFAULT '{}',
  expires_at      timestamptz  NOT NULL,
  accepted_at     timestamptz,
  created_at      timestamptz  NOT NULL DEFAULT now()
);

-- ─── Channels ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channels (
  id               bigserial    PRIMARY KEY,
  workspace_id     bigint       REFERENCES workspaces(id),
  name             text         NOT NULL,
  type             text         NOT NULL DEFAULT 'text'
                     CHECK (type IN ('text','announcement','dm')),
  class_name       text,
  subject          text,
  pinned_messages  bigint[]     NOT NULL DEFAULT '{}',
  category         text         DEFAULT 'class',
  is_read_only     boolean      NOT NULL DEFAULT false,
  participants     text[]       NOT NULL DEFAULT '{}',
  unread_counts    jsonb        NOT NULL DEFAULT '{}',
  typing_users     text[]       NOT NULL DEFAULT '{}',
  created_at       timestamptz  NOT NULL DEFAULT now()
);

-- ─── Messages ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id                 bigserial    PRIMARY KEY,
  channel_id         bigint       NOT NULL REFERENCES channels(id),
  author_id          bigint       NOT NULL REFERENCES users(id),
  content            text         NOT NULL,
  type               text         NOT NULL DEFAULT 'text'
                       CHECK (type IN ('text','file','image')),
  file_url           text,
  is_pinned          boolean      NOT NULL DEFAULT false,
  is_homework        boolean      NOT NULL DEFAULT false,
  grading_status     text         CHECK (grading_status IN ('pending','graded')),
  read_by            bigint[]     NOT NULL DEFAULT '{}',
  sender_role        text         DEFAULT 'student',
  message_type       text         DEFAULT 'text',
  reply_to           bigint,
  mentions           text[]       NOT NULL DEFAULT '{}',
  is_doubt_answered  boolean      NOT NULL DEFAULT false,
  assignment_data    jsonb,
  delivered_to       text[]       NOT NULL DEFAULT '{}',
  created_at         timestamptz  NOT NULL DEFAULT now()
);

-- ─── Live Classes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_classes (
  id                bigserial    PRIMARY KEY,
  title             text         NOT NULL,
  description       text,
  teacher_id        bigint       NOT NULL REFERENCES users(id),
  class_name        text         NOT NULL,
  scheduled_time    timestamptz  NOT NULL,
  duration_minutes  int          NOT NULL DEFAULT 60,
  status            text         NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled','live','completed','cancelled')),
  daily_room_name   text,
  daily_room_url    text,
  started_at        timestamptz,
  ended_at          timestamptz,

  recording_url     text,
  created_at        timestamptz  NOT NULL DEFAULT now()
);

-- ─── Live Session Attendance ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_session_attendance (
  id                bigserial    PRIMARY KEY,
  session_id        bigint       NOT NULL REFERENCES live_classes(id),
  student_id        bigint       NOT NULL REFERENCES users(id),
  joined_at         timestamptz  NOT NULL DEFAULT now(),
  left_at           timestamptz,
  duration_minutes  int          NOT NULL DEFAULT 0
);

-- ─── FCM Tokens ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id           bigserial    PRIMARY KEY,
  user_id      bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token        text         NOT NULL,
  device_type  text,
  updated_at   timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

-- ─── Tasks ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id           bigserial    PRIMARY KEY,
  user_id      bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        text         NOT NULL,
  status       text         NOT NULL DEFAULT 'todo'
                 CHECK (status IN ('backlog','todo','in-progress','review','done')),
  priority     text         NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('low','medium','high','urgent')),
  tags         text[]       NOT NULL DEFAULT '{}',
  due_date     text,
  comments     int          NOT NULL DEFAULT 0,
  attachments  int          NOT NULL DEFAULT 0,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

-- ─── Notifications ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          bigserial    PRIMARY KEY,
  user_id     bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        text         NOT NULL
                CHECK (type IN ('test','result','announcement','message','achievement','reminder')),
  title       text         NOT NULL,
  body        text         NOT NULL,
  is_read     boolean      NOT NULL DEFAULT false,
  meta        text,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

-- ─── Focus Sessions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS focus_sessions (
  id                bigserial    PRIMARY KEY,
  user_id           bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject           text         NOT NULL,
  mode              text         NOT NULL CHECK (mode IN ('work','short','long')),
  duration_seconds  int          NOT NULL,
  completed_at      timestamptz  NOT NULL DEFAULT now()
);

-- ─── AI Classrooms ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_classrooms (
  id                  bigserial    PRIMARY KEY,
  teacher_id          bigint       NOT NULL REFERENCES users(id),
  topic               text         NOT NULL,
  study_arena_job_id  text         NOT NULL,
  data                jsonb,
  status              text         NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','generating','ready','error')),
  created_at          timestamptz  NOT NULL DEFAULT now()
);

-- ─── Grading Results ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grading_results (
  id                     bigserial    PRIMARY KEY,
  submission_id          text         NOT NULL,
  student_id             bigint       NOT NULL REFERENCES users(id),
  teacher_id             bigint       NOT NULL REFERENCES users(id),
  rubric                 jsonb        NOT NULL,
  score_breakdown        jsonb,
  overall_feedback       text,
  strengths              text[]       NOT NULL DEFAULT '{}',
  areas_for_improvement  text[]       NOT NULL DEFAULT '{}',
  status                 text         NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','completed','failed')),
  model_used             text,
  processing_time_ms     int,
  attachments            text[]       NOT NULL DEFAULT '{}',
  content_type           text         DEFAULT 'text'
                           CHECK (content_type IN ('text','code_python','code_javascript','code_typescript','pdf')),
  created_at             timestamptz  NOT NULL DEFAULT now(),
  completed_at           timestamptz
);

-- ─── LMS Connections ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lms_connections (
  id             bigserial    PRIMARY KEY,
  user_id        bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider       text         NOT NULL CHECK (provider IN ('google_classroom','canvas')),
  access_token   text         NOT NULL,
  refresh_token  text,
  instance_url   text,
  token_expiry   timestamptz,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

-- ─── Subscriptions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      bigserial    PRIMARY KEY,
  user_id                 bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id            bigint       REFERENCES workspaces(id) ON DELETE CASCADE,
  tier                    text         NOT NULL DEFAULT 'free'
                            CHECK (tier IN ('free','pro','educator','institution')),
  stripe_customer_id      text,
  stripe_subscription_id  text,
  status                  text         NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','canceled','past_due','trialing')),
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean      NOT NULL DEFAULT false,
  created_at              timestamptz  NOT NULL DEFAULT now(),
  updated_at              timestamptz  NOT NULL DEFAULT now()
);

-- ─── AI Usage Logs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id            bigserial    PRIMARY KEY,
  user_id       bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id  bigint       REFERENCES workspaces(id) ON DELETE CASCADE,
  feature       text         NOT NULL CHECK (feature IN ('ai_classroom','ai_tutor','ocr')),
  tokens_used   int,
  metadata      jsonb        NOT NULL DEFAULT '{}',
  created_at    timestamptz  NOT NULL DEFAULT now()
);

-- ─── Fees ────────────────────────────────────────────────────────────────────
-- Fee collection is the revenue side of the operational moat (the thing school
-- admins actually pay for). Amounts are stored in minor units (paise/cents) to
-- avoid float rounding. Scoped by school_code for tenant isolation.
CREATE TABLE IF NOT EXISTS fees (
  id            bigserial    PRIMARY KEY,
  student_id    bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_code   text,
  description   text         NOT NULL,
  amount_cents  bigint       NOT NULL CHECK (amount_cents >= 0),
  currency      text         NOT NULL DEFAULT 'INR',
  status        text         NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','waived')),
  due_date      date,
  paid_at       timestamptz,
  created_by    bigint       REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

-- ─── Feature Usage ───────────────────────────────────────────────────────────
-- Distribution instrumentation: one row per meaningful feature use, so we can
-- see which features get daily use vs zero (points analytics inward). Scoped by
-- school_code for tenant-isolated aggregation.
CREATE TABLE IF NOT EXISTS feature_usage (
  id           bigserial    PRIMARY KEY,
  feature      text         NOT NULL,
  user_id      bigint       REFERENCES users(id) ON DELETE SET NULL,
  school_code  text,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

-- Idempotency keys for attendance saves (eng review T4). The attendance row
-- upsert is already replay-safe, but its side effects (feature_usage tracking,
-- parent WhatsApp notify) are not. An offline queue replaying a save after a
-- lost ack claims its op_id here first; a second claim conflicts, and the route
-- skips the side effects so parents are not re-messaged and adoption is not
-- double-counted. Insert-only; prune old rows out of band if it ever grows.
CREATE TABLE IF NOT EXISTS processed_operations (
  op_id        text         PRIMARY KEY,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

-- ─── Attendance ──────────────────────────────────────────────────────────────
-- Daily attendance is the operational-lock-in loop (teachers mark it every
-- morning). Scoped by school_code for multi-tenant isolation; one row per
-- student per day (upsert on re-mark).
CREATE TABLE IF NOT EXISTS attendance (
  id           bigserial    PRIMARY KEY,
  student_id   bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_code  text,
  class_name   text,
  date         date         NOT NULL,
  status       text         NOT NULL CHECK (status IN ('present','absent','late','excused')),
  marked_by    bigint       REFERENCES users(id) ON DELETE SET NULL,
  note         text,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);

-- ─── Timetable Slots ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timetable_slots (
  id             bigserial    PRIMARY KEY,
  workspace_id   bigint       NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  teacher_id     bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_name     text         NOT NULL,
  subject        text         NOT NULL,
  day_of_week    int          NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  period_number  int          NOT NULL CHECK (period_number BETWEEN 1 AND 12),
  start_time     text         NOT NULL, -- "08:00"
  end_time       text         NOT NULL, -- "08:45"
  room           text,
  created_at     timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS workspace_id bigint REFERENCES workspaces(id) ON DELETE CASCADE;

-- ─── Seed roles ──────────────────────────────────────────────────────────────
INSERT INTO roles (key) VALUES
  ('student'),('teacher'),('parent'),('principal'),('school_admin'),('admin')
ON CONFLICT (key) DO NOTHING;

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email         ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_subject  ON users(auth_provider, auth_subject);
CREATE INDEX IF NOT EXISTS idx_users_school_code   ON users(school_code);
CREATE INDEX IF NOT EXISTS idx_users_role_status   ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_users_parent        ON users(parent_id);

CREATE INDEX IF NOT EXISTS idx_memberships_user    ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_school  ON memberships(school_id);

CREATE INDEX IF NOT EXISTS idx_invites_token       ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_school      ON invites(school_id, role, status);

CREATE INDEX IF NOT EXISTS idx_sessions_user       ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token      ON sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires    ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_otps_user_type      ON otps(user_id, type, used);

CREATE INDEX IF NOT EXISTS idx_audit_actor         ON audit_events(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target        ON audit_events(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_type          ON audit_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tests_teacher       ON tests(teacher_id, status);
CREATE INDEX IF NOT EXISTS idx_tests_class         ON tests(class_name, status);
CREATE INDEX IF NOT EXISTS idx_tests_date          ON tests(test_date, status);

CREATE INDEX IF NOT EXISTS idx_questions_test      ON questions(test_id, ord);

CREATE INDEX IF NOT EXISTS idx_attempts_student    ON test_attempts(student_id, status);
CREATE INDEX IF NOT EXISTS idx_attempts_test       ON test_attempts(test_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attempts_inprog ON test_attempts(test_id, student_id)
  WHERE status = 'in_progress';

CREATE INDEX IF NOT EXISTS idx_answers_attempt     ON answers(attempt_id, question_id);

CREATE INDEX IF NOT EXISTS idx_analytics_user      ON analytics(user_id, insight_date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_test      ON analytics(test_id);

CREATE INDEX IF NOT EXISTS idx_assignments_student ON test_assignments(student_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_test    ON test_assignments(test_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due     ON test_assignments(due_date, status);

CREATE INDEX IF NOT EXISTS idx_workspaces_members  ON workspaces USING GIN(members);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner    ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user ON workspace_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_memberships_workspace ON workspace_memberships(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON workspace_invites(token_hash);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON workspace_invites(workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_channels_workspace  ON channels(workspace_id, type);
CREATE INDEX IF NOT EXISTS idx_channels_type_name  ON channels(type, name);

CREATE INDEX IF NOT EXISTS idx_messages_channel    ON messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_pinned     ON messages(channel_id, is_pinned);
CREATE INDEX IF NOT EXISTS idx_messages_author     ON messages(author_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_class          ON live_classes(class_name, scheduled_time DESC);
CREATE INDEX IF NOT EXISTS idx_live_teacher        ON live_classes(teacher_id, status);

CREATE INDEX IF NOT EXISTS idx_attendance          ON live_session_attendance(session_id, student_id);

CREATE INDEX IF NOT EXISTS idx_fcm_user            ON fcm_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_user          ON tasks(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifs_user         ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_focus_user          ON focus_sessions(user_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_teacher          ON ai_classrooms(teacher_id, created_at DESC);

-- ─── Onboarding Responses ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_responses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  question_key TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_onboarding_responses_user ON onboarding_responses(user_id);

CREATE INDEX IF NOT EXISTS idx_grading_student     ON grading_results(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grading_teacher     ON grading_results(teacher_id, status);
CREATE INDEX IF NOT EXISTS idx_grading_status      ON grading_results(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lms_user            ON lms_connections(user_id);

CREATE INDEX IF NOT EXISTS idx_subs_user           ON subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subs_stripe         ON subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user       ON ai_usage_logs(user_id, feature, created_at);

CREATE INDEX IF NOT EXISTS idx_attendance_class     ON attendance(school_code, class_name, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student   ON attendance(student_id, date);

CREATE INDEX IF NOT EXISTS idx_feature_usage        ON feature_usage(school_code, feature, created_at);

CREATE INDEX IF NOT EXISTS idx_fees_school           ON fees(school_code, status);
CREATE INDEX IF NOT EXISTS idx_fees_student          ON fees(student_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_usage_workspace  ON ai_usage_logs(workspace_id);

CREATE INDEX IF NOT EXISTS idx_timetable_workspace ON timetable_slots(workspace_id);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher   ON timetable_slots(teacher_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetable_class     ON timetable_slots(class_name, day_of_week);

-- ─── Workspace v2 ──────────────────────────────────────────────────────────────
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS icon_url text;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}';

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_workspace_id bigint REFERENCES workspaces(id) ON DELETE SET NULL;

-- Expand membership roles to include edtech-specific roles
ALTER TABLE workspace_memberships DROP CONSTRAINT IF EXISTS workspace_memberships_role_check;
ALTER TABLE workspace_memberships ADD CONSTRAINT workspace_memberships_role_check
  CHECK (role IN ('owner','admin','co-teacher','teaching-assistant','member','auditor'));

-- Expand invite roles
ALTER TABLE workspace_invites DROP CONSTRAINT IF EXISTS workspace_invites_role_check;
ALTER TABLE workspace_invites ADD CONSTRAINT workspace_invites_role_check
  CHECK (role IN ('admin','co-teacher','teaching-assistant','member','auditor'));

CREATE TABLE IF NOT EXISTS workspace_templates (
  id          text         PRIMARY KEY,
  name        text         NOT NULL,
  description text,
  type        text         NOT NULL,
  config      jsonb        NOT NULL DEFAULT '{}'
);

-- ─── No-Code SIS (Airtable/Clay) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dynamic_bases (
  id            bigserial    PRIMARY KEY,
  workspace_id  bigint       NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          text         NOT NULL,
  description   text,
  icon          text,
  color         text,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dynamic_tables (
  id          bigserial    PRIMARY KEY,
  base_id     bigint       NOT NULL REFERENCES dynamic_bases(id) ON DELETE CASCADE,
  name        text         NOT NULL,
  description text,
  icon        text,
  ord         int          NOT NULL DEFAULT 0,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dynamic_fields (
  id            bigserial    PRIMARY KEY,
  table_id      bigint       NOT NULL REFERENCES dynamic_tables(id) ON DELETE CASCADE,
  name          text         NOT NULL,
  type          text         NOT NULL, -- text, number, date, select, multiselect, checkbox, relation, formula, ai_enrichment, whatsapp_action, api_fetch
  config        jsonb        NOT NULL DEFAULT '{}',
  ord           int          NOT NULL DEFAULT 0,
  is_primary    boolean      NOT NULL DEFAULT false,
  is_hidden     boolean      NOT NULL DEFAULT false,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dynamic_records (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id    bigint       NOT NULL REFERENCES dynamic_tables(id) ON DELETE CASCADE,
  data        jsonb        NOT NULL DEFAULT '{}',
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dynamic_views (
  id          bigserial    PRIMARY KEY,
  table_id    bigint       NOT NULL REFERENCES dynamic_tables(id) ON DELETE CASCADE,
  name        text         NOT NULL,
  type        text         NOT NULL DEFAULT 'grid', -- grid, kanban, calendar, gallery
  config      jsonb        NOT NULL DEFAULT '{}',
  filter      jsonb        NOT NULL DEFAULT '{}',
  sort        jsonb        NOT NULL DEFAULT '[]',
  ord         int          NOT NULL DEFAULT 0,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dynamic_bases_workspace ON dynamic_bases(workspace_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_tables_base     ON dynamic_tables(base_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_fields_table    ON dynamic_fields(table_id, ord);
CREATE INDEX IF NOT EXISTS idx_dynamic_records_table   ON dynamic_records(table_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_records_data    ON dynamic_records USING GIN(data);
CREATE INDEX IF NOT EXISTS idx_dynamic_views_table     ON dynamic_views(table_id);

-- ─── Student Lifecycle ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS competencies (
  id          bigserial    PRIMARY KEY,
  name        text         NOT NULL,
  description text,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS doubts (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  classroom_id bigint       REFERENCES ai_classrooms(id) ON DELETE SET NULL,
  test_id      bigint       REFERENCES tests(id) ON DELETE SET NULL,
  question     text         NOT NULL,
  answer       text,
  status       text         NOT NULL DEFAULT 'pending',
  created_at   timestamptz  NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  CONSTRAINT doubts_status_check CHECK (status IN ('pending', 'resolved'))
);

CREATE TABLE IF NOT EXISTS milestones (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  competency_id bigint       NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  phase         text         NOT NULL,
  reflection    text,
  score         int          NOT NULL DEFAULT 0,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT milestones_phase_check CHECK (phase IN ('decide', 'plan', 'compete', 'sorted')),
  CONSTRAINT milestones_score_check CHECK (score >= 0 AND score <= 100)
);

CREATE TABLE IF NOT EXISTS competitions (
  id               bigserial    PRIMARY KEY,
  name             text         NOT NULL,
  organizer        text,
  level            text         NOT NULL DEFAULT 'school',
  category         text,
  competition_date date,
  created_at       timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_achievements (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  competition_id  bigint       NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  award_type      text         NOT NULL,
  score           numeric,
  rank            int,
  certificate_url text,
  verified        boolean      DEFAULT false NOT NULL,
  verified_by     bigint       REFERENCES users(id),
  verification_metadata jsonb  DEFAULT '{}' NOT NULL,
  created_at      timestamptz  NOT NULL DEFAULT now()
);

-- Indexes for Student Lifecycle
CREATE INDEX IF NOT EXISTS idx_doubts_student       ON doubts(student_id);
CREATE INDEX IF NOT EXISTS idx_milestones_student   ON milestones(student_id);
CREATE INDEX IF NOT EXISTS idx_achievements_student ON student_achievements(student_id);

-- Ensure milestones are unique per student/competency/phase
CREATE UNIQUE INDEX IF NOT EXISTS idx_milestones_unique ON milestones(student_id, competency_id, phase);

-- ─── Learner Model (single-writer student model) ─────────────────────────────
-- The persistent student/learner model for the AI tutor. A single transaction
-- (see server/lib/learner-model.ts) is the only writer; every other component
-- reads a snapshot and proposes typed deltas.

CREATE TABLE IF NOT EXISTS learner_mastery (
  id          bigserial    PRIMARY KEY,
  student_id  bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept     text         NOT NULL,
  subject     text,
  p_mastery   real         NOT NULL DEFAULT 0,
  confidence  real         NOT NULL DEFAULT 0,
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (student_id, concept)
);

CREATE TABLE IF NOT EXISTS review_schedule (
  id                bigserial    PRIMARY KEY,
  student_id        bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept           text         NOT NULL,
  sm2_ef            real         NOT NULL DEFAULT 2.5,
  interval_days     int          NOT NULL DEFAULT 0,
  repetitions       int          NOT NULL DEFAULT 0,
  due_at            timestamptz  NOT NULL DEFAULT now(),
  last_reviewed_at  timestamptz,
  UNIQUE (student_id, concept)
);

CREATE TABLE IF NOT EXISTS interaction_log (
  id          bigserial    PRIMARY KEY,
  student_id  bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text         NOT NULL,
  concept     text,
  payload     jsonb        NOT NULL DEFAULT '{}',
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memory_notes (
  id          bigserial    PRIMARY KEY,
  student_id  bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note        text         NOT NULL,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_chunks (
  id          bigserial      PRIMARY KEY,
  source      text,
  subject     text,
  topic       text,
  chunk       text           NOT NULL,
  embedding   vector(1536),
  created_at  timestamptz    NOT NULL DEFAULT now()
);

-- Indexes for the learner model
CREATE INDEX IF NOT EXISTS idx_learner_mastery_student ON learner_mastery(student_id);
CREATE INDEX IF NOT EXISTS idx_review_schedule_due      ON review_schedule(student_id, due_at);
CREATE INDEX IF NOT EXISTS idx_interaction_log_student  ON interaction_log(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_memory_notes_student     ON memory_notes(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS content_chunks_embedding_idx ON content_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ─── Study Arena Phase A: teacher-assigned mastery evidence ──────────────────
-- These tables are deliberately separate from the legacy beta's loose
-- interaction_log payloads. Assignment, session, and evidence identifiers are
-- server-owned so a browser cannot forge a completed lesson or cross a tenant
-- boundary by supplying another lesson id.

CREATE TABLE IF NOT EXISTS study_arena_lesson_versions (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    bigint       NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by      bigint       NOT NULL REFERENCES users(id),
  status          text         NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','published','withdrawn','archived')),
  subject         text         NOT NULL,
  grade_level     text,
  objective       text         NOT NULL,
  language        text         NOT NULL DEFAULT 'en',
  script          jsonb        NOT NULL,
  source_policy   text         NOT NULL DEFAULT 'teacher_supplied',
  evaluator_version text       NOT NULL,
  template_id     text,
  -- Server-only evaluator targets; never included in the assigned scene API.
  template_config jsonb        NOT NULL DEFAULT '{}',
  primary_concept_id text,
  published_at    timestamptz,
  withdrawn_at    timestamptz,
  created_at      timestamptz  NOT NULL DEFAULT now()
);
ALTER TABLE study_arena_lesson_versions ADD COLUMN IF NOT EXISTS primary_concept_id text;
ALTER TABLE study_arena_lesson_versions ADD COLUMN IF NOT EXISTS template_id text;
ALTER TABLE study_arena_lesson_versions ADD COLUMN IF NOT EXISTS template_config jsonb NOT NULL DEFAULT '{}';
-- Teacher creation approvals: { objective?: {at, by}, source?: {at, by}, assessment?: {at, by} }
ALTER TABLE study_arena_lesson_versions ADD COLUMN IF NOT EXISTS approvals jsonb NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS study_arena_source_spans (
  id                uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_version_id uuid       NOT NULL REFERENCES study_arena_lesson_versions(id) ON DELETE CASCADE,
  objective         text       NOT NULL,
  source_label      text       NOT NULL,
  source_locator    text,
  excerpt           text       NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS study_arena_assignments (
  id                uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      bigint     NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lesson_version_id uuid       NOT NULL REFERENCES study_arena_lesson_versions(id),
  created_by        bigint     NOT NULL REFERENCES users(id),
  school_class_id   bigint     REFERENCES school_classes(id) ON DELETE SET NULL,
  status            text       NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','revoked','expired')),
  available_at      timestamptz NOT NULL DEFAULT now(),
  due_at            timestamptz,
  revoked_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS study_arena_assignment_enrollments (
  assignment_id  uuid       NOT NULL REFERENCES study_arena_assignments(id) ON DELETE CASCADE,
  student_id     bigint     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrolled_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS study_arena_attempt_sessions (
  id                uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id     uuid       NOT NULL REFERENCES study_arena_assignments(id) ON DELETE CASCADE,
  student_id        bigint     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_version_id uuid       NOT NULL REFERENCES study_arena_lesson_versions(id),
  status            text       NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','completed','abandoned','revoked')),
  -- Scene routing state is server-owned. Keep next_action_index for the
  -- existing linear gate cursor and replay protection.
  current_scene_id  text,
  completed_scene_ids jsonb    NOT NULL DEFAULT '[]',
  branch_path       jsonb      NOT NULL DEFAULT '[]',
  director_decision jsonb      NOT NULL DEFAULT '{}',
  director_decision_version integer NOT NULL DEFAULT 0 CHECK (director_decision_version >= 0),
  next_action_index integer    NOT NULL DEFAULT 0 CHECK (next_action_index >= 0),
  created_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  adaptive_recommendation jsonb NOT NULL DEFAULT '{}',
  is_preview        boolean    NOT NULL DEFAULT false,
  UNIQUE (assignment_id, student_id)
);
ALTER TABLE study_arena_attempt_sessions ADD COLUMN IF NOT EXISTS adaptive_recommendation jsonb NOT NULL DEFAULT '{}';
ALTER TABLE study_arena_attempt_sessions ADD COLUMN IF NOT EXISTS current_scene_id text;
ALTER TABLE study_arena_attempt_sessions ADD COLUMN IF NOT EXISTS completed_scene_ids jsonb NOT NULL DEFAULT '[]';
ALTER TABLE study_arena_attempt_sessions ADD COLUMN IF NOT EXISTS branch_path jsonb NOT NULL DEFAULT '[]';
ALTER TABLE study_arena_attempt_sessions ADD COLUMN IF NOT EXISTS director_decision jsonb NOT NULL DEFAULT '{}';
ALTER TABLE study_arena_attempt_sessions ADD COLUMN IF NOT EXISTS director_decision_version integer NOT NULL DEFAULT 0;
ALTER TABLE study_arena_attempt_sessions ADD COLUMN IF NOT EXISTS is_preview boolean NOT NULL DEFAULT false;
-- Preview sessions must not collide with the one learner session per assignment.
ALTER TABLE study_arena_attempt_sessions
  DROP CONSTRAINT IF EXISTS study_arena_attempt_sessions_assignment_id_student_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_study_arena_sessions_learner_unique
  ON study_arena_attempt_sessions(assignment_id, student_id)
  WHERE is_preview = false;

CREATE TABLE IF NOT EXISTS study_arena_intervention_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES study_arena_assignments(id) ON DELETE CASCADE,
  student_id bigint REFERENCES users(id) ON DELETE SET NULL,
  teacher_id bigint NOT NULL REFERENCES users(id),
  cohort_key text NOT NULL,
  action_note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS study_arena_evidence_events (
  id                 uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       bigint     NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  assignment_id      uuid       NOT NULL REFERENCES study_arena_assignments(id) ON DELETE CASCADE,
  attempt_session_id uuid       NOT NULL REFERENCES study_arena_attempt_sessions(id) ON DELETE CASCADE,
  student_id         bigint     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_version_id  uuid       NOT NULL REFERENCES study_arena_lesson_versions(id),
  objective          text       NOT NULL,
  event_kind         text       NOT NULL CHECK (event_kind IN ('attempt','hint','assessment','intervention')),
  action_index       integer    NOT NULL CHECK (action_index >= 0),
  idempotency_key    text       NOT NULL,
  evidence           jsonb      NOT NULL DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_session_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS study_arena_assessment_instances (
  id                 uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_session_id uuid       NOT NULL REFERENCES study_arena_attempt_sessions(id) ON DELETE CASCADE,
  assessment_id      text       NOT NULL,
  evaluator_version  text       NOT NULL,
  action_index       integer    NOT NULL DEFAULT 0 CHECK (action_index >= 0),
  nonce_hash         text,
  issued_at          timestamptz NOT NULL DEFAULT now(),
  due_at             timestamptz,
  submitted_at       timestamptz,
  status             text       NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available','submitted','invalidated','expired')),
  UNIQUE (attempt_session_id, assessment_id)
);

ALTER TABLE study_arena_assessment_instances
  ADD COLUMN IF NOT EXISTS action_index integer NOT NULL DEFAULT 0;
ALTER TABLE study_arena_assessment_instances
  ADD COLUMN IF NOT EXISTS nonce_hash text;
ALTER TABLE study_arena_assessment_instances
  ADD COLUMN IF NOT EXISTS issued_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS study_arena_assessment_evaluations (
  id                    uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_instance_id uuid      NOT NULL REFERENCES study_arena_assessment_instances(id) ON DELETE CASCADE,
  evaluator_version     text       NOT NULL,
  correct               boolean    NOT NULL,
  confidence            real       NOT NULL DEFAULT 1 CHECK (confidence >= 0 AND confidence <= 1),
  misconception_code    text,
  evaluated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_instance_id)
);

CREATE INDEX IF NOT EXISTS idx_study_arena_versions_workspace
  ON study_arena_lesson_versions(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_arena_assignments_workspace
  ON study_arena_assignments(workspace_id, status, available_at);
CREATE INDEX IF NOT EXISTS idx_study_arena_enrollments_student
  ON study_arena_assignment_enrollments(student_id, assignment_id);
CREATE INDEX IF NOT EXISTS idx_study_arena_sessions_student
  ON study_arena_attempt_sessions(student_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_arena_evidence_report
  ON study_arena_evidence_events(workspace_id, assignment_id, objective, created_at);
CREATE INDEX IF NOT EXISTS idx_study_arena_assessment_available
  ON study_arena_assessment_instances(attempt_session_id, status, due_at);

-- Durable async lesson-compiler jobs (fingerprint dedupe, cancel, retry).
CREATE TABLE IF NOT EXISTS study_arena_compiler_jobs (
  id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       bigint       NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  teacher_id         bigint       NOT NULL REFERENCES users(id),
  request_fingerprint text        NOT NULL,
  status             text         NOT NULL DEFAULT 'queued'
                     CHECK (status IN ('queued','running','completed','failed','cancelled')),
  progress           jsonb        NOT NULL DEFAULT '{}',
  source_text        text         NOT NULL,
  objective          text         NOT NULL,
  subject            text         NOT NULL,
  grade_level        text,
  lesson_version_id  uuid         REFERENCES study_arena_lesson_versions(id) ON DELETE SET NULL,
  error_message      text,
  bullmq_job_id      text,
  created_at         timestamptz  NOT NULL DEFAULT now(),
  updated_at         timestamptz  NOT NULL DEFAULT now(),
  cancelled_at       timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_study_arena_compiler_jobs_active_fingerprint
  ON study_arena_compiler_jobs(workspace_id, request_fingerprint)
  WHERE status IN ('queued', 'running');
CREATE INDEX IF NOT EXISTS idx_study_arena_compiler_jobs_workspace
  ON study_arena_compiler_jobs(workspace_id, created_at DESC);

-- ─── Landing-page leads (public contact form) ─────────────────────────────────
-- Pilot/contact requests submitted from the marketing site. No tenant scope:
-- these arrive before a school exists in the system.

CREATE TABLE IF NOT EXISTS leads (
  id          bigserial    PRIMARY KEY,
  name        text         NOT NULL,
  school      text,
  email       text,
  phone       text,
  role        text,
  message     text,
  source      text         NOT NULL DEFAULT 'landing_contact',
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
