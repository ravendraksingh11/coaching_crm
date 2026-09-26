const pool = require("../../database/connection");

async function validCourse(courseId, instituteId) {
  if (!courseId) return true;
  const result = await pool.query(
    "SELECT id FROM courses WHERE id=$1 AND institute_id=$2",
    [courseId, instituteId],
  );
  return result.rowCount > 0;
}

async function createBatch(req, res) {
  const { name, courseId, startDate, endDate, startTime, endTime, roomNumber } =
    req.body;
  if (!name)
    return res
      .status(400)
      .json({ success: false, message: "Batch name is required" });
  try {
    if (!(await validCourse(courseId, req.user.instituteId)))
      return res
        .status(400)
        .json({ success: false, message: "Invalid course" });
    const result = await pool.query(
      `INSERT INTO batches (institute_id,course_id,name,start_date,end_date,start_time,end_time,room_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        req.user.instituteId,
        courseId || null,
        name,
        startDate || null,
        endDate || null,
        startTime || null,
        endTime || null,
        roomNumber || null,
      ],
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create batch" });
  }
}

async function getBatches(req, res) {
  try {
    const result = await pool.query(
      `SELECT b.*, c.name AS course_name, COUNT(e.id)::int AS student_count FROM batches b
       LEFT JOIN courses c ON c.id=b.course_id LEFT JOIN enrollments e ON e.batch_id=b.id AND e.status='ACTIVE'
       WHERE b.institute_id=$1 GROUP BY b.id,c.name ORDER BY b.created_at DESC`,
      [req.user.instituteId],
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch batches" });
  }
}

async function updateBatch(req, res) {
  const { name, courseId, startDate, endDate, startTime, endTime, roomNumber } =
    req.body;
  try {
    if (courseId && !(await validCourse(courseId, req.user.instituteId)))
      return res
        .status(400)
        .json({ success: false, message: "Invalid course" });
    const result = await pool.query(
      `UPDATE batches SET name=COALESCE($1,name), course_id=COALESCE($2,course_id), start_date=COALESCE($3,start_date),
       end_date=COALESCE($4,end_date), start_time=COALESCE($5,start_time), end_time=COALESCE($6,end_time), room_number=COALESCE($7,room_number), updated_at=CURRENT_TIMESTAMP
       WHERE id=$8 AND institute_id=$9 RETURNING *`,
      [
        name,
        courseId,
        startDate,
        endDate,
        startTime,
        endTime,
        roomNumber,
        req.params.id,
        req.user.instituteId,
      ],
    );
    if (!result.rowCount)
      return res
        .status(404)
        .json({ success: false, message: "Batch not found" });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update batch" });
  }
}

async function deleteBatch(req, res) {
  try {
    const result = await pool.query(
      "DELETE FROM batches WHERE id=$1 AND institute_id=$2 RETURNING id",
      [req.params.id, req.user.instituteId],
    );
    if (!result.rowCount)
      return res
        .status(404)
        .json({ success: false, message: "Batch not found" });
    return res.json({ success: true, message: "Batch deleted" });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete batch" });
  }
}

module.exports = { createBatch, getBatches, updateBatch, deleteBatch };
