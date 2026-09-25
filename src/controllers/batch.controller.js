const pool = require("../../database/connection");

async function createBatch(req, res) {
  try {
    const instituteId = req.user.instituteId;

    const {
      name,
      courseId,
      startDate,
      endDate,
      startTime,
      endTime,
      roomNumber,
    } = req.body;

    if (!instituteId) {
      return res.status(400).json({
        success: false,
        message: "Institute not found",
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Batch name is required",
      });
    }

    // Verify course belongs to same institute
    if (courseId) {
      const course = await pool.query(
        `
        SELECT id
        FROM courses
        WHERE id = $1
        AND institute_id = $2
        `,
        [courseId, instituteId]
      );

      if (course.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid course",
        });
      }
    }

    const result = await pool.query(
      `
      INSERT INTO batches
      (
        institute_id,
        course_id,
        name,
        start_date,
        end_date,
        start_time,
        end_time,
        room_number
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
      `,
      [
        instituteId,
        courseId || null,
        name,
        startDate || null,
        endDate || null,
        startTime || null,
        endTime || null,
        roomNumber || null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Batch created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("createBatch error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create batch",
    });
  }
}


// ========================================
// GET ALL BATCHES
// ========================================
async function getBatches(req, res) {
  console.log("get batches")
  try {
    const instituteId = req.user.instituteId;

    if (!instituteId) {
      return res.status(400).json({
        success: false,
        message: "Institute not found",
      });
    }

    const result = await pool.query(
      `
      SELECT
        b.id,
        b.name,
        b.start_date,
        b.end_date,
        b.start_time,
        b.end_time,
        b.room_number,
        b.course_id,

        c.name AS course_name,

        COUNT(e.id)::int AS student_count

      FROM batches b

      LEFT JOIN courses c
        ON c.id = b.course_id
        AND c.institute_id = b.institute_id

      LEFT JOIN enrollments e
        ON e.batch_id = b.id
        AND e.institute_id = b.institute_id
        AND e.status = 'ACTIVE'

      WHERE b.institute_id = $1

      GROUP BY
        b.id,
        c.id,
        c.name

      ORDER BY b.created_at DESC
      `,
      [instituteId]
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("getBatches error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch batches",
    });
  }
}


module.exports = {
  createBatch,
  getBatches,
};