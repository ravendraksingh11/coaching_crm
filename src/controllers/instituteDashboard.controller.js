const pool = require("../../database/connection");
const { generateDueMonthlyFees } = require("../services/fees.service");

async function getInstituteDashboard(req, res) {
    try {
        const instituteId = req.user.instituteId;

        if (!instituteId) {
            return res.status(400).json({
                success: false,
                message: "Institute not found",
            });
        }

        await generateDueMonthlyFees(pool, instituteId);

        const [
            students,
            teachers,
            parents,
            courses,
            batches,
            pendingFees,
            feeSummary,
            oneTimePendingFees,
            monthlyPendingFees,
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
          COALESCE(SUM(amount-paid_amount), 0)::numeric AS amount
        FROM fees
        WHERE institute_id = $1
        AND paid_amount < amount
      `, [instituteId]),

            pool.query(`
        SELECT fee_frequency,
          COUNT(*) FILTER (WHERE paid_amount<amount)::int AS pending_count,
          COALESCE(SUM(amount-paid_amount) FILTER (WHERE paid_amount<amount),0)::numeric AS pending_amount,
          COALESCE(SUM(paid_amount),0)::numeric AS received_amount,
          COUNT(*) FILTER (WHERE due_date<CURRENT_DATE AND paid_amount<amount)::int AS overdue_count
        FROM fees WHERE institute_id=$1 GROUP BY fee_frequency
      `, [instituteId]),

            pool.query(`
        SELECT f.id AS fee_id,s.id AS student_id,s.admission_number,u.name AS student_name,
          b.name AS batch_name,f.amount,f.paid_amount,(f.amount-f.paid_amount) AS balance,f.due_date
        FROM fees f JOIN students s ON s.id=f.student_id JOIN users u ON u.id=s.user_id
        LEFT JOIN batches b ON b.id=s.fee_batch_id
        WHERE f.institute_id=$1 AND f.fee_frequency='ONE_TIME' AND f.paid_amount<f.amount
        ORDER BY f.due_date ASC NULLS LAST,u.name LIMIT 10
      `, [instituteId]),

            pool.query(`
        SELECT f.id AS fee_id,s.id AS student_id,s.admission_number,u.name AS student_name,
          b.name AS batch_name,f.amount,f.paid_amount,(f.amount-f.paid_amount) AS balance,f.due_date
        FROM fees f JOIN students s ON s.id=f.student_id JOIN users u ON u.id=s.user_id
        LEFT JOIN batches b ON b.id=s.fee_batch_id
        WHERE f.institute_id=$1 AND f.fee_frequency='MONTHLY' AND f.paid_amount<f.amount
        ORDER BY f.due_date ASC NULLS LAST,u.name LIMIT 10
      `, [instituteId]),

            pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE r.status = 'PRESENT')::int AS present,
          COUNT(*) FILTER (WHERE r.status = 'ABSENT')::int AS absent,
          COUNT(r.id)::int AS total
        FROM attendance_sessions s
        LEFT JOIN attendance_records r ON r.attendance_session_id=s.id
        WHERE s.institute_id = $1
        AND s.session_date = CURRENT_DATE
        AND s.status = 'COMPLETED'
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

                fees: {
                    summary: feeSummary.rows.reduce((acc, row) => {
                        acc[row.fee_frequency] = {
                            pendingCount: row.pending_count,
                            pendingAmount: Number(row.pending_amount),
                            receivedAmount: Number(row.received_amount),
                            overdueCount: row.overdue_count,
                        };
                        return acc;
                    }, {
                        ONE_TIME: { pendingCount: 0, pendingAmount: 0, receivedAmount: 0, overdueCount: 0 },
                        MONTHLY: { pendingCount: 0, pendingAmount: 0, receivedAmount: 0, overdueCount: 0 },
                    }),
                    oneTimePending: oneTimePendingFees.rows,
                    monthlyPending: monthlyPendingFees.rows,
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
