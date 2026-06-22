import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool, type PoolClient } from "pg";

const TEACHER_EMAIL = "teacher.demo@classmode.local";
const TEACHER_PASSWORD = "ClassModeDemo123!";
const SCHOOL_CODE = "CLASSMODE-DEMO";
const WORKSPACE_SLUG = "classmode-demo-school";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
  console.error("Refusing to seed production. Set ALLOW_PRODUCTION_SEED=true to override.");
  process.exit(1);
}

const connectionString = process.env.POSTGRESQL_URL;
if (!connectionString) {
  console.error("POSTGRESQL_URL is required.");
  process.exit(1);
}

async function upsertUser(
  client: PoolClient,
  input: {
    email: string;
    username: string;
    name: string;
    role: "teacher" | "student";
    passwordHash: string;
    grade?: string;
    subjects: string[];
  }
): Promise<number> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO users
       (auth_provider, auth_subject, email, username, password_hash, name, display_name,
        email_verified, role, status, school_code, grade, subjects, class_name,
        onboarding_complete)
     VALUES ('local', $1, $2, $3, $4, $5, $5, true, $6, 'active', $7, $8, $9, $8, true)
     ON CONFLICT (email) DO UPDATE SET
       username = EXCLUDED.username,
       password_hash = EXCLUDED.password_hash,
       name = EXCLUDED.name,
       display_name = EXCLUDED.display_name,
       email_verified = true,
       role = EXCLUDED.role,
       status = 'active',
       school_code = EXCLUDED.school_code,
       grade = EXCLUDED.grade,
       subjects = EXCLUDED.subjects,
       class_name = EXCLUDED.class_name,
       onboarding_complete = true
     RETURNING id`,
    [
      input.email,
      input.email,
      input.username,
      input.passwordHash,
      input.name,
      input.role,
      SCHOOL_CODE,
      input.grade ?? null,
      input.subjects,
    ]
  );
  return Number(rows[0].id);
}

async function upsertTest(
  client: PoolClient,
  teacherId: number,
  title: string,
  subject: string,
  status: "draft" | "published" | "completed",
  daysFromNow: number
): Promise<number> {
  const existing = await client.query<{ id: string }>(
    "SELECT id FROM tests WHERE teacher_id = $1 AND title = $2 LIMIT 1",
    [teacherId, title]
  );
  const testDate = new Date(Date.now() + daysFromNow * 86_400_000);
  if (existing.rows[0]) {
    await client.query(
      `UPDATE tests SET subject=$1, class_name='10', total_marks=100, duration=60,
       test_date=$2, question_types=ARRAY['mcq','short'], status=$3 WHERE id=$4`,
      [subject, testDate, status, existing.rows[0].id]
    );
    return Number(existing.rows[0].id);
  }
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO tests
       (title, description, subject, class_name, teacher_id, total_marks, duration,
        test_date, question_types, status)
     VALUES ($1,$2,$3,'10',$4,100,60,$5,ARRAY['mcq','short'],$6)
     RETURNING id`,
    [title, `Demo ${subject} assessment`, subject, teacherId, testDate, status]
  );
  return Number(rows[0].id);
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const passwordHash = await bcrypt.hash(TEACHER_PASSWORD, 12);

    const teacherId = await upsertUser(client, {
      email: TEACHER_EMAIL,
      username: "teacher_demo",
      name: "Maya Sharma",
      role: "teacher",
      passwordHash,
      subjects: ["Mathematics", "Physics"],
    });

    const studentInputs = [
      ["student.asha@classmode.local", "student_asha", "Asha Patel"],
      ["student.rohan@classmode.local", "student_rohan", "Rohan Mehta"],
      ["student.zoya@classmode.local", "student_zoya", "Zoya Khan"],
    ] as const;
    const studentIds: number[] = [];
    for (const [email, username, name] of studentInputs) {
      studentIds.push(
        await upsertUser(client, {
          email,
          username,
          name,
          role: "student",
          passwordHash,
          grade: "10",
          subjects: ["Mathematics", "Physics", "Chemistry"],
        })
      );
    }

    const school = await client.query<{ id: string }>(
      `INSERT INTO schools
         (code, name, city, board, grades_offered, created_by_uid, onboarding_complete)
       VALUES ($1,'Class Mode Demo School','Bengaluru','CBSE',ARRAY['10'],$2,true)
       ON CONFLICT (code) DO UPDATE SET
         name=EXCLUDED.name, city=EXCLUDED.city, board=EXCLUDED.board,
         grades_offered=EXCLUDED.grades_offered, onboarding_complete=true
       RETURNING id`,
      [SCHOOL_CODE, TEACHER_EMAIL]
    );
    const schoolId = Number(school.rows[0].id);

    await client.query("UPDATE users SET school_id=$1 WHERE id = ANY($2::bigint[])", [
      schoolId,
      [teacherId, ...studentIds],
    ]);

    const workspace = await client.query<{ id: string }>(
      `INSERT INTO workspaces (name, slug, type, description, owner_id, members)
       VALUES ('Class Mode Demo School',$1,'school','Local teacher UI demo',$2,$3)
       ON CONFLICT (slug) DO UPDATE SET
         name=EXCLUDED.name, owner_id=EXCLUDED.owner_id, members=EXCLUDED.members
       RETURNING id`,
      [WORKSPACE_SLUG, teacherId, [teacherId, ...studentIds]]
    );
    const workspaceId = Number(workspace.rows[0].id);

    for (const [index, userId] of [teacherId, ...studentIds].entries()) {
      await client.query(
        `INSERT INTO workspace_memberships (workspace_id,user_id,role,status)
         VALUES ($1,$2,$3,'active')
         ON CONFLICT (workspace_id,user_id) DO UPDATE SET role=EXCLUDED.role,status='active'`,
        [workspaceId, userId, index === 0 ? "owner" : "member"]
      );
    }

    const algebraTest = await upsertTest(
      client,
      teacherId,
      "Algebra Readiness Check",
      "Mathematics",
      "published",
      2
    );
    const mechanicsTest = await upsertTest(
      client,
      teacherId,
      "Forces and Motion",
      "Physics",
      "published",
      5
    );
    await upsertTest(
      client,
      teacherId,
      "Term 1 Mathematics Review",
      "Mathematics",
      "completed",
      -7
    );

    for (const [index, studentId] of studentIds.entries()) {
      await client.query(
        `DELETE FROM test_assignments
         WHERE test_id = ANY($1::bigint[]) AND student_id=$2 AND assigned_by=$3`,
        [[algebraTest, mechanicsTest], studentId, teacherId]
      );
      await client.query(
        `INSERT INTO test_assignments
           (test_id,student_id,assigned_by,due_date,status,notification_sent)
         VALUES ($1,$2,$3,now() + interval '2 days','pending',true),
                ($4,$2,$3,now() + interval '5 days','pending',true)`,
        [algebraTest, studentId, teacherId, mechanicsTest]
      );

      await client.query("DELETE FROM test_attempts WHERE test_id=$1 AND student_id=$2", [
        algebraTest,
        studentId,
      ]);
      await client.query(
        `INSERT INTO test_attempts (test_id,student_id,start_time,end_time,score,status)
         VALUES ($1,$2,now() - interval '90 minutes',now() - interval '60 minutes',$3,$4)`,
        [algebraTest, studentId, 62 + index * 11, index < 2 ? "completed" : "evaluated"]
      );
    }

    await client.query(
      "DELETE FROM live_classes WHERE teacher_id=$1 AND title='Grade 10 Mathematics Workshop'",
      [teacherId]
    );
    await client.query(
      `INSERT INTO live_classes
         (title,description,teacher_id,class_name,scheduled_time,duration_minutes,status)
       VALUES ('Grade 10 Mathematics Workshop','Review algebra misconceptions',$1,'10',
               date_trunc('day',now()) + interval '15 hours',45,'scheduled')`,
      [teacherId]
    );

    await client.query("COMMIT");
    console.log("Pilot environment ready.");
    console.log(`Teacher login: ${TEACHER_EMAIL}`);
    console.log(`Password: ${TEACHER_PASSWORD}`);
    console.log(`Workspace: ${WORKSPACE_SLUG}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Pilot seed failed:", error);
  process.exitCode = 1;
});
