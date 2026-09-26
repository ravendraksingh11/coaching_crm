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
  } = req.body;
  if (
    !title ||
    !Number.isInteger(Number(totalMarks)) ||
    !Array.isArray(questions) ||
    questions.length !== 50
  )
    return res
      .status(400)
      .json({
        success: false,
        message: "Title, totalMarks and exactly 50 questions are required",
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
      `INSERT INTO tests (institute_id,title,description,total_marks,duration_minutes,test_date,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        req.user.instituteId,
        title,
        description || null,
        totalMarks,
        durationMinutes || null,
        testDate || null,
        req.user.userId,
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

async function getStudentTests(req, res) {
  try {
    const r = await pool.query(
      `SELECT DISTINCT t.id,t.title,t.description,t.total_marks,t.duration_minutes,t.test_date,a.due_date,ts.submitted_at,tr.marks_obtained,tr.percentage FROM students s JOIN enrollments e ON e.student_id=s.id AND e.status='ACTIVE' JOIN test_assignments a ON a.student_id=s.id OR (a.batch_id=e.batch_id AND a.student_id IS NULL) JOIN tests t ON t.id=a.test_id AND t.status='ACTIVE' LEFT JOIN test_submissions ts ON ts.test_id=t.id AND ts.student_id=s.id LEFT JOIN test_results tr ON tr.test_id=t.id AND tr.student_id=s.id WHERE s.user_id=$1 AND a.status='ACTIVE' ORDER BY t.created_at DESC`,
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
      `SELECT q.id,q.question,q.option_a,q.option_b,q.option_c,q.option_d,q.marks FROM questions q JOIN tests t ON t.id=q.test_id WHERE q.test_id=$1 AND t.status='ACTIVE' AND EXISTS (SELECT 1 FROM students s LEFT JOIN enrollments e ON e.student_id=s.id AND e.status='ACTIVE' JOIN test_assignments a ON a.test_id=t.id AND a.status='ACTIVE' AND (a.student_id=s.id OR (a.student_id IS NULL AND a.batch_id=e.batch_id)) WHERE s.user_id=$2)`,
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
  getStudentTests,
  getTestForStudent,
  submitTest,
  latestToppers,
  deactivateTest,
};
