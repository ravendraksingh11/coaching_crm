const pool = require("../../database/connection");

const ATTENDANCE_STATUSES = new Set(["PRESENT", "ABSENT", "LATE", "LEAVE"]);
const SESSION_STATUSES = new Set(["OPEN", "COMPLETED", "CANCELLED"]);

async function createSession(req, res) {
  const { batchId, sessionDate, startTime, endTime, teacherId, remarks } = req.body;
  if (!batchId || !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate || "")) {
    return res.status(400).json({ success: false, message: "Batch and session date are required" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const batch = await client.query(
      "SELECT id FROM batches WHERE id=$1 AND institute_id=$2 FOR UPDATE",
      [batchId, req.user.instituteId],
    );
    if (!batch.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Batch not found" });
    }
    const selectedTeacherId = req.user.role === "TEACHER" ? req.user.userId : (teacherId || null);
    if (selectedTeacherId) {
      const teacher = await client.query(
        "SELECT id FROM users WHERE id=$1 AND institute_id=$2 AND role='TEACHER' AND status='ACTIVE'",
        [selectedTeacherId, req.user.instituteId],
      );
      if (!teacher.rowCount) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Select an active teacher in this institute" });
      }
    }
    const duplicate = await client.query(
      "SELECT id FROM attendance_sessions WHERE batch_id=$1 AND session_date=$2 AND start_time IS NOT DISTINCT FROM $3::time",
      [batchId, sessionDate, startTime || null],
    );
    if (duplicate.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "A session already exists for this batch, date and start time" });
    }
    const session = await client.query(
      `INSERT INTO attendance_sessions (institute_id,batch_id,teacher_id,session_date,start_time,end_time,remarks,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.instituteId, batchId, selectedTeacherId, sessionDate, startTime || null, endTime || null, remarks || null, req.user.userId],
    );
    await client.query(
      `INSERT INTO attendance_records (attendance_session_id,student_id,status)
       SELECT $1,e.student_id,'ABSENT' FROM enrollments e
       JOIN students s ON s.id=e.student_id AND s.institute_id=$2
       WHERE e.batch_id=$3 AND e.institute_id=$2 AND e.status='ACTIVE'
       ON CONFLICT (attendance_session_id,student_id) DO NOTHING`,
      [session.rows[0].id, req.user.instituteId, batchId],
    );
    await client.query("COMMIT");
    return res.status(201).json({ success: true, data: session.rows[0] });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    return res.status(e.code === "23505" ? 409 : 500).json({ success: false, message: "Could not create attendance session" });
  } finally {
    client.release();
  }
}

async function listSessions(req, res) {
  try {
    const values = [req.user.instituteId];
    const filters = ["s.institute_id=$1"];
    if (req.user.role === "TEACHER") {
      values.push(req.user.userId);
      filters.push(`s.teacher_id=$${values.length}`);
    }
    if (req.query.date) {
      values.push(req.query.date);
      filters.push(`s.session_date=$${values.length}`);
    }
    if (req.query.batchId) {
      values.push(req.query.batchId);
      filters.push(`s.batch_id=$${values.length}`);
    }
    const result = await pool.query(
      `SELECT s.*,b.name AS batch_name,u.name AS teacher_name,
        COUNT(r.id)::int AS student_count,
        COUNT(r.id) FILTER (WHERE r.status='PRESENT')::int AS present_count,
        COUNT(r.id) FILTER (WHERE r.status='ABSENT')::int AS absent_count,
        COUNT(r.id) FILTER (WHERE r.status='LATE')::int AS late_count,
        COUNT(r.id) FILTER (WHERE r.status='LEAVE')::int AS leave_count
       FROM attendance_sessions s JOIN batches b ON b.id=s.batch_id
       LEFT JOIN users u ON u.id=s.teacher_id
       LEFT JOIN attendance_records r ON r.attendance_session_id=s.id
       WHERE ${filters.join(" AND ")}
       GROUP BY s.id,b.name,u.name ORDER BY s.session_date DESC,s.start_time DESC NULLS LAST`,
      values,
    );
    return res.json({ success: true, data: result.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Could not fetch attendance sessions" });
  }
}

async function getSession(req, res) {
  try {
    const session = await pool.query(
      `SELECT s.*,b.name AS batch_name,u.name AS teacher_name
       FROM attendance_sessions s JOIN batches b ON b.id=s.batch_id LEFT JOIN users u ON u.id=s.teacher_id
       WHERE s.id=$1 AND s.institute_id=$2 AND ($3<>'TEACHER' OR s.teacher_id=$4)`,
      [req.params.sessionId, req.user.instituteId, req.user.role, req.user.userId],
    );
    if (!session.rowCount) return res.status(404).json({ success: false, message: "Attendance session not found" });
    const students = await pool.query(
      `SELECT r.id AS record_id,r.student_id,r.status,r.marked_at,r.marked_by,r.remarks,
        u.name,s.admission_number
       FROM attendance_records r JOIN students s ON s.id=r.student_id LEFT JOIN users u ON u.id=s.user_id
       WHERE r.attendance_session_id=$1 ORDER BY u.name`,
      [req.params.sessionId],
    );
    return res.json({ success: true, data: { ...session.rows[0], students: students.rows } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Could not fetch attendance roster" });
  }
}

async function saveRecords(req, res) {
  const { records } = req.body;
  if (!Array.isArray(records) || !records.length || records.some((r) => !r.studentId || !ATTENDANCE_STATUSES.has(r.status))) {
    return res.status(400).json({ success: false, message: "Provide student records with a valid status" });
  }
  if (new Set(records.map((r) => r.studentId)).size !== records.length) {
    return res.status(400).json({ success: false, message: "Each student can appear only once per attendance save" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const session = await client.query(
      `SELECT id,status FROM attendance_sessions WHERE id=$1 AND institute_id=$2 AND ($3<>'TEACHER' OR teacher_id=$4) FOR UPDATE`,
      [req.params.sessionId, req.user.instituteId, req.user.role, req.user.userId],
    );
    if (!session.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Attendance session not found" });
    }
    if (session.rows[0].status === "CANCELLED") {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "Cancelled sessions cannot be edited" });
    }
    const studentIds = [...new Set(records.map((r) => r.studentId))];
    const roster = await client.query(
      "SELECT student_id FROM attendance_records WHERE attendance_session_id=$1 AND student_id=ANY($2::uuid[])",
      [req.params.sessionId, studentIds],
    );
    if (roster.rowCount !== studentIds.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "One or more students are not on this session roster" });
    }
    for (const record of records) {
      // Audit history is secondary to recording attendance. A savepoint allows
      // the attendance update to proceed if the audit insert fails.
      await client.query("SAVEPOINT attendance_audit");
      try {
        await client.query(
          `INSERT INTO attendance_audit_logs (attendance_record_id,old_status,new_status,changed_by,reason)
           SELECT id,status,$3,$4,$5 FROM attendance_records
           WHERE attendance_session_id=$1 AND student_id=$2 AND status<>$3`,
          [req.params.sessionId, record.studentId, record.status, req.user.userId, record.remarks || null],
        );
      } catch (auditError) {
        await client.query("ROLLBACK TO SAVEPOINT attendance_audit");
        console.error("Could not write attendance audit log:", auditError);
      } finally {
        await client.query("RELEASE SAVEPOINT attendance_audit");
      }
      await client.query(
        `UPDATE attendance_records SET status=$3,marked_at=CURRENT_TIMESTAMP,marked_by=$4,remarks=$5,updated_at=CURRENT_TIMESTAMP
         WHERE attendance_session_id=$1 AND student_id=$2`,
        [req.params.sessionId, record.studentId, record.status, req.user.userId, record.remarks || null],
      );
    }
    await client.query("COMMIT");
    return res.json({ success: true, message: "Attendance saved" });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Save attendance records failed:", e);
    return res.status(500).json({ success: false, message: "Could not save attendance" });
  } finally {
    client.release();
  }
}

async function updateSessionStatus(req, res) {
  const { status } = req.body;
  if (!SESSION_STATUSES.has(status)) return res.status(400).json({ success: false, message: "Invalid session status" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const session = await client.query(
      `SELECT id,status,session_date FROM attendance_sessions
       WHERE id=$1 AND institute_id=$2 AND ($3<>'TEACHER' OR teacher_id=$4) FOR UPDATE`,
      [req.params.sessionId, req.user.instituteId, req.user.role, req.user.userId],
    );
    if (!session.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Attendance session not found" });
    }
    const result = await client.query(
      "UPDATE attendance_sessions SET status=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING id,status",
      [status, req.params.sessionId],
    );
    if (status === "COMPLETED" && session.rows[0].status !== "COMPLETED") {
      await client.query(
        `INSERT INTO notifications (institute_id,title,message,type,created_by,recipient_user_id)
         SELECT DISTINCT s.institute_id,'Attendance marked absent',
           u.name || ' was marked absent on ' || $2::text,'ATTENDANCE',$3,p.user_id
         FROM attendance_records r JOIN students s ON s.id=r.student_id
         JOIN users u ON u.id=s.user_id JOIN parent_students ps ON ps.student_id=s.id
         JOIN parents p ON p.id=ps.parent_id
         WHERE r.attendance_session_id=$1 AND r.status='ABSENT'`,
        [req.params.sessionId, session.rows[0].session_date, req.user.userId],
      );
    }
    await client.query("COMMIT");
    return res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    return res.status(500).json({ success: false, message: "Could not update session" });
  } finally {
    client.release();
  }
}

async function getBatchReport(req, res) {
  try {
    const result = await pool.query(
      `SELECT s.id AS student_id,u.name,s.admission_number,
        COUNT(r.id) FILTER (WHERE a.status IN ('OPEN','COMPLETED') AND r.marked_at IS NOT NULL AND r.status<>'LEAVE')::int AS total_classes,
        COUNT(r.id) FILTER (WHERE a.status IN ('OPEN','COMPLETED') AND r.marked_at IS NOT NULL AND r.status='PRESENT')::int AS present,
        COUNT(r.id) FILTER (WHERE a.status IN ('OPEN','COMPLETED') AND r.marked_at IS NOT NULL AND r.status='ABSENT')::int AS absent,
        COUNT(r.id) FILTER (WHERE a.status IN ('OPEN','COMPLETED') AND r.marked_at IS NOT NULL AND r.status='LATE')::int AS late,
        COUNT(r.id) FILTER (WHERE a.status IN ('OPEN','COMPLETED') AND r.marked_at IS NOT NULL AND r.status='LEAVE')::int AS leave,
        COALESCE(ROUND(100.0*COUNT(r.id) FILTER (WHERE a.status IN ('OPEN','COMPLETED') AND r.marked_at IS NOT NULL AND r.status IN ('PRESENT','LATE')) / NULLIF(COUNT(r.id) FILTER (WHERE a.status IN ('OPEN','COMPLETED') AND r.marked_at IS NOT NULL AND r.status<>'LEAVE'),0),2),0) AS percentage
       FROM attendance_records r
       JOIN students s ON s.id=r.student_id
       LEFT JOIN users u ON u.id=s.user_id
       JOIN attendance_sessions a ON a.id=r.attendance_session_id
       WHERE a.batch_id=$1 AND a.institute_id=$2
         AND ($3<>'TEACHER' OR EXISTS (
           SELECT 1 FROM attendance_sessions own
           WHERE own.batch_id=$1 AND own.institute_id=$2 AND own.teacher_id=$4
         ))
       GROUP BY s.id,u.name,s.admission_number ORDER BY u.name`,
      [req.params.batchId, req.user.instituteId, req.user.role, req.user.userId],
    );
    return res.json({ success: true, data: result.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Could not fetch batch attendance report" });
  }
}

async function getStudentAttendance(req, res) {
  try {
    const result = await pool.query(
      `SELECT b.name AS batch_name,a.session_date,a.start_time,a.status AS session_status,r.status,r.remarks
       FROM students s JOIN attendance_records r ON r.student_id=s.id
       JOIN attendance_sessions a ON a.id=r.attendance_session_id JOIN batches b ON b.id=a.batch_id
       WHERE s.user_id=$1 AND a.status='COMPLETED'
       ORDER BY a.session_date DESC,a.start_time DESC NULLS LAST`,
      [req.user.userId],
    );
    const summary = result.rows.reduce((acc, row) => {
      if (row.session_status !== "COMPLETED") return acc;
      if (row.status === "LEAVE") acc.leave += 1;
      else {
        acc.totalClasses += 1;
        if (row.status === "PRESENT") acc.present += 1;
        if (row.status === "ABSENT") acc.absent += 1;
        if (row.status === "LATE") acc.late += 1;
      }
      return acc;
    }, { totalClasses: 0, present: 0, absent: 0, late: 0, leave: 0 });
    summary.percentage = summary.totalClasses ? Number(((summary.present + summary.late) * 100 / summary.totalClasses).toFixed(2)) : 0;
    return res.json({ success: true, data: { ...summary, recent: result.rows.slice(0, 30) } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Could not fetch student attendance" });
  }
}

async function getParentAttendance(req, res) {
  try {
    const result = await pool.query(
      `SELECT s.id AS student_id,u.name AS student_name,b.name AS batch_name,a.session_date,r.status
       FROM parents p JOIN parent_students ps ON ps.parent_id=p.id JOIN students s ON s.id=ps.student_id
       JOIN users u ON u.id=s.user_id JOIN attendance_records r ON r.student_id=s.id
       JOIN attendance_sessions a ON a.id=r.attendance_session_id JOIN batches b ON b.id=a.batch_id
       WHERE p.user_id=$1 AND a.status='COMPLETED' ORDER BY s.id,a.session_date DESC`,
      [req.user.userId],
    );
    const byStudent = new Map();
    for (const row of result.rows) {
      if (!byStudent.has(row.student_id)) byStudent.set(row.student_id, { studentId: row.student_id, studentName: row.student_name, totalClasses: 0, present: 0, absent: 0, late: 0, leave: 0, recent: [] });
      const summary = byStudent.get(row.student_id);
      summary.recent.push({ batch: row.batch_name, date: row.session_date, status: row.status });
      if (row.status === "LEAVE") summary.leave += 1;
      else {
        summary.totalClasses += 1;
        if (row.status === "PRESENT") summary.present += 1;
        if (row.status === "ABSENT") summary.absent += 1;
        if (row.status === "LATE") summary.late += 1;
      }
    }
    const data = [...byStudent.values()].map((summary) => ({
      ...summary,
      percentage: summary.totalClasses ? Number(((summary.present + summary.late) * 100 / summary.totalClasses).toFixed(2)) : 0,
      recent: summary.recent.slice(0, 30),
    }));
    return res.json({ success: true, data });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Could not fetch child attendance" });
  }
}

module.exports = { createSession, listSessions, getSession, saveRecords, updateSessionStatus, getBatchReport, getStudentAttendance, getParentAttendance };
