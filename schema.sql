--
-- PostgreSQL database dump
--

\restrict WwWX2hVFxTM5WjVZROcKyASKJfCDH4POa25r0Yj095EHAv72aiKl0WZOiNhKa5d

-- Dumped from database version 15.17
-- Dumped by pg_dump version 18.4 (Debian 18.4-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_classrooms; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.ai_classrooms (
    id bigint NOT NULL,
    teacher_id bigint NOT NULL,
    topic text NOT NULL,
    study_arena_job_id text NOT NULL,
    data jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_classrooms_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'generating'::text, 'ready'::text, 'error'::text])))
);


ALTER TABLE public.ai_classrooms OWNER TO plpuser;

--
-- Name: ai_classrooms_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.ai_classrooms_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_classrooms_id_seq OWNER TO plpuser;

--
-- Name: ai_classrooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.ai_classrooms_id_seq OWNED BY public.ai_classrooms.id;


--
-- Name: analytics; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.analytics (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    test_id bigint NOT NULL,
    weak_topics text[] DEFAULT '{}'::text[] NOT NULL,
    strong_topics text[] DEFAULT '{}'::text[] NOT NULL,
    recommended_resources text[] DEFAULT '{}'::text[] NOT NULL,
    insight_date timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.analytics OWNER TO plpuser;

--
-- Name: analytics_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.analytics_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.analytics_id_seq OWNER TO plpuser;

--
-- Name: analytics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.analytics_id_seq OWNED BY public.analytics.id;


--
-- Name: answers; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.answers (
    id bigint NOT NULL,
    attempt_id bigint NOT NULL,
    question_id bigint NOT NULL,
    text text,
    selected_option integer,
    image_url text,
    ocr_text text,
    score numeric,
    ai_confidence numeric,
    ai_feedback text,
    is_correct boolean
);


ALTER TABLE public.answers OWNER TO plpuser;

--
-- Name: answers_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.answers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.answers_id_seq OWNER TO plpuser;

--
-- Name: answers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.answers_id_seq OWNED BY public.answers.id;


--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.audit_events (
    id bigint NOT NULL,
    actor_user_id bigint,
    target_user_id bigint,
    school_code text,
    event_type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_events OWNER TO plpuser;

--
-- Name: audit_events_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.audit_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_events_id_seq OWNER TO plpuser;

--
-- Name: audit_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.audit_events_id_seq OWNED BY public.audit_events.id;


--
-- Name: channels; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.channels (
    id bigint NOT NULL,
    workspace_id bigint,
    name text NOT NULL,
    type text DEFAULT 'text'::text NOT NULL,
    class_name text,
    subject text,
    pinned_messages bigint[] DEFAULT '{}'::bigint[] NOT NULL,
    category text DEFAULT 'class'::text,
    is_read_only boolean DEFAULT false NOT NULL,
    participants text[] DEFAULT '{}'::text[] NOT NULL,
    unread_counts jsonb DEFAULT '{}'::jsonb NOT NULL,
    typing_users text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT channels_type_check CHECK ((type = ANY (ARRAY['text'::text, 'announcement'::text, 'dm'::text])))
);


ALTER TABLE public.channels OWNER TO plpuser;

--
-- Name: channels_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.channels_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.channels_id_seq OWNER TO plpuser;

--
-- Name: channels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.channels_id_seq OWNED BY public.channels.id;


--
-- Name: fcm_tokens; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.fcm_tokens (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    token text NOT NULL,
    device_type text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.fcm_tokens OWNER TO plpuser;

--
-- Name: fcm_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.fcm_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.fcm_tokens_id_seq OWNER TO plpuser;

--
-- Name: fcm_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.fcm_tokens_id_seq OWNED BY public.fcm_tokens.id;


--
-- Name: focus_sessions; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.focus_sessions (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    subject text NOT NULL,
    mode text NOT NULL,
    duration_seconds integer NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT focus_sessions_mode_check CHECK ((mode = ANY (ARRAY['work'::text, 'short'::text, 'long'::text])))
);


ALTER TABLE public.focus_sessions OWNER TO plpuser;

--
-- Name: focus_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.focus_sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.focus_sessions_id_seq OWNER TO plpuser;

--
-- Name: focus_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.focus_sessions_id_seq OWNED BY public.focus_sessions.id;


--
-- Name: grading_results; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.grading_results (
    id bigint NOT NULL,
    submission_id text NOT NULL,
    student_id bigint NOT NULL,
    teacher_id bigint NOT NULL,
    rubric jsonb NOT NULL,
    score_breakdown jsonb,
    overall_feedback text,
    strengths text[] DEFAULT '{}'::text[] NOT NULL,
    areas_for_improvement text[] DEFAULT '{}'::text[] NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    model_used text,
    processing_time_ms integer,
    attachments text[] DEFAULT '{}'::text[] NOT NULL,
    content_type text DEFAULT 'text'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT grading_results_content_type_check CHECK ((content_type = ANY (ARRAY['text'::text, 'code_python'::text, 'code_javascript'::text, 'code_typescript'::text, 'pdf'::text]))),
    CONSTRAINT grading_results_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text])))
);


ALTER TABLE public.grading_results OWNER TO plpuser;

--
-- Name: grading_results_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.grading_results_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.grading_results_id_seq OWNER TO plpuser;

--
-- Name: grading_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.grading_results_id_seq OWNED BY public.grading_results.id;


--
-- Name: invites; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.invites (
    id bigint NOT NULL,
    email public.citext NOT NULL,
    name text,
    role text NOT NULL,
    school_id bigint,
    class_id text,
    grades text[] DEFAULT '{}'::text[] NOT NULL,
    token text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    invited_by text,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text])))
);


ALTER TABLE public.invites OWNER TO plpuser;

--
-- Name: invites_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.invites_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invites_id_seq OWNER TO plpuser;

--
-- Name: invites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.invites_id_seq OWNED BY public.invites.id;


--
-- Name: live_classes; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.live_classes (
    id bigint NOT NULL,
    title text NOT NULL,
    description text,
    teacher_id bigint NOT NULL,
    class_name text NOT NULL,
    scheduled_time timestamp with time zone NOT NULL,
    duration_minutes integer DEFAULT 60 NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    daily_room_name text,
    daily_room_url text,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    recording_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT live_classes_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'live'::text, 'completed'::text, 'cancelled'::text])))
);


ALTER TABLE public.live_classes OWNER TO plpuser;

--
-- Name: live_classes_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.live_classes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.live_classes_id_seq OWNER TO plpuser;

--
-- Name: live_classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.live_classes_id_seq OWNED BY public.live_classes.id;


--
-- Name: live_session_attendance; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.live_session_attendance (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    student_id bigint NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    left_at timestamp with time zone,
    duration_minutes integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.live_session_attendance OWNER TO plpuser;

--
-- Name: live_session_attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.live_session_attendance_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.live_session_attendance_id_seq OWNER TO plpuser;

--
-- Name: live_session_attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.live_session_attendance_id_seq OWNED BY public.live_session_attendance.id;


--
-- Name: lms_connections; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.lms_connections (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    provider text NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    instance_url text,
    token_expiry timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lms_connections_provider_check CHECK ((provider = ANY (ARRAY['google_classroom'::text, 'canvas'::text])))
);


ALTER TABLE public.lms_connections OWNER TO plpuser;

--
-- Name: lms_connections_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.lms_connections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lms_connections_id_seq OWNER TO plpuser;

--
-- Name: lms_connections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.lms_connections_id_seq OWNED BY public.lms_connections.id;


--
-- Name: membership_roles; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.membership_roles (
    membership_id bigint NOT NULL,
    role_id bigint NOT NULL,
    assigned_by bigint,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.membership_roles OWNER TO plpuser;

--
-- Name: memberships; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.memberships (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    school_id bigint,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT memberships_status_check CHECK ((status = ANY (ARRAY['active'::text, 'pending'::text, 'suspended'::text, 'rejected'::text])))
);


ALTER TABLE public.memberships OWNER TO plpuser;

--
-- Name: memberships_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.memberships_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.memberships_id_seq OWNER TO plpuser;

--
-- Name: memberships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.memberships_id_seq OWNED BY public.memberships.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.messages (
    id bigint NOT NULL,
    channel_id bigint NOT NULL,
    author_id bigint NOT NULL,
    content text NOT NULL,
    type text DEFAULT 'text'::text NOT NULL,
    file_url text,
    is_pinned boolean DEFAULT false NOT NULL,
    is_homework boolean DEFAULT false NOT NULL,
    grading_status text,
    read_by bigint[] DEFAULT '{}'::bigint[] NOT NULL,
    sender_role text DEFAULT 'student'::text,
    message_type text DEFAULT 'text'::text,
    reply_to bigint,
    mentions text[] DEFAULT '{}'::text[] NOT NULL,
    is_doubt_answered boolean DEFAULT false NOT NULL,
    assignment_data jsonb,
    delivered_to text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT messages_grading_status_check CHECK ((grading_status = ANY (ARRAY['pending'::text, 'graded'::text]))),
    CONSTRAINT messages_type_check CHECK ((type = ANY (ARRAY['text'::text, 'file'::text, 'image'::text])))
);


ALTER TABLE public.messages OWNER TO plpuser;

--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.messages_id_seq OWNER TO plpuser;

--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.notifications (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    meta text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['test'::text, 'result'::text, 'announcement'::text, 'message'::text, 'achievement'::text, 'reminder'::text])))
);


ALTER TABLE public.notifications OWNER TO plpuser;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO plpuser;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: otps; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.otps (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    otp_hash text NOT NULL,
    type text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    attempts integer DEFAULT 0,
    CONSTRAINT otps_type_check CHECK ((type = ANY (ARRAY['registration'::text, 'password_reset'::text, '2fa'::text])))
);


ALTER TABLE public.otps OWNER TO plpuser;

--
-- Name: otps_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.otps_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.otps_id_seq OWNER TO plpuser;

--
-- Name: otps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.otps_id_seq OWNED BY public.otps.id;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.permissions (
    id bigint NOT NULL,
    key text NOT NULL
);


ALTER TABLE public.permissions OWNER TO plpuser;

--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permissions_id_seq OWNER TO plpuser;

--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: questions; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.questions (
    id bigint NOT NULL,
    test_id bigint NOT NULL,
    type text NOT NULL,
    text text NOT NULL,
    options jsonb,
    correct_answer text,
    marks integer DEFAULT 1 NOT NULL,
    ord integer NOT NULL,
    ai_rubric text,
    CONSTRAINT questions_type_check CHECK ((type = ANY (ARRAY['mcq'::text, 'short'::text, 'long'::text, 'numerical'::text])))
);


ALTER TABLE public.questions OWNER TO plpuser;

--
-- Name: questions_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.questions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.questions_id_seq OWNER TO plpuser;

--
-- Name: questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.questions_id_seq OWNED BY public.questions.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.role_permissions (
    role_id bigint NOT NULL,
    permission_id bigint NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO plpuser;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.roles (
    id bigint NOT NULL,
    key text NOT NULL
);


ALTER TABLE public.roles OWNER TO plpuser;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO plpuser;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: school_classes; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.school_classes (
    id bigint NOT NULL,
    name text NOT NULL,
    grade text,
    teacher_firebase_uid text,
    school_id bigint,
    students text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.school_classes OWNER TO plpuser;

--
-- Name: school_classes_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.school_classes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.school_classes_id_seq OWNER TO plpuser;

--
-- Name: school_classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.school_classes_id_seq OWNED BY public.school_classes.id;


--
-- Name: schools; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.schools (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    city text,
    district text,
    board text,
    logo text,
    grades_offered text[] DEFAULT '{}'::text[] NOT NULL,
    created_by_uid text,
    onboarding_complete boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.schools OWNER TO plpuser;

--
-- Name: schools_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.schools_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.schools_id_seq OWNER TO plpuser;

--
-- Name: schools_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.schools_id_seq OWNED BY public.schools.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.sessions (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    refresh_token_hash text NOT NULL,
    device_info text,
    ip_address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO plpuser;

--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sessions_id_seq OWNER TO plpuser;

--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.subscriptions (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    tier text DEFAULT 'free'::text NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    status text DEFAULT 'active'::text NOT NULL,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'canceled'::text, 'past_due'::text, 'trialing'::text]))),
    CONSTRAINT subscriptions_tier_check CHECK ((tier = ANY (ARRAY['free'::text, 'pro'::text, 'educator'::text, 'institution'::text])))
);


ALTER TABLE public.subscriptions OWNER TO plpuser;

--
-- Name: subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.subscriptions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subscriptions_id_seq OWNER TO plpuser;

--
-- Name: subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.subscriptions_id_seq OWNED BY public.subscriptions.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.tasks (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    title text NOT NULL,
    status text DEFAULT 'todo'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    due_date text,
    comments integer DEFAULT 0 NOT NULL,
    attachments integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['backlog'::text, 'todo'::text, 'in-progress'::text, 'review'::text, 'done'::text])))
);


ALTER TABLE public.tasks OWNER TO plpuser;

--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.tasks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tasks_id_seq OWNER TO plpuser;

--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: test_assignments; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.test_assignments (
    id bigint NOT NULL,
    test_id bigint NOT NULL,
    student_id bigint NOT NULL,
    assigned_by bigint NOT NULL,
    assigned_date timestamp with time zone DEFAULT now() NOT NULL,
    due_date timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    notification_sent boolean DEFAULT false NOT NULL,
    CONSTRAINT test_assignments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'started'::text, 'completed'::text, 'overdue'::text])))
);


ALTER TABLE public.test_assignments OWNER TO plpuser;

--
-- Name: test_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.test_assignments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.test_assignments_id_seq OWNER TO plpuser;

--
-- Name: test_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.test_assignments_id_seq OWNED BY public.test_assignments.id;


--
-- Name: test_attempts; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.test_attempts (
    id bigint NOT NULL,
    test_id bigint NOT NULL,
    student_id bigint NOT NULL,
    start_time timestamp with time zone DEFAULT now() NOT NULL,
    end_time timestamp with time zone,
    score numeric,
    status text DEFAULT 'in_progress'::text NOT NULL,
    CONSTRAINT test_attempts_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'evaluated'::text])))
);


ALTER TABLE public.test_attempts OWNER TO plpuser;

--
-- Name: test_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.test_attempts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.test_attempts_id_seq OWNER TO plpuser;

--
-- Name: test_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.test_attempts_id_seq OWNED BY public.test_attempts.id;


--
-- Name: tests; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.tests (
    id bigint NOT NULL,
    title text NOT NULL,
    description text,
    subject text NOT NULL,
    class_name text NOT NULL,
    teacher_id bigint NOT NULL,
    total_marks integer DEFAULT 100 NOT NULL,
    duration integer DEFAULT 60 NOT NULL,
    test_date timestamp with time zone NOT NULL,
    question_types text[] DEFAULT '{}'::text[] NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tests_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'completed'::text])))
);


ALTER TABLE public.tests OWNER TO plpuser;

--
-- Name: tests_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.tests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tests_id_seq OWNER TO plpuser;

--
-- Name: tests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.tests_id_seq OWNED BY public.tests.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    auth_provider text DEFAULT 'firebase'::text NOT NULL,
    auth_subject text NOT NULL,
    email public.citext NOT NULL,
    username text,
    password_hash text,
    name text,
    display_name text,
    avatar text,
    role text DEFAULT 'student'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    school_code text,
    school_id bigint,
    parent_id bigint,
    grade text,
    board text,
    subjects text[] DEFAULT '{}'::text[] NOT NULL,
    district text,
    class_name text,
    subject text,
    onboarding_complete boolean DEFAULT false NOT NULL,
    study_plan jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_login_at timestamp with time zone,
    email_verified boolean DEFAULT false,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['student'::text, 'teacher'::text, 'parent'::text, 'principal'::text, 'school_admin'::text, 'admin'::text]))),
    CONSTRAINT users_status_check CHECK ((status = ANY (ARRAY['active'::text, 'pending'::text, 'suspended'::text, 'rejected'::text])))
);


ALTER TABLE public.users OWNER TO plpuser;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO plpuser;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: workspace_memberships; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.workspace_memberships (
    id bigint NOT NULL,
    workspace_id bigint NOT NULL,
    user_id bigint NOT NULL,
    role text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.workspace_memberships OWNER TO plpuser;

--
-- Name: workspace_memberships_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.workspace_memberships_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workspace_memberships_id_seq OWNER TO plpuser;

--
-- Name: workspace_memberships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.workspace_memberships_id_seq OWNED BY public.workspace_memberships.id;


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.workspaces (
    id bigint NOT NULL,
    name text NOT NULL,
    description text,
    owner_id bigint NOT NULL,
    members bigint[] DEFAULT '{}'::bigint[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    slug text,
    type text DEFAULT 'business'::text
);


ALTER TABLE public.workspaces OWNER TO plpuser;

--
-- Name: workspaces_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.workspaces_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workspaces_id_seq OWNER TO plpuser;

--
-- Name: workspaces_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.workspaces_id_seq OWNED BY public.workspaces.id;


--
-- Name: ai_classrooms id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.ai_classrooms ALTER COLUMN id SET DEFAULT nextval('public.ai_classrooms_id_seq'::regclass);


--
-- Name: analytics id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.analytics ALTER COLUMN id SET DEFAULT nextval('public.analytics_id_seq'::regclass);


--
-- Name: answers id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.answers ALTER COLUMN id SET DEFAULT nextval('public.answers_id_seq'::regclass);


--
-- Name: audit_events id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.audit_events ALTER COLUMN id SET DEFAULT nextval('public.audit_events_id_seq'::regclass);


--
-- Name: channels id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.channels ALTER COLUMN id SET DEFAULT nextval('public.channels_id_seq'::regclass);


--
-- Name: fcm_tokens id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.fcm_tokens ALTER COLUMN id SET DEFAULT nextval('public.fcm_tokens_id_seq'::regclass);


--
-- Name: focus_sessions id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.focus_sessions ALTER COLUMN id SET DEFAULT nextval('public.focus_sessions_id_seq'::regclass);


--
-- Name: grading_results id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.grading_results ALTER COLUMN id SET DEFAULT nextval('public.grading_results_id_seq'::regclass);


--
-- Name: invites id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.invites ALTER COLUMN id SET DEFAULT nextval('public.invites_id_seq'::regclass);


--
-- Name: live_classes id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.live_classes ALTER COLUMN id SET DEFAULT nextval('public.live_classes_id_seq'::regclass);


--
-- Name: live_session_attendance id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.live_session_attendance ALTER COLUMN id SET DEFAULT nextval('public.live_session_attendance_id_seq'::regclass);


--
-- Name: lms_connections id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.lms_connections ALTER COLUMN id SET DEFAULT nextval('public.lms_connections_id_seq'::regclass);


--
-- Name: memberships id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.memberships ALTER COLUMN id SET DEFAULT nextval('public.memberships_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: otps id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.otps ALTER COLUMN id SET DEFAULT nextval('public.otps_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: questions id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.questions ALTER COLUMN id SET DEFAULT nextval('public.questions_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: school_classes id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.school_classes ALTER COLUMN id SET DEFAULT nextval('public.school_classes_id_seq'::regclass);


--
-- Name: schools id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.schools ALTER COLUMN id SET DEFAULT nextval('public.schools_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: subscriptions id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.subscriptions ALTER COLUMN id SET DEFAULT nextval('public.subscriptions_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: test_assignments id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.test_assignments ALTER COLUMN id SET DEFAULT nextval('public.test_assignments_id_seq'::regclass);


--
-- Name: test_attempts id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.test_attempts ALTER COLUMN id SET DEFAULT nextval('public.test_attempts_id_seq'::regclass);


--
-- Name: tests id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.tests ALTER COLUMN id SET DEFAULT nextval('public.tests_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: workspace_memberships id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.workspace_memberships ALTER COLUMN id SET DEFAULT nextval('public.workspace_memberships_id_seq'::regclass);


--
-- Name: workspaces id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.workspaces ALTER COLUMN id SET DEFAULT nextval('public.workspaces_id_seq'::regclass);


--
-- Name: ai_classrooms ai_classrooms_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.ai_classrooms
    ADD CONSTRAINT ai_classrooms_pkey PRIMARY KEY (id);


--
-- Name: analytics analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.analytics
    ADD CONSTRAINT analytics_pkey PRIMARY KEY (id);


--
-- Name: answers answers_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_pkey PRIMARY KEY (id);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);


--
-- Name: fcm_tokens fcm_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.fcm_tokens
    ADD CONSTRAINT fcm_tokens_pkey PRIMARY KEY (id);


--
-- Name: fcm_tokens fcm_tokens_user_id_token_key; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.fcm_tokens
    ADD CONSTRAINT fcm_tokens_user_id_token_key UNIQUE (user_id, token);


--
-- Name: focus_sessions focus_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.focus_sessions
    ADD CONSTRAINT focus_sessions_pkey PRIMARY KEY (id);


--
-- Name: grading_results grading_results_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.grading_results
    ADD CONSTRAINT grading_results_pkey PRIMARY KEY (id);


--
-- Name: invites invites_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_pkey PRIMARY KEY (id);


--
-- Name: invites invites_token_key; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_token_key UNIQUE (token);


--
-- Name: live_classes live_classes_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.live_classes
    ADD CONSTRAINT live_classes_pkey PRIMARY KEY (id);


--
-- Name: live_session_attendance live_session_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.live_session_attendance
    ADD CONSTRAINT live_session_attendance_pkey PRIMARY KEY (id);


--
-- Name: lms_connections lms_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.lms_connections
    ADD CONSTRAINT lms_connections_pkey PRIMARY KEY (id);


--
-- Name: lms_connections lms_connections_user_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.lms_connections
    ADD CONSTRAINT lms_connections_user_id_provider_key UNIQUE (user_id, provider);


--
-- Name: membership_roles membership_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.membership_roles
    ADD CONSTRAINT membership_roles_pkey PRIMARY KEY (membership_id, role_id);


--
-- Name: memberships memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_pkey PRIMARY KEY (id);


--
-- Name: memberships memberships_user_id_school_id_key; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_user_id_school_id_key UNIQUE (user_id, school_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: otps otps_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.otps
    ADD CONSTRAINT otps_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_key_key; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_key_key UNIQUE (key);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_key_key; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_key_key UNIQUE (key);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: school_classes school_classes_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.school_classes
    ADD CONSTRAINT school_classes_pkey PRIMARY KEY (id);


--
-- Name: schools schools_code_key; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.schools
    ADD CONSTRAINT schools_code_key UNIQUE (code);


--
-- Name: schools schools_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.schools
    ADD CONSTRAINT schools_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: test_assignments test_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.test_assignments
    ADD CONSTRAINT test_assignments_pkey PRIMARY KEY (id);


--
-- Name: test_attempts test_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.test_attempts
    ADD CONSTRAINT test_attempts_pkey PRIMARY KEY (id);


--
-- Name: tests tests_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_pkey PRIMARY KEY (id);


--
-- Name: workspace_memberships unique_workspace_user; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.workspace_memberships
    ADD CONSTRAINT unique_workspace_user UNIQUE (workspace_id, user_id);


--
-- Name: users users_auth_provider_auth_subject_key; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_auth_provider_auth_subject_key UNIQUE (auth_provider, auth_subject);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: workspace_memberships workspace_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.workspace_memberships
    ADD CONSTRAINT workspace_memberships_pkey PRIMARY KEY (id);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: idx_ai_teacher; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_ai_teacher ON public.ai_classrooms USING btree (teacher_id, created_at DESC);


--
-- Name: idx_analytics_test; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_analytics_test ON public.analytics USING btree (test_id);


--
-- Name: idx_analytics_user; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_analytics_user ON public.analytics USING btree (user_id, insight_date DESC);


--
-- Name: idx_answers_attempt; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_answers_attempt ON public.answers USING btree (attempt_id, question_id);


--
-- Name: idx_assignments_due; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_assignments_due ON public.test_assignments USING btree (due_date, status);


--
-- Name: idx_assignments_student; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_assignments_student ON public.test_assignments USING btree (student_id, status);


--
-- Name: idx_assignments_test; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_assignments_test ON public.test_assignments USING btree (test_id);


--
-- Name: idx_attempts_inprog; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE UNIQUE INDEX idx_attempts_inprog ON public.test_attempts USING btree (test_id, student_id) WHERE (status = 'in_progress'::text);


--
-- Name: idx_attempts_student; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_attempts_student ON public.test_attempts USING btree (student_id, status);


--
-- Name: idx_attempts_test; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_attempts_test ON public.test_attempts USING btree (test_id, status);


--
-- Name: idx_attendance; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_attendance ON public.live_session_attendance USING btree (session_id, student_id);


--
-- Name: idx_audit_actor; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_audit_actor ON public.audit_events USING btree (actor_user_id, created_at DESC);


--
-- Name: idx_audit_target; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_audit_target ON public.audit_events USING btree (target_user_id, created_at DESC);


--
-- Name: idx_audit_type; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_audit_type ON public.audit_events USING btree (event_type, created_at DESC);


--
-- Name: idx_channels_type_name; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_channels_type_name ON public.channels USING btree (type, name);


--
-- Name: idx_channels_workspace; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_channels_workspace ON public.channels USING btree (workspace_id, type);


--
-- Name: idx_fcm_user; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_fcm_user ON public.fcm_tokens USING btree (user_id);


--
-- Name: idx_focus_user; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_focus_user ON public.focus_sessions USING btree (user_id, completed_at DESC);


--
-- Name: idx_grading_status; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_grading_status ON public.grading_results USING btree (status, created_at DESC);


--
-- Name: idx_grading_student; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_grading_student ON public.grading_results USING btree (student_id, created_at DESC);


--
-- Name: idx_grading_teacher; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_grading_teacher ON public.grading_results USING btree (teacher_id, status);


--
-- Name: idx_invites_school; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_invites_school ON public.invites USING btree (school_id, role, status);


--
-- Name: idx_invites_token; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_invites_token ON public.invites USING btree (token);


--
-- Name: idx_live_class; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_live_class ON public.live_classes USING btree (class_name, scheduled_time DESC);


--
-- Name: idx_live_teacher; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_live_teacher ON public.live_classes USING btree (teacher_id, status);


--
-- Name: idx_lms_user; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_lms_user ON public.lms_connections USING btree (user_id);


--
-- Name: idx_memberships_school; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_memberships_school ON public.memberships USING btree (school_id);


--
-- Name: idx_memberships_user; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_memberships_user ON public.memberships USING btree (user_id);


--
-- Name: idx_messages_author; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_messages_author ON public.messages USING btree (author_id, created_at DESC);


--
-- Name: idx_messages_channel; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_messages_channel ON public.messages USING btree (channel_id, created_at DESC);


--
-- Name: idx_messages_pinned; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_messages_pinned ON public.messages USING btree (channel_id, is_pinned);


--
-- Name: idx_notifs_user; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_notifs_user ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_otps_user_type; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_otps_user_type ON public.otps USING btree (user_id, type, used);


--
-- Name: idx_questions_test; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_questions_test ON public.questions USING btree (test_id, ord);


--
-- Name: idx_sessions_expires; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_sessions_expires ON public.sessions USING btree (expires_at);


--
-- Name: idx_sessions_token; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_sessions_token ON public.sessions USING btree (refresh_token_hash);


--
-- Name: idx_sessions_user; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_sessions_user ON public.sessions USING btree (user_id);


--
-- Name: idx_subs_stripe; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_subs_stripe ON public.subscriptions USING btree (stripe_customer_id);


--
-- Name: idx_subs_user; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_subs_user ON public.subscriptions USING btree (user_id, status);


--
-- Name: idx_tasks_user; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_tasks_user ON public.tasks USING btree (user_id, created_at DESC);


--
-- Name: idx_tests_class; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_tests_class ON public.tests USING btree (class_name, status);


--
-- Name: idx_tests_date; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_tests_date ON public.tests USING btree (test_date, status);


--
-- Name: idx_tests_teacher; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_tests_teacher ON public.tests USING btree (teacher_id, status);


--
-- Name: idx_users_auth_subject; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_users_auth_subject ON public.users USING btree (auth_provider, auth_subject);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_parent; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_users_parent ON public.users USING btree (parent_id);


--
-- Name: idx_users_role_status; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_users_role_status ON public.users USING btree (role, status);


--
-- Name: idx_users_school_code; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_users_school_code ON public.users USING btree (school_code);


--
-- Name: idx_workspaces_members; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_workspaces_members ON public.workspaces USING gin (members);


--
-- Name: idx_workspaces_owner; Type: INDEX; Schema: public; Owner: plpuser
--

CREATE INDEX idx_workspaces_owner ON public.workspaces USING btree (owner_id);


--
-- Name: ai_classrooms ai_classrooms_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.ai_classrooms
    ADD CONSTRAINT ai_classrooms_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id);


--
-- Name: analytics analytics_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.analytics
    ADD CONSTRAINT analytics_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id);


--
-- Name: analytics analytics_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.analytics
    ADD CONSTRAINT analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: answers answers_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.test_attempts(id) ON DELETE CASCADE;


--
-- Name: answers answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: audit_events audit_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id);


--
-- Name: audit_events audit_events_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id);


--
-- Name: channels channels_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);


--
-- Name: fcm_tokens fcm_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.fcm_tokens
    ADD CONSTRAINT fcm_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: focus_sessions focus_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.focus_sessions
    ADD CONSTRAINT focus_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: grading_results grading_results_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.grading_results
    ADD CONSTRAINT grading_results_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id);


--
-- Name: grading_results grading_results_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.grading_results
    ADD CONSTRAINT grading_results_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id);


--
-- Name: invites invites_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id);


--
-- Name: live_classes live_classes_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.live_classes
    ADD CONSTRAINT live_classes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id);


--
-- Name: live_session_attendance live_session_attendance_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.live_session_attendance
    ADD CONSTRAINT live_session_attendance_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_classes(id);


--
-- Name: live_session_attendance live_session_attendance_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.live_session_attendance
    ADD CONSTRAINT live_session_attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id);


--
-- Name: lms_connections lms_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.lms_connections
    ADD CONSTRAINT lms_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: membership_roles membership_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.membership_roles
    ADD CONSTRAINT membership_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: membership_roles membership_roles_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.membership_roles
    ADD CONSTRAINT membership_roles_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.memberships(id) ON DELETE CASCADE;


--
-- Name: membership_roles membership_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.membership_roles
    ADD CONSTRAINT membership_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: memberships memberships_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id);


--
-- Name: memberships memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: messages messages_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: otps otps_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.otps
    ADD CONSTRAINT otps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: questions questions_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id);


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: school_classes school_classes_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.school_classes
    ADD CONSTRAINT school_classes_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id);


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: test_assignments test_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.test_assignments
    ADD CONSTRAINT test_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: test_assignments test_assignments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.test_assignments
    ADD CONSTRAINT test_assignments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id);


--
-- Name: test_assignments test_assignments_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.test_assignments
    ADD CONSTRAINT test_assignments_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id);


--
-- Name: test_attempts test_attempts_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.test_attempts
    ADD CONSTRAINT test_attempts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id);


--
-- Name: test_attempts test_attempts_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.test_attempts
    ADD CONSTRAINT test_attempts_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id);


--
-- Name: tests tests_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id);


--
-- Name: workspace_memberships workspace_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.workspace_memberships
    ADD CONSTRAINT workspace_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspace_memberships workspace_memberships_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.workspace_memberships
    ADD CONSTRAINT workspace_memberships_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspaces workspaces_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: timetable_slots; Type: TABLE; Schema: public; Owner: plpuser
--

CREATE TABLE public.timetable_slots (
    id integer NOT NULL,
    workspace_id integer NOT NULL,
    teacher_id integer NOT NULL,
    class_name character varying(255) NOT NULL,
    subject character varying(255) NOT NULL,
    day_of_week integer NOT NULL,
    period_number integer NOT NULL,
    start_time character varying(50) NOT NULL,
    end_time character varying(50) NOT NULL,
    room character varying(255)
);

ALTER TABLE public.timetable_slots OWNER TO plpuser;

--
-- Name: timetable_slots_id_seq; Type: SEQUENCE; Schema: public; Owner: plpuser
--

CREATE SEQUENCE public.timetable_slots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.timetable_slots_id_seq OWNER TO plpuser;

--
-- Name: timetable_slots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: plpuser
--

ALTER SEQUENCE public.timetable_slots_id_seq OWNED BY public.timetable_slots.id;

--
-- Name: timetable_slots id; Type: DEFAULT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.timetable_slots ALTER COLUMN id SET DEFAULT nextval('public.timetable_slots_id_seq'::regclass);

--
-- Name: timetable_slots timetable_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.timetable_slots
    ADD CONSTRAINT timetable_slots_pkey PRIMARY KEY (id);

--
-- Name: timetable_slots timetable_slots_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.timetable_slots
    ADD CONSTRAINT timetable_slots_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: timetable_slots timetable_slots_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: plpuser
--

ALTER TABLE ONLY public.timetable_slots
    ADD CONSTRAINT timetable_slots_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT ALL ON SCHEMA public TO cloudsqlsuperuser;


--
-- PostgreSQL database dump complete
--

\unrestrict WwWX2hVFxTM5WjVZROcKyASKJfCDH4POa25r0Yj095EHAv72aiKl0WZOiNhKa5d

