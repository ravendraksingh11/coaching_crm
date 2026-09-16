const pool = require("../../database/connection");

async function getInstituteDashboard(req, res) {
    try {
        const instituteId = req.user.instituteId;

        if (!instituteId) {
            return res.status(400).json({
                success: false,
                message: "Institute not found",
            });
        }

        const [
            students,
            teachers,
            parents,
            courses,
            batches,
            pendingFees,
            attendance,
            tests,
            subscription,
            recentStudents,
            recentPayments,
        ] = await Promise.all([

            pool.query(`
        SELECT COUNT(*)::int AS count
        FROM students
        WHERE institute_id = $1
      `, [instituteId]),

            pool.query(`
        SELECT COUNT(*)::int AS count
        FROM users
        WHERE institute_id = $1
        AND role = 'TEACHER'
      `, [instituteId]),

            pool.query(`
        SELECT COUNT(*)::int AS count
        FROM users
        WHERE institute_id = $1
        AND role = 'PARENT'
      `, [instituteId]),

            pool.query(`
        SELECT COUNT(*)::int AS count
        FROM courses
        WHERE institute_id = $1
      `, [instituteId]),

            pool.query(`
        SELECT COUNT(*)::int AS count
        FROM batches
        WHERE institute_id = $1
      `, [instituteId]),

            pool.query(`
        SELECT
          COALESCE(SUM(amount), 0)::numeric AS amount
        FROM fees
        WHERE institute_id = $1
        AND status IN ('PENDING', 'PARTIAL', 'OVERDUE')
      `, [instituteId]),

            pool.query(`
        SELECT
          COUNT(*) FILTER (
            WHERE status = 'PRESENT'
          )::int AS present,

          COUNT(*) FILTER (
            WHERE status = 'ABSENT'
          )::int AS absent,

          COUNT(*)::int AS total

        FROM attendance
        WHERE institute_id = $1
        AND date = CURRENT_DATE
      `, [instituteId]),

            pool.query(`
        SELECT COUNT(*)::int AS count
        FROM tests
        WHERE institute_id = $1
      `, [instituteId]),

            pool.query(`
        SELECT
          s.id,
          s.status,
          s.start_date,
          s.end_date,
          p.name AS plan_name,
          p.student_limit
        FROM subscriptions s
        INNER JOIN subscription_plans p
          ON p.id = s.plan_id
        WHERE s.institute_id = $1
        AND s.status IN ('TRIAL', 'ACTIVE')
        AND s.end_date >= CURRENT_DATE
        ORDER BY s.end_date DESC
        LIMIT 1
      `, [instituteId]),

            pool.query(`
        SELECT
          s.id,
          u.name,
          s.admission_number,
          s.created_at
        FROM students s
        INNER JOIN users u
          ON u.id = s.user_id
        WHERE s.institute_id = $1
        ORDER BY s.created_at DESC
        LIMIT 5
      `, [instituteId]),

            pool.query(`
        SELECT
          p.id,
          p.amount,
          p.payment_date,
          u.name AS student_name
        FROM payments p
        INNER JOIN users u
          ON u.id = p.student_user_id
        WHERE p.institute_id = $1
        ORDER BY p.payment_date DESC
        LIMIT 5
      `, [instituteId]),
        ]);

        const subscriptionData =
            subscription.rows[0] || null;

        return res.json({
            success: true,

            data: {
                stats: {
                    students: students.rows[0].count,
                    teachers: teachers.rows[0].count,
                    parents: parents.rows[0].count,
                    courses: courses.rows[0].count,
                    batches: batches.rows[0].count,
                    pendingFees: Number(
                        pendingFees.rows[0].amount
                    ),
                    tests: tests.rows[0].count,
                },

                attendance: {
                    present: attendance.rows[0].present,
                    absent: attendance.rows[0].absent,
                    total: attendance.rows[0].total,
                },

                subscription: subscriptionData,

                recentStudents:
                    recentStudents.rows,

                recentPayments:
                    recentPayments.rows,
            },
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message:
                "Failed to load institute dashboard",
        });
    }
}

module.exports = {
    getInstituteDashboard,
};