const pool = require("../../database/connection");

async function assignSubscription(req, res) {
  const client = await pool.connect();

  try {
    const { instituteId } = req.params;

    const {
      planId,
      startDate,
    } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "Plan ID is required",
      });
    }

    await client.query("BEGIN");

    // Check institute
    const instituteResult =
      await client.query(
        `
        SELECT id, name
        FROM institutes
        WHERE id = $1
        `,
        [instituteId]
      );

    if (instituteResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Institute not found",
      });
    }

    // Check plan
    const planResult =
      await client.query(
        `
        SELECT *
        FROM subscription_plans
        WHERE id = $1
        AND is_active = true
        `,
        [planId]
      );

    if (planResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message:
          "Subscription plan not found",
      });
    }

    const plan = planResult.rows[0];

    // Expire previous subscriptions
    await client.query(
      `
      UPDATE subscriptions
      SET
        status = 'EXPIRED',
        updated_at = CURRENT_TIMESTAMP
      WHERE institute_id = $1
      AND status IN ('TRIAL', 'ACTIVE')
      `,
      [instituteId]
    );

    const subscriptionStart =
      startDate || new Date()
        .toISOString()
        .split("T")[0];

    // Calculate end date in PostgreSQL
    const subscriptionResult =
      await client.query(
        `
        INSERT INTO subscriptions
        (
          institute_id,
          plan_id,
          status,
          start_date,
          end_date,
          amount
        )
        VALUES
        (
          $1,
          $2,
          'ACTIVE',
          $3::date,
          (
            $3::date +
            ($4 || ' months')::interval
          )::date,
          $5
        )
        RETURNING *
        `,
        [
          instituteId,
          planId,
          subscriptionStart,
          plan.duration_months,
          plan.price,
        ]
      );

    // Update institute status
    await client.query(
      `
      UPDATE institutes
      SET
        status = 'ACTIVE',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [instituteId]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message:
        "Subscription assigned successfully",
      data: {
        subscription:
          subscriptionResult.rows[0],
        plan,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to assign subscription",
    });
  } finally {
    client.release();
  }
}

module.exports = {
  assignSubscription,
};