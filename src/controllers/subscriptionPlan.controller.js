const pool = require("../../database/connection");

async function createSubscriptionPlan(req, res) {
  try {
    const {
      name,
      description,
      price,
      durationMonths,
      studentLimit,
      teacherLimit,
      features,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Plan name is required",
      });
    }

    if (!studentLimit) {
      return res.status(400).json({
        success: false,
        message: "Student limit is required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO subscription_plans
      (
        name,
        description,
        price,
        duration_months,
        student_limit,
        teacher_limit,
        features
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        name,
        description || null,
        price || 0,
        durationMonths || 1,
        studentLimit,
        teacherLimit || 10,
        features || {},
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Subscription plan created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create subscription plan",
    });
  }
}


async function getSubscriptionPlans(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM subscription_plans
      WHERE is_active = true
      ORDER BY price ASC
      `
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription plans",
    });
  }
}


module.exports = {
  createSubscriptionPlan,
  getSubscriptionPlans,
};