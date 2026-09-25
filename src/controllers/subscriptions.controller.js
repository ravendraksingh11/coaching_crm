const pool = require("../../database/connection");

// ========================================
// GET ALL SUBSCRIPTIONS - SUPER ADMIN
// ========================================

async function getAllSubscriptions(req, res) {
    try {
        const result = await pool.query(`
      SELECT
        s.id,
        s.institute_id,
        i.name AS institute_name,

        s.plan_id,
        p.name AS plan_name,
        p.price,

        s.start_date,
        s.end_date,

        s.status,
        s.payment_status,
        s.amount,
        s.activated_by,

        s.created_at

      FROM institute_subscriptions s

      JOIN institutes i
        ON i.id = s.institute_id

      JOIN plans p
        ON p.id = s.plan_id

      ORDER BY s.created_at DESC
    `);

        return res.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to get subscriptions",
        });
    }
}


// ========================================
// GET MY SUBSCRIPTION - INSTITUTE
// ========================================

async function getMySubscriptions(req, res) {
    try {
        const instituteId = req.user.instituteId;

        if (!instituteId) {
            return res.status(400).json({
                success: false,
                message: "Institute ID not found",
            });
        }

        const result = await pool.query(
            `
            SELECT
                s.id,
                s.institute_id,
                s.plan_id,

                p.name AS plan_name,
                p.description,
                p.price,
                p.duration_months,

                p.max_students,
                p.max_teachers,
                p.max_batches,

                s.start_date,
                s.end_date,

                s.status,
                s.payment_status,
                s.amount,
                s.activated_by,

                s.created_at

            FROM institute_subscriptions s

            JOIN subscription_plans p
                ON p.id = s.plan_id

            WHERE s.institute_id = $1
              AND s.status = 'ACTIVE'

            ORDER BY s.created_at DESC

            LIMIT 1
            `,
            [instituteId]
        );

        return res.json({
            success: true,
            data: result.rows[0] || null,
        });

    } catch (error) {

        console.error(
            "Get My Subscription Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to get subscription",
        });
    }
}

async function getMySubscription(req, res) {
    try {
        const instituteId = req.user.instituteId;

        if (!instituteId) {
            return res.status(400).json({
                success: false,
                message: "Institute ID not found",
            });
        }

        const result = await pool.query(
            `
            SELECT
                s.id AS subscription_id,

                s.institute_id,

                s.plan_id,

                p.name AS plan_name,
                p.description AS plan_description,
                p.price AS plan_price,
                p.duration_months,

                p.student_limit,
                p.teacher_limit,

                p.features,
                p.is_active AS plan_is_active,

                s.status,
                s.start_date,
                s.end_date,
                s.amount,

                s.created_at,
                s.updated_at

            FROM subscriptions s

            INNER JOIN subscription_plans p
                ON p.id = s.plan_id

            WHERE s.institute_id = $1

            ORDER BY s.created_at DESC
            `,
            [instituteId]
        );

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows,
        });

    } catch (error) {
        console.error("Get my subscriptions error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get subscriptions",
            error: error.message,
        });
    }
}


// ========================================
// SUPER ADMIN ACTIVATE PLAN
// ========================================

async function activateSubscriptionBySuperAdmin(req, res) {
    const client = await pool.connect();

    try {
        const {
            instituteId,
            planId,
            startDate,
        } = req.body;

        if (!instituteId || !planId) {
            return res.status(400).json({
                success: false,
                message: "Institute and plan are required",
            });
        }

        // Check institute
        const instituteResult = await client.query(
            `
      SELECT id
      FROM institutes
      WHERE id = $1
      `,
            [instituteId]
        );

        if (instituteResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Institute not found",
            });
        }

        // Check plan
        const planResult = await client.query(
            `
      SELECT *
      FROM plans
      WHERE id = $1
        AND status = 'ACTIVE'
      `,
            [planId]
        );

        if (planResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Active plan not found",
            });
        }

        const plan = planResult.rows[0];

        const start =
            startDate || new Date().toISOString().split("T")[0];

        // Calculate end date
        const endDateResult = await client.query(
            `
      SELECT
        ($1::date + ($2::int * INTERVAL '1 month'))::date
        AS end_date
      `,
            [start, plan.duration_months]
        );

        const endDate =
            endDateResult.rows[0].end_date;

        await client.query("BEGIN");

        // Deactivate previous active subscriptions
        await client.query(
            `
      UPDATE institute_subscriptions
      SET
        status = 'CANCELLED',
        updated_at = CURRENT_TIMESTAMP
      WHERE institute_id = $1
        AND status = 'ACTIVE'
      `,
            [instituteId]
        );

        // Create new subscription
        const subscriptionResult = await client.query(
            `
      INSERT INTO institute_subscriptions (
        institute_id,
        plan_id,
        start_date,
        end_date,
        status,
        payment_status,
        amount,
        activated_by
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'ACTIVE',
        'PAID',
        $5,
        'SUPER_ADMIN'
      )
      RETURNING *
      `,
            [
                instituteId,
                planId,
                start,
                endDate,
                plan.price,
            ]
        );

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            message: "Subscription activated successfully",
            data: subscriptionResult.rows[0],
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to activate subscription",
        });
    } finally {
        client.release();
    }
}


// ========================================
// INSTITUTE PURCHASE PLAN
// ========================================

async function purchaseSubscription(req, res) {
    const client = await pool.connect();

    try {
        const instituteId =
            req.user.instituteId;

        const {
            planId,
        } = req.body;

        if (!planId) {
            return res.status(400).json({
                success: false,
                message: "Plan is required",
            });
        }

        // Get active plan
        const planResult = await client.query(
            `
      SELECT *
      FROM plans
      WHERE id = $1
        AND status = 'ACTIVE'
      `,
            [planId]
        );

        if (planResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Plan is not available",
            });
        }

        const plan = planResult.rows[0];

        const start =
            new Date()
                .toISOString()
                .split("T")[0];

        const endDateResult = await client.query(
            `
      SELECT
        ($1::date + ($2::int * INTERVAL '1 month'))::date
        AS end_date
      `,
            [
                start,
                plan.duration_months,
            ]
        );

        const endDate =
            endDateResult.rows[0].end_date;

        await client.query("BEGIN");

        // Cancel previous active subscription
        await client.query(
            `
      UPDATE institute_subscriptions
      SET
        status = 'CANCELLED',
        updated_at = CURRENT_TIMESTAMP

      WHERE institute_id = $1
        AND status = 'ACTIVE'
      `,
            [instituteId]
        );

        /*
          IMPORTANT:
    
          In production, do NOT directly mark
          the payment as PAID here.
    
          This endpoint should normally create
          a PENDING subscription and open Razorpay/
          Stripe checkout.
    
          For development/testing we are marking
          it PAID.
        */

        const subscriptionResult =
            await client.query(
                `
        INSERT INTO institute_subscriptions (
          institute_id,
          plan_id,
          start_date,
          end_date,
          status,
          payment_status,
          amount,
          activated_by
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          'ACTIVE',
          'PAID',
          $5,
          'INSTITUTE'
        )
        RETURNING *
        `,
                [
                    instituteId,
                    planId,
                    start,
                    endDate,
                    plan.price,
                ]
            );

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            message: "Plan purchased successfully",
            data: subscriptionResult.rows[0],
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to purchase subscription",
        });
    } finally {
        client.release();
    }
}


module.exports = {
    getAllSubscriptions,
    getMySubscription,
    activateSubscriptionBySuperAdmin,
    purchaseSubscription,
};