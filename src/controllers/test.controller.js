const pool = require("../../database/connection");

async function createTest(req, res) {
  const {
    title,
    description,
    totalMarks,
    durationMinutes,
    testDate,
    questions = [],
    batchId,
    studentId,
    dueDate,
    screenRecording = false,
    autoSubmitOnLeave = false,
  } = req.body;
  if (
    !title ||
    !Number.isInteger(Number(totalMarks)) ||
    !Number.isInteger(Number(durationMinutes)) ||
    Number(durationMinutes) < 1 ||
    !Array.isArray(questions) ||
    questions.length < 1
  )
    return res
      .status(400)
      .json({
        success: false,
        message: "Title, totalMarks, a positive duration and at least one question are required",
      });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (batchId) {
      const r = await client.query(
        "SELECT id FROM batches WHERE id=$1 AND institute_id=$2",
        [batchId, req.user.instituteId],
      );
      if (!r.rowCount) throw new Error("Invalid batch");
    }
    if (studentId) {
      const r = await client.query(
        "SELECT id FROM students WHERE id=$1 AND institute_id=$2",
        [studentId, req.user.instituteId],
      );
      if (!r.rowCount) throw new Error("Invalid student");
    }
    if (!batchId && !studentId) throw new Error("Assign a batch or student");
    const test = await client.query(
      `INSERT INTO tests (institute_id,title,description,total_marks,duration_minutes,test_date,created_by,screen_recording,auto_submit_on_leave) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        req.user.instituteId,
        title,
        description || null,
        totalMarks,
        durationMinutes || null,
        testDate || null,
        req.user.userId,
        screenRecording === true,
        autoSubmitOnLeave === true,
      ],
    );
    for (const q of questions) {
      if (!q.question || !q.correctOption)
        throw new Error("Each question and correctOption are required");
      await client.query(
        `INSERT INTO questions (test_id,question,option_a,option_b,option_c,option_d,correct_option,marks) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          test.rows[0].id,
          q.question,
          q.optionA || null,
          q.optionB || null,
          q.optionC || null,
          q.optionD || null,
          q.correctOption,
          q.marks || 1,
        ],
      );
    }
    await client.query(
      `INSERT INTO test_assignments (test_id,institute_id,batch_id,student_id,due_date) VALUES ($1,$2,$3,$4,$5)`,
      [
        test.rows[0].id,
        req.user.instituteId,
        batchId || null,
        studentId || null,
        dueDate || null,
      ],
    );
    await client.query("COMMIT");
    return res.status(201).json({ success: true, data: test.rows[0] });
  } catch (e) {
    await client.query("ROLLBACK");
    return res
      .status(
        e.message.startsWith("Invalid") ||
          e.message.startsWith("Assign") ||
          e.message.startsWith("Each")
          ? 400
          : 500,
      )
      .json({ success: false, message: e.message || "Failed to create test" });
  } finally {
    client.release();
  }
}

async function listInstituteTests(req, res) {
  try {
    const result = await pool.query(
      `SELECT t.id,t.title,t.description,t.total_marks,t.duration_minutes,t.test_date,t.status,t.screen_recording,t.auto_submit_on_leave,t.created_at,
        COALESCE(json_agg(DISTINCT jsonb_build_object('batchId',a.batch_id,'studentId',a.student_id,'dueDate',a.due_date)) FILTER (WHERE a.id IS NOT NULL),'[]') AS assignments,
        COUNT(DISTINCT q.id)::int AS question_count,
        COUNT(DISTINCT sub.id)::int AS submission_count,
        COUNT(DISTINCT ta.id)::int AS attempt_count
       FROM tests t
       LEFT JOIN test_assignments a ON a.test_id=t.id
       LEFT JOIN questions q ON q.test_id=t.id
       LEFT JOIN test_submissions sub ON sub.test_id=t.id
       LEFT JOIN test_attempts ta ON ta.test_id=t.id
       WHERE t.institute_id=$1
       GROUP BY t.id ORDER BY t.created_at DESC`,
      [req.user.instituteId],
    );
    return res.json({ success: true, data: result.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Could not fetch institute tests" });
  }
}

async function getInstituteTest(req, res) {
  try {
    const test = await pool.query(
      `SELECT t.*,
        COALESCE(json_agg(DISTINCT jsonb_build_object('batchId',a.batch_id,'studentId',a.student_id,'dueDate',a.due_date)) FILTER (WHERE a.id IS NOT NULL),'[]') AS assignments
       FROM tests t LEFT JOIN test_assignments a ON a.test_id=t.id
       WHERE t.id=$1 AND t.institute_id=$2 GROUP BY t.id`,
      [req.params.id, req.user.instituteId],
    );
    if (!test.rowCount) return res.status(404).json({ success: false, message: "Test not found" });
    const questions = await pool.query(
      "SELECT id,question,option_a,option_b,option_c,option_d,correct_option,marks FROM questions WHERE test_id=$1 ORDER BY created_at,id",
      [req.params.id],
    );
    return res.json({ success: true, data: { ...test.rows[0], questions: questions.rows } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Could not fetch test" });
  }
}

async function updateInstituteTest(req, res) {
  const { title, description, totalMarks, durationMinutes, testDate, dueDate, questions, batchId, studentId, screenRecording, autoSubmitOnLeave } = req.body;
  if (!title || !Number.isInteger(Number(totalMarks)) || !Number.isInteger(Number(durationMinutes)) || Number(durationMinutes) < 1 || !Array.isArray(questions) || questions.length < 1 || (!batchId && !studentId)) {
    return res.status(400).json({ success: false, message: "Provide a title, positive marks and duration, at least one question, and a batch or student assignment" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT id FROM tests WHERE id=$1 AND institute_id=$2 FOR UPDATE", [req.params.id, req.user.instituteId]);
    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Test not found" });
    }
    const attempts = await client.query("SELECT 1 FROM test_attempts WHERE test_id=$1 LIMIT 1", [req.params.id]);
    if (attempts.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "A test cannot be edited after a student has started it" });
    }
    if (batchId) {
      const valid = await client.query("SELECT 1 FROM batches WHERE id=$1 AND institute_id=$2", [batchId, req.user.instituteId]);
      if (!valid.rowCount) throw new Error("Invalid batch");
    }
    if (studentId) {
      const valid = await client.query("SELECT 1 FROM students WHERE id=$1 AND institute_id=$2", [studentId, req.user.instituteId]);
      if (!valid.rowCount) throw new Error("Invalid student");
    }
    for (const q of questions) if (!q.question || !q.correctOption) throw new Error("Each question and correctOption are required");
    await client.query(
      `UPDATE tests SET title=$1,description=$2,total_marks=$3,duration_minutes=$4,test_date=$5,screen_recording=$6,auto_submit_on_leave=$7 WHERE id=$8 AND institute_id=$9`,
      [title, description || null, totalMarks, durationMinutes, testDate || null, screenRecording === true, autoSubmitOnLeave === true, req.params.id, req.user.instituteId],
    );
    await client.query("DELETE FROM questions WHERE test_id=$1", [req.params.id]);
    for (const q of questions) {
      await client.query(
        `INSERT INTO questions (test_id,question,option_a,option_b,option_c,option_d,correct_option,marks) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [req.params.id, q.question, q.optionA || q.option_a || null, q.optionB || q.option_b || null, q.optionC || q.option_c || null, q.optionD || q.option_d || null, q.correctOption || q.correct_option, q.marks || 1],
      );
    }
    await client.query("UPDATE test_assignments SET batch_id=$1,student_id=$2,due_date=$3 WHERE test_id=$4 AND institute_id=$5", [batchId || null, studentId || null, dueDate || null, req.params.id, req.user.instituteId]);
    await client.query("COMMIT");
    return res.json({ success: true, message: "Test updated" });
  } catch (e) {
    await client.query("ROLLBACK");
    const status = e.message.startsWith("Invalid") || e.message.startsWith("Each") ? 400 : 500;
    return res.status(status).json({ success: false, message: e.message || "Could not update test" });
  } finally {
    client.release();
  }
}

async function deleteInstituteTest(req, res) {
  try {
    const result = await pool.query("DELETE FROM tests WHERE id=$1 AND institute_id=$2 RETURNING id", [req.params.id, req.user.instituteId]);
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Test not found" });
    return res.json({ success: true, message: "Test deleted" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Could not delete test" });
  }
}

async function getStudentTests(req, res) {
  try {
    const r = await pool.query(
      `SELECT DISTINCT t.id,t.title,t.description,t.total_marks,t.duration_minutes,t.test_date,t.created_at,t.screen_recording,t.auto_submit_on_leave,a.due_date,ts.submitted_at,tr.marks_obtained,tr.percentage
       FROM students s
       JOIN test_assignments a ON a.status='ACTIVE'
       JOIN tests t ON t.id=a.test_id AND t.status='ACTIVE' AND t.institute_id=s.institute_id AND a.institute_id=s.institute_id
       LEFT JOIN test_submissions ts ON ts.test_id=t.id AND ts.student_id=s.id
       LEFT JOIN test_results tr ON tr.test_id=t.id AND tr.student_id=s.id
       WHERE s.user_id=$1 AND (
         a.student_id=s.id OR
         (a.batch_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM enrollments e
           WHERE e.student_id=s.id AND e.batch_id=a.batch_id
             AND e.institute_id=s.institute_id AND e.status='ACTIVE'
         ))
       )
       ORDER BY t.created_at DESC`,
      [req.user.userId],
    );
    return res.json({ success: true, data: r.rows });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch tests" });
  }
}
async function getTestForStudent(req, res) {
  try {
    const r = await pool.query(
      `SELECT DISTINCT q.id,q.question,q.option_a,q.option_b,q.option_c,q.option_d,q.marks,t.duration_minutes,t.screen_recording,t.auto_submit_on_leave,ta.started_at
       FROM questions q
       JOIN tests t ON t.id=q.test_id
       LEFT JOIN test_attempts ta ON ta.test_id=t.id AND ta.student_id=(SELECT id FROM students WHERE user_id=$2)
       WHERE q.test_id=$1 AND t.status='ACTIVE' AND EXISTS (
         SELECT 1 FROM students s
         JOIN test_assignments a ON a.test_id=t.id AND a.status='ACTIVE' AND a.institute_id=s.institute_id
         WHERE s.user_id=$2 AND s.institute_id=t.institute_id AND (
           a.student_id=s.id OR
           (a.batch_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM enrollments e
             WHERE e.student_id=s.id AND e.batch_id=a.batch_id
               AND e.institute_id=s.institute_id AND e.status='ACTIVE'
           ))
         )
       )`,
      [req.params.id, req.user.userId],
    );
    if (!r.rowCount)
      return res
        .status(404)
        .json({ success: false, message: "Assigned active test not found" });
    return res.json({ success: true, data: r.rows });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load test" });
  }
}
async function startTest(req, res) {
  try {
    const r = await pool.query(
      `INSERT INTO test_attempts (test_id,student_id)
       SELECT $1,s.id FROM students s
       WHERE s.user_id=$2 AND EXISTS (
         SELECT 1 FROM tests t
         JOIN test_assignments a ON a.test_id=t.id AND a.status='ACTIVE' AND a.institute_id=s.institute_id
         WHERE t.id=$1 AND t.status='ACTIVE' AND t.institute_id=s.institute_id AND (
           a.student_id=s.id OR
           (a.batch_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM enrollments e
             WHERE e.student_id=s.id AND e.batch_id=a.batch_id
               AND e.institute_id=s.institute_id AND e.status='ACTIVE'
           ))
         )
       )
       ON CONFLICT (test_id,student_id) DO UPDATE SET test_id=EXCLUDED.test_id
       WHERE test_attempts.submitted_at IS NULL
       RETURNING started_at,
         (started_at + ((SELECT duration_minutes FROM tests WHERE id=$1) * interval '1 minute')) AS deadline,
         (SELECT screen_recording FROM tests WHERE id=$1) AS screen_recording,
         (SELECT auto_submit_on_leave FROM tests WHERE id=$1) AS auto_submit_on_leave`,
      [req.params.id, req.user.userId],
    );
    if (!r.rowCount) return res.status(404).json({ success: false, message: "Assigned active test not found or already submitted" });
    return res.json({ success: true, data: r.rows[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Could not start test" });
  }
}
async function submitTest(req, res) {
  const { answers = {} } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const student = await client.query(
      "SELECT id,institute_id FROM students WHERE user_id=$1",
      [req.user.userId],
    );
    if (!student.rowCount) throw new Error("Student not found");
    const attempt = await client.query(
      `SELECT ta.started_at,ta.submitted_at,t.duration_minutes FROM test_attempts ta JOIN tests t ON t.id=ta.test_id WHERE ta.test_id=$1 AND ta.student_id=$2 FOR UPDATE`,
      [req.params.id, student.rows[0].id],
    );
    if (!attempt.rowCount) throw new Error("Start this test before submitting");
    if (attempt.rows[0].submitted_at) throw new Error("Test already submitted");
    const qs = await client.query(
      "SELECT id,correct_option,marks FROM questions WHERE test_id=$1",
      [req.params.id],
    );
    if (!qs.rowCount) throw new Error("Test not found");
    let score = 0,
      total = 0;
    qs.rows.forEach((q) => {
      total += Number(q.marks);
      if (answers[q.id] === q.correct_option) score += Number(q.marks);
    });
    const percent = total ? (score * 100) / total : 0;
    await client.query(
      "INSERT INTO test_submissions (test_id,student_id,answers) VALUES ($1,$2,$3)",
      [req.params.id, student.rows[0].id, answers],
    );
    await client.query(
      "UPDATE test_attempts SET submitted_at=CURRENT_TIMESTAMP WHERE test_id=$1 AND student_id=$2",
      [req.params.id, student.rows[0].id],
    );
    const result = await client.query(
      "INSERT INTO test_results (institute_id,test_id,student_id,marks_obtained,percentage) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [
        student.rows[0].institute_id,
        req.params.id,
        student.rows[0].id,
        score,
        percent,
      ],
    );
    await client.query(
      `INSERT INTO notifications (institute_id,title,message,type,created_by) VALUES ($1,'Test completed','A student completed a test','RESULT',$2)`,
      [student.rows[0].institute_id, req.user.userId],
    );
    await client.query("COMMIT");
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    await client.query("ROLLBACK");
    return res
      .status(e.code === "23505" ? 409 : 400)
      .json({ success: false, message: e.message || "Failed to submit test" });
  } finally {
    client.release();
  }
}
async function latestToppers(req, res) {
  try {
    const r = await pool.query(
      `SELECT DISTINCT ON (tr.test_id) tr.test_id,t.title,u.name AS topper_name,tr.marks_obtained,tr.percentage FROM test_results tr JOIN tests t ON t.id=tr.test_id JOIN students s ON s.id=tr.student_id JOIN users u ON u.id=s.user_id WHERE tr.institute_id=$1 ORDER BY tr.test_id,tr.marks_obtained DESC,tr.submitted_at ASC`,
      [req.user.instituteId],
    );
    return res.json({ success: true, data: r.rows.slice(0, 5) });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch toppers" });
  }
}
async function deactivateTest(req, res) {
  try {
    const t = await pool.query(
      "UPDATE tests SET status='INACTIVE' WHERE id=$1 AND institute_id=$2 RETURNING *",
      [req.params.id, req.user.instituteId],
    );
    if (!t.rowCount)
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });
    await pool.query(
      `INSERT INTO notifications (institute_id,title,message,type,created_by,recipient_user_id) SELECT DISTINCT s.institute_id,'Test missed','A test was deactivated before the student submitted it','TEST',$2,p.user_id FROM students s JOIN parent_students ps ON ps.student_id=s.id JOIN parents p ON p.id=ps.parent_id JOIN test_assignments a ON a.test_id=$1 AND (a.student_id=s.id OR a.batch_id IN (SELECT batch_id FROM enrollments WHERE student_id=s.id)) LEFT JOIN test_submissions x ON x.test_id=a.test_id AND x.student_id=s.id WHERE x.id IS NULL`,
      [req.params.id, req.user.userId],
    );
    return res.json({
      success: true,
      message: "Test deactivated and notifications created",
    });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ success: false, message: "Failed to deactivate test" });
  }
}
module.exports = {
  createTest,
  listInstituteTests,
  getInstituteTest,
  updateInstituteTest,
  deleteInstituteTest,
  getStudentTests,
  getTestForStudent,
  startTest,
  submitTest,
  latestToppers,
  deactivateTest,
};
