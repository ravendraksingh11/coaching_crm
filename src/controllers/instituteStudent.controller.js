const bcrypt = require("bcryptjs");
const pool = require("../../database/connection");

async function createStudent(req, res) {
    const client = await pool.connect();

    try {
        const instituteId = req.user.instituteId;

        const {
            name,
            email,
            phone,
            password,
            admissionNumber,
            fatherName,
            motherName,
            dateOfBirth,
            batchId,
        } = req.body;

        if (!name || !email || !password || !admissionNumber) {
            return res.status(400).json({
                success: false,
                message:
                    "Name, email, password and admission number are required",
            });
        }

        await client.query("BEGIN");

        // Check duplicate email
        const existingUser = await client.query(
            `
      SELECT id
      FROM users
      WHERE email = $1
      `,
            [email]
        );

        if (existingUser.rows.length > 0) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                success: false,
                message: "Email already exists",
            });
        }

        // Check admission number
        const existingStudent = await client.query(
            `
      SELECT id
      FROM students
      WHERE institute_id = $1
      AND admission_number = $2
      `,
            [instituteId, admissionNumber]
        );

        if (existingStudent.rows.length > 0) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                success: false,
                message: "Admission number already exists",
            });
        }

        // Check batch belongs to same institute
        if (batchId) {
            const batch = await client.query(
                `
        SELECT id
        FROM batches
        WHERE id = $1
        AND institute_id = $2
        `,
                [batchId, instituteId]
            );

            if (batch.rows.length === 0) {
                await client.query("ROLLBACK");

                return res.status(400).json({
                    success: false,
                    message: "Invalid batch",
                });
            }
        }

        // Check subscription student limit
        const subscription = await client.query(
            `
      SELECT p.student_limit
      FROM subscriptions s
      INNER JOIN subscription_plans p
        ON p.id = s.plan_id
      WHERE s.institute_id = $1
      AND s.status IN ('TRIAL', 'ACTIVE')
      AND s.end_date >= CURRENT_DATE
      ORDER BY s.end_date DESC
      LIMIT 1
      `,
            [instituteId]
        );

        if (subscription.rows.length > 0) {
            const limit = subscription.rows[0].student_limit;

            const studentCount = await client.query(
                `
        SELECT COUNT(*)::INTEGER AS count
        FROM students
        WHERE institute_id = $1
        `,
                [instituteId]
            );

            if (studentCount.rows[0].count >= limit) {
                await client.query("ROLLBACK");

                return res.status(403).json({
                    success: false,
                    message: `Student limit of ${limit} reached for your subscription`,
                });
            }
        }

        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const userResult = await client.query(
            `
      INSERT INTO users (
        institute_id,
        name,
        email,
        phone,
        password_hash,
        role
      )
      VALUES ($1, $2, $3, $4, $5, 'STUDENT')
      RETURNING id, name, email, phone, role
      `,
            [
                instituteId,
                name,
                email,
                phone || null,
                passwordHash,
            ]
        );

        const user = userResult.rows[0];

        // Create student
        const studentResult = await client.query(
            `
      INSERT INTO students (
        institute_id,
        user_id,
        admission_number,
        father_name,
        mother_name,
        date_of_birth
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
            [
                instituteId,
                user.id,
                admissionNumber,
                fatherName || null,
                motherName || null,
                dateOfBirth || null,
            ]
        );

        const student = studentResult.rows[0];

        // Enroll student into batch
        if (batchId) {
            await client.query(
                `
        INSERT INTO enrollments (
          institute_id,
          student_id,
          batch_id
        )
        VALUES ($1, $2, $3)
        `,
                [
                    instituteId,
                    student.id,
                    batchId,
                ]
            );
        }

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            message: "Student created successfully",
            data: {
                student,
                user,
                batchId: batchId || null,
            },
        });
    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Create student error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create student",
        });
    } finally {
        client.release();
    }
}


async function getStudents(req, res) {
    try {
        const instituteId = req.user.instituteId;

        const result = await pool.query(
            `
      SELECT
        s.id,
        s.admission_number,
        s.father_name,
        s.mother_name,
        s.date_of_birth,
        s.created_at,

        u.name,
        u.email,
        u.phone,

        b.id AS batch_id,
        b.name AS batch_name,

        c.id AS course_id,
        c.name AS course_name

      FROM students s

      INNER JOIN users u
        ON u.id = s.user_id

      LEFT JOIN enrollments e
        ON e.student_id = s.id
        AND e.status = 'ACTIVE'

      LEFT JOIN batches b
        ON b.id = e.batch_id

      LEFT JOIN courses c
        ON c.id = b.course_id

      WHERE s.institute_id = $1

      ORDER BY s.created_at DESC
      `,
            [instituteId]
        );

        return res.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        console.error("Get students error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch students",
        });
    }
}


module.exports = {
    createStudent,
    getStudents,
};