const pool = require("../../database/connection");


// ==========================================
// SUPER ADMIN DASHBOARD
// ==========================================

async function getDashboard(req, res) {
  try {
    const [
      institutesResult,
      activeInstitutesResult,
      studentsResult,
      teachersResult,
      subscriptionsResult,
      revenueResult,
    ] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::int AS count
        FROM institutes
      `),

      pool.query(`
        SELECT COUNT(*)::int AS count
        FROM institutes
        WHERE status = 'ACTIVE'
      `),

      pool.query(`
        SELECT COUNT(*)::int AS count
        FROM students
      `),

      pool.query(`
        SELECT COUNT(*)::int AS count
        FROM users
        WHERE role = 'TEACHER'
      `),

      pool.query(`
        SELECT COUNT(*)::int AS count
        FROM subscriptions
        WHERE status IN ('TRIAL', 'ACTIVE')
        AND end_date >= CURRENT_DATE
      `),

      pool.query(`
        SELECT COALESCE(SUM(amount), 0)::numeric AS revenue
        FROM subscriptions
        WHERE status = 'ACTIVE'
      `),
    ]);

    return res.json({
      success: true,
      data: {
        totalInstitutes:
          institutesResult.rows[0].count,

        activeInstitutes:
          activeInstitutesResult.rows[0].count,

        totalStudents:
          studentsResult.rows[0].count,

        totalTeachers:
          teachersResult.rows[0].count,

        activeSubscriptions:
          subscriptionsResult.rows[0].count,

        totalRevenue:
          Number(revenueResult.rows[0].revenue),
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard",
    });
  }
}


// ==========================================
// GET ALL INSTITUTES
// ==========================================

async function getInstitutes(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        i.id,
        i.name,
        i.email,
        i.phone,
        i.city,
        i.state,
        i.status,
        i.created_at,

        (
          SELECT COUNT(*)
          FROM students s
          WHERE s.institute_id = i.id
        )::int AS student_count,

        (
          SELECT COUNT(*)
          FROM users u
          WHERE u.institute_id = i.id
          AND u.role = 'TEACHER'
        )::int AS teacher_count,

        (
          SELECT sp.name
          FROM subscriptions s
          INNER JOIN subscription_plans sp
            ON sp.id = s.plan_id
          WHERE s.institute_id = i.id
          AND s.status IN ('TRIAL', 'ACTIVE')
          AND s.end_date >= CURRENT_DATE
          ORDER BY s.end_date DESC
          LIMIT 1
        ) AS plan_name

      FROM institutes i
      ORDER BY i.created_at DESC
    `);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch institutes",
    });
  }
}


// ==========================================
// GET SUBSCRIPTION PLANS
// ==========================================

async function getPlans(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        sp.*,

        (
          SELECT COUNT(*)
          FROM subscriptions s
          WHERE s.plan_id = sp.id
          AND s.status IN ('TRIAL', 'ACTIVE')
        )::int AS institute_count

      FROM subscription_plans sp
      ORDER BY sp.price ASC
    `);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch plans",
    });
  }
}


module.exports = {
  getDashboard,
  getInstitutes,
  getPlans,
};