const bcrypt = require("bcryptjs");
const pool = require("../../database/connection");

async function createTeacher(req, res) {
    const client = await pool.connect();

    try {
        const instituteId =
            req.user.instituteId;

        const {
            name,
            email,
            phone,
            password,
            qualification,
            specialization,
            joiningDate,
            salary,
        } = req.body;

        if (
            !name ||
            !email ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Name, email and password are required",
            });
        }

        await client.query("BEGIN");

        const existing =
            await client.query(
                `
        SELECT id
        FROM users
        WHERE email = $1
        `,
                [email]
            );

        if (existing.rows.length) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                success: false,
                message: "Email already exists",
            });
        }

        const passwordHash =
            await bcrypt.hash(
                password,
                10
            );

        const userResult =
            await client.query(
                `
        INSERT INTO users
        (
          institute_id,
          name,
          email,
          phone,
          password_hash,
          role,
          status
        )
        VALUES
        (
          $1,$2,$3,$4,$5,
          'TEACHER',
          'ACTIVE'
        )
        RETURNING
          id,
          name,
          email,
          phone,
          role,
          status
        `,
                [
                    instituteId,
                    name,
                    email,
                    phone || null,
                    passwordHash,
                ]
            );

        const user =
            userResult.rows[0];

        const teacherResult =
            await client.query(
                `
        INSERT INTO teachers
        (
          institute_id,
          user_id,
          qualification,
          specialization,
          joining_date,
          salary
        )
        VALUES
        ($1,$2,$3,$4,$5,$6)
        RETURNING *
        `,
                [
                    instituteId,
                    user.id,
                    qualification || null,
                    specialization || null,
                    joiningDate || null,
                    salary || null,
                ]
            );

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            message:
                "Teacher created successfully",
            data: {
                user,
                teacher:
                    teacherResult.rows[0],
            },
        });
    } catch (error) {
        await client.query("ROLLBACK");

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to create teacher",
        });
    } finally {
        client.release();
    }
}


async function getTeachers(req, res) {
    try {
        const instituteId =
            req.user.instituteId;

        const result = await pool.query(
            `
      SELECT
        t.id,
        t.qualification,
        t.specialization,
        t.joining_date,
        t.salary,

        u.id AS user_id,
        u.name,
        u.email,
        u.phone,
        u.status

      FROM teachers t

      INNER JOIN users u
        ON u.id = t.user_id

      WHERE t.institute_id = $1

      ORDER BY t.created_at DESC
      `,
            [instituteId]
        );

        return res.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch teachers",
        });
    }
}

module.exports = {
    createTeacher,
    getTeachers,
};