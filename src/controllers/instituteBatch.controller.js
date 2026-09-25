const pool = require("../../database/connection");


async function createBatch(req, res) {
    try {
        const instituteId = req.user.instituteId;

        const {
            name,
            courseId,
            startDate,
            endDate,
            capacity,
            timing,
        } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Batch name is required",
            });
        }

        // Validate course belongs to institute
        if (courseId) {
            const courseResult = await pool.query(
                `
        SELECT id
        FROM courses
        WHERE id = $1
        AND institute_id = $2
        `,
                [courseId, instituteId]
            );

            if (courseResult.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid course",
                });
            }
        }

        const result = await pool.query(
            `
      INSERT INTO batches (
        institute_id,
        course_id,
        name,
        start_date,
        end_date,
        capacity,
        timing
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
            [
                instituteId,
                courseId || null,
                name,
                startDate || null,
                endDate || null,
                capacity || null,
                timing || null,
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Batch created successfully",
            data: result.rows[0],
        });
    } catch (error) {
        console.error("Create batch error:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "Batch already exists",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to create batch",
        });
    }
}


async function getBatches(req, res) {
    try {
        const instituteId = req.user.instituteId;

        const result = await pool.query(
            `
      SELECT
        b.id,
        b.name,
        b.start_date,
        b.end_date,
        b.capacity,
        b.timing,
        b.status,
        b.created_at,

        c.id AS course_id,
        c.name AS course_name,

        COUNT(DISTINCT e.student_id)::INTEGER AS student_count

      FROM batches b

      LEFT JOIN courses c
        ON c.id = b.course_id

      LEFT JOIN enrollments e
        ON e.batch_id = b.id
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

        return res.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        console.error("Get batches error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch batches",
        });
    }
}


async function deleteBatch(req, res) {
    try {
        const instituteId = req.user.instituteId;
        const { id } = req.params;

        const result = await pool.query(
            `
      DELETE FROM batches
      WHERE id = $1
      AND institute_id = $2
      RETURNING id
      `,
            [id, instituteId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Batch not found",
            });
        }

        return res.json({
            success: true,
            message: "Batch deleted successfully",
        });
    } catch (error) {
        console.error("Delete batch error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete batch",
        });
    }
}


module.exports = {
    createBatch,
    getBatches,
    deleteBatch,
};