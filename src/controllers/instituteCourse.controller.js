const pool = require("../../database/connection");


async function createCourse(req, res) {
    try {
        const instituteId = req.user.instituteId;

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
      INSERT INTO courses (
        institute_id,
        name,
        description
      )
      VALUES ($1, $2, $3)
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
            message: "Course created successfully",
            data: result.rows[0],
        });
    } catch (error) {
        console.error("Create course error:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "Course already exists",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to create course",
        });
    }
}


async function getCourses(req, res) {
    try {
        const instituteId = req.user.instituteId;

        const result = await pool.query(
            `
      SELECT
        c.id,
        c.name,
        c.description,
        c.created_at,

        COUNT(DISTINCT b.id)::INTEGER AS batch_count

      FROM courses c

      LEFT JOIN batches b
        ON b.course_id = c.id

      WHERE c.institute_id = $1

      GROUP BY c.id

      ORDER BY c.created_at DESC
      `,
            [instituteId]
        );

        return res.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        console.error("Get courses error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch courses",
        });
    }
}


async function deleteCourse(req, res) {
    try {
        const instituteId = req.user.instituteId;
        const { id } = req.params;

        const result = await pool.query(
            `
      DELETE FROM courses
      WHERE id = $1
      AND institute_id = $2
      RETURNING id
      `,
            [id, instituteId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Course not found",
            });
        }

        return res.json({
            success: true,
            message: "Course deleted successfully",
        });
    } catch (error) {
        console.error("Delete course error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete course",
        });
    }
}

async function updateCourse(req, res) {
    try {
        const { name, description } = req.body;
        const result = await pool.query(
            `UPDATE courses SET name = COALESCE($1, name), description = COALESCE($2, description),
             updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND institute_id = $4 RETURNING *`,
            [name, description, req.params.id, req.user.instituteId]
        );
        if (!result.rowCount) return res.status(404).json({ success: false, message: "Course not found" });
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) { console.error(error); return res.status(500).json({ success: false, message: "Failed to update course" }); }
}


module.exports = {
    createCourse,
    getCourses,
    updateCourse,
    deleteCourse,
};
