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
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create batch",
    });
  }
}

module.exports = {
  createBatch,
};