const pool = require("../../database/connection");

async function createCourse(req, res) {
    try {
        const instituteId =
            req.user.instituteId;

        const {
            name,
            description,
        } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Course name is required",
            });
        }

        const result = await pool.query(
            `
      INSERT INTO courses
      (
        institute_id,
        name,
        description
      )
      VALUES ($1,$2,$3)
      RETURNING *
      `,
            [
                instituteId,
                name,
                description || null,
            ]
        );

        return res.status(201).json({
            success: true,
            message:
                "Course created successfully",
            data: result.rows[0],
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to create course",
        });
    }
}


async function getCourses(req, res) {
    try {
        const result = await pool.query(
            `
      SELECT
        c.*,
        COUNT(b.id)::int AS batch_count

      FROM courses c

      LEFT JOIN batches b
        ON b.course_id = c.id

      WHERE c.institute_id = $1

      GROUP BY c.id

      ORDER BY c.created_at DESC
      `,
            [req.user.instituteId]
        );

        return res.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch courses",
        });
    }
}

module.exports = {
    createCourse,
    getCourses,
};