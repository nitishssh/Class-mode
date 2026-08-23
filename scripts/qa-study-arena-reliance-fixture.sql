-- QA fixture for the Study Arena reliance read model.
-- Load against a migrated database, then GET /api/study-arena-beta/reliance.
-- Covers: unaided attempter, hint-first student, hint-after-attempt student,
-- thin evidence, a teacher preview session, an out-of-window assignment, and
-- a second workspace for tenant isolation. See docs/over-reliance-dashboard-plan.md.

-- QA fixture for the reliance read model. Four students in workspace 1 covering
-- each branch of the metric, plus one in workspace 2 to prove tenant isolation.
BEGIN;

INSERT INTO workspaces (id, name, type, owner_id) VALUES (2, 'Other School', 'school', 1)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, auth_provider, auth_subject, email, name, display_name, role) VALUES
  (101,'local','qa-101','asha@qa.test','Asha','Asha','student'),
  (102,'local','qa-102','ravi@qa.test','Ravi','Ravi','student'),
  (103,'local','qa-103','meena@qa.test','Meena','Meena','student'),
  (104,'local','qa-104','thin@qa.test','Thin Evidence','Thin Evidence','student'),
  (105,'local','qa-105','other@qa.test','Other Tenant','Other Tenant','student')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO school_classes (id, name, grade) VALUES (1, 'Class 8A', '8')
  ON CONFLICT (id) DO NOTHING;

-- Two lesson versions in different subjects so the subject filter is exercised.
INSERT INTO study_arena_lesson_versions
  (id, workspace_id, created_by, status, subject, objective, script, evaluator_version)
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001',1,1,'published','maths','Solve linear equations','{}','v1'),
  ('aaaaaaaa-0000-4000-8000-000000000002',1,1,'published','science','Photosynthesis','{}','v1'),
  ('aaaaaaaa-0000-4000-8000-000000000003',2,1,'published','maths','Other tenant lesson','{}','v1')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO study_arena_assignments
  (id, workspace_id, lesson_version_id, created_by, school_class_id, status, created_at)
VALUES
  ('bbbbbbbb-0000-4000-8000-000000000001',1,'aaaaaaaa-0000-4000-8000-000000000001',1,1,'published', now() - interval '10 days'),
  ('bbbbbbbb-0000-4000-8000-000000000002',1,'aaaaaaaa-0000-4000-8000-000000000002',1,NULL,'published', now() - interval '3 days'),
  ('bbbbbbbb-0000-4000-8000-000000000003',1,'aaaaaaaa-0000-4000-8000-000000000001',1,1,'published', now() - interval '200 days'),
  ('bbbbbbbb-0000-4000-8000-000000000004',2,'aaaaaaaa-0000-4000-8000-000000000003',1,NULL,'published', now() - interval '2 days')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO study_arena_attempt_sessions
  (id, assignment_id, student_id, lesson_version_id, status, is_preview)
VALUES
  ('cccccccc-0000-4000-8000-000000000001','bbbbbbbb-0000-4000-8000-000000000001',101,'aaaaaaaa-0000-4000-8000-000000000001','completed',false),
  ('cccccccc-0000-4000-8000-000000000002','bbbbbbbb-0000-4000-8000-000000000001',102,'aaaaaaaa-0000-4000-8000-000000000001','completed',false),
  ('cccccccc-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000001',103,'aaaaaaaa-0000-4000-8000-000000000001','completed',false),
  ('cccccccc-0000-4000-8000-000000000004','bbbbbbbb-0000-4000-8000-000000000002',102,'aaaaaaaa-0000-4000-8000-000000000002','completed',false),
  ('cccccccc-0000-4000-8000-000000000005','bbbbbbbb-0000-4000-8000-000000000002',101,'aaaaaaaa-0000-4000-8000-000000000002','completed',false),
  ('cccccccc-0000-4000-8000-000000000006','bbbbbbbb-0000-4000-8000-000000000001',104,'aaaaaaaa-0000-4000-8000-000000000001','active',false),
  -- A teacher preview on the same assignment: must never appear as learner evidence.
  ('cccccccc-0000-4000-8000-000000000007','bbbbbbbb-0000-4000-8000-000000000001',1,'aaaaaaaa-0000-4000-8000-000000000001','completed',true),
  ('cccccccc-0000-4000-8000-000000000008','bbbbbbbb-0000-4000-8000-000000000003',101,'aaaaaaaa-0000-4000-8000-000000000001','completed',false),
  ('cccccccc-0000-4000-8000-000000000009','bbbbbbbb-0000-4000-8000-000000000004',105,'aaaaaaaa-0000-4000-8000-000000000003','completed',false)
  ON CONFLICT (id) DO NOTHING;
COMMIT;

BEGIN;
-- ev(session, student, assignment, lesson, workspace, gate, kind, offset_seconds)
CREATE OR REPLACE FUNCTION qa_ev(sess uuid, stu bigint, asg uuid, lv uuid, ws bigint,
                                 gate int, kind text, secs int, base interval) RETURNS void AS $$
BEGIN
  INSERT INTO study_arena_evidence_events
    (workspace_id, assignment_id, attempt_session_id, student_id, lesson_version_id,
     objective, event_kind, action_index, idempotency_key, evidence, created_at)
  VALUES (ws, asg, sess, stu, lv, 'obj', kind, gate,
          kind || '-' || gate || '-' || secs, '{}', now() - base + make_interval(secs => secs));
END; $$ LANGUAGE plpgsql;

DO $$
DECLARE
  a1 uuid := 'bbbbbbbb-0000-4000-8000-000000000001';
  a2 uuid := 'bbbbbbbb-0000-4000-8000-000000000002';
  a3 uuid := 'bbbbbbbb-0000-4000-8000-000000000003';
  a4 uuid := 'bbbbbbbb-0000-4000-8000-000000000004';
  l1 uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  l2 uuid := 'aaaaaaaa-0000-4000-8000-000000000002';
  l3 uuid := 'aaaaaaaa-0000-4000-8000-000000000003';
  g int;
BEGIN
  -- Asha: 4 gates, attempts only (two attempts on gate 0). Unaided.
  FOR g IN 0..3 LOOP
    PERFORM qa_ev('cccccccc-0000-4000-8000-000000000001',101,a1,l1,1,g,'attempt',g*10, interval '10 days');
  END LOOP;
  PERFORM qa_ev('cccccccc-0000-4000-8000-000000000001',101,a1,l1,1,0,'attempt',5, interval '10 days');
  PERFORM qa_ev('cccccccc-0000-4000-8000-000000000001',101,a1,l1,1,1,'attempt',15, interval '10 days');

  -- Ravi: hint BEFORE attempt at all 4 gates. Maximally reliant.
  FOR g IN 0..3 LOOP
    PERFORM qa_ev('cccccccc-0000-4000-8000-000000000002',102,a1,l1,1,g,'hint',   g*10,   interval '10 days');
    PERFORM qa_ev('cccccccc-0000-4000-8000-000000000002',102,a1,l1,1,g,'attempt',g*10+5, interval '10 days');
  END LOOP;

  -- Meena: attempt first, hint after. Same hint count as Ravi, productive struggle.
  FOR g IN 0..3 LOOP
    PERFORM qa_ev('cccccccc-0000-4000-8000-000000000003',103,a1,l1,1,g,'attempt',g*10,   interval '10 days');
    PERFORM qa_ev('cccccccc-0000-4000-8000-000000000003',103,a1,l1,1,g,'hint',   g*10+5, interval '10 days');
  END LOOP;

  -- Thin evidence: 2 gates, both hint-first. Below the floor, must not be scored.
  FOR g IN 0..1 LOOP
    PERFORM qa_ev('cccccccc-0000-4000-8000-000000000006',104,a1,l1,1,g,'hint',g*10, interval '10 days');
  END LOOP;

  -- Teacher preview evidence on the same assignment: must not surface as a learner.
  FOR g IN 0..3 LOOP
    PERFORM qa_ev('cccccccc-0000-4000-8000-000000000007',1,a1,l1,1,g,'hint',g*10, interval '10 days');
  END LOOP;

  -- Assignment 2 (science, 3 days ago): Ravi improves to 1 hint-first of 4, Asha stays unaided.
  FOR g IN 0..3 LOOP
    PERFORM qa_ev('cccccccc-0000-4000-8000-000000000004',102,a2,l2,1,g,'attempt',g*10, interval '3 days');
    PERFORM qa_ev('cccccccc-0000-4000-8000-000000000005',101,a2,l2,1,g,'attempt',g*10, interval '3 days');
  END LOOP;
  PERFORM qa_ev('cccccccc-0000-4000-8000-000000000004',102,a2,l2,1,0,'hint',-5, interval '3 days');

  -- Assignment 3 (200 days ago): heavy hint-first, outside every window.
  FOR g IN 0..3 LOOP
    PERFORM qa_ev('cccccccc-0000-4000-8000-000000000008',101,a3,l1,1,g,'hint',g*10, interval '200 days');
  END LOOP;

  -- Workspace 2: must never appear in workspace 1's read.
  FOR g IN 0..3 LOOP
    PERFORM qa_ev('cccccccc-0000-4000-8000-000000000009',105,a4,l3,2,g,'hint',g*10, interval '2 days');
  END LOOP;
END $$;

-- Independent transfer: Asha correct, Meena wrong (gap, not a crutch), Ravi correct.
INSERT INTO study_arena_assessment_instances
  (id, attempt_session_id, assessment_id, evaluator_version, status, submitted_at)
VALUES
  ('dddddddd-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001','check-1','v1','submitted', now() - interval '10 days'),
  ('dddddddd-0000-4000-8000-000000000002','cccccccc-0000-4000-8000-000000000002','check-1','v1','submitted', now() - interval '10 days'),
  ('dddddddd-0000-4000-8000-000000000003','cccccccc-0000-4000-8000-000000000003','check-1','v1','submitted', now() - interval '10 days')
  ON CONFLICT DO NOTHING;

INSERT INTO study_arena_assessment_evaluations
  (assessment_instance_id, evaluator_version, correct)
VALUES
  ('dddddddd-0000-4000-8000-000000000001','v1',true),
  ('dddddddd-0000-4000-8000-000000000002','v1',true),
  ('dddddddd-0000-4000-8000-000000000003','v1',false)
  ON CONFLICT DO NOTHING;
COMMIT;
