const express = require("express");

const router = express.Router();

const {
    auth,
    superAdminOnly,
} = require("../middleware/auth");

const pool = require("../../database/connection");

// ========================================
// GET ALL PLANS
// ========================================

router.get(
    "/",
    auth,
    async (req, res) => {
        try {
            const result = await pool.query(`
        SELECT *
        FROM plans
        ORDER BY created_at DESC
      `);

            res.json({
                success: true,
                data: result.rows,
            });
        } catch (error) {
            console.error(error);

            res.status(500).json({
                success: false,
                message: "Failed to fetch plans",
            });
        }
    }
);


// ========================================
// GET ACTIVE PLANS
// ========================================

router.get(
    "/active",
    auth,
    async (req, res) => {
        try {
            const result = await pool.query(`
        SELECT *
        FROM plans
        WHERE status = 'ACTIVE'
        ORDER BY price ASC
      `);

            res.json({
                success: true,
                data: result.rows,
            });
        } catch (error) {
            console.error(error);

            res.status(500).json({
                success: false,
                message: "Failed to fetch active plans",
            });
        }
    }
);


// ========================================
// GET SINGLE PLAN
// ========================================

router.get(
    "/:id",
    auth,
    async (req, res) => {
        try {
            const result = await pool.query(
                `
        SELECT *
        FROM plans
        WHERE id = $1
        `,
                [req.params.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Plan not found",
                });
            }

            res.json({
                success: true,
                data: result.rows[0],
            });
        } catch (error) {
            console.error(error);

            res.status(500).json({
                success: false,
                message: "Failed to fetch plan",
            });
        }
    }
);


// ========================================
// CREATE PLAN - SUPER ADMIN
// ========================================

router.post(
    "/",
    auth,
    superAdminOnly,
    async (req, res) => {
        try {
            const {
                name,
                description,
                price,
                duration_months,
                max_students,
                max_teachers,
                max_batches,
            } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: "Plan name is required",
                });
            }

            const result = await pool.query(
                `
        INSERT INTO plans (
          name,
          description,
          price,
          duration_months,
          max_students,
          max_teachers,
          max_batches,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          'ACTIVE'
        )
        RETURNING *
        `,
                [
                    name,
                    description || null,
                    price || 0,
                    duration_months || 1,
                    max_students || null,
                    max_teachers || null,
                    max_batches || null,
                ]
            );

            res.status(201).json({
                success: true,
                message: "Plan created successfully",
                data: result.rows[0],
            });
        } catch (error) {
            console.error(error);

            res.status(500).json({
                success: false,
                message: "Failed to create plan",
            });
        }
    }
);


// ========================================
// UPDATE PLAN - SUPER ADMIN
// ========================================

router.put(
    "/:id",
    auth,
    superAdminOnly,
    async (req, res) => {
        try {
            const {
                name,
                description,
                price,
                duration_months,
                max_students,
                max_teachers,
                max_batches,
            } = req.body;

            const result = await pool.query(
                `
        UPDATE plans
        SET
          name = $1,
          description = $2,
          price = $3,
          duration_months = $4,
          max_students = $5,
          max_teachers = $6,
          max_batches = $7,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
        RETURNING *
        `,
                [
                    name,
                    description || null,
                    price || 0,
                    duration_months || 1,
                    max_students || null,
                    max_teachers || null,
                    max_batches || null,
                    req.params.id,
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Plan not found",
                });
            }

            res.json({
                success: true,
                message: "Plan updated successfully",
                data: result.rows[0],
            });
        } catch (error) {
            console.error(error);

            res.status(500).json({
                success: false,
                message: "Failed to update plan",
            });
        }
    }
);


// ========================================
// ACTIVATE / DEACTIVATE PLAN
// ========================================

router.patch(
    "/:id/status",
    auth,
    superAdminOnly,
    async (req, res) => {
        try {
            const { status } = req.body;

            if (
                !["ACTIVE", "INACTIVE"].includes(status)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status",
                });
            }

            const result = await pool.query(
                `
        UPDATE plans
        SET
          status = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
        `,
                [
                    status,
                    req.params.id,
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Plan not found",
                });
            }

            res.json({
                success: true,
                message:
                    status === "ACTIVE"
                        ? "Plan activated successfully"
                        : "Plan deactivated successfully",
                data: result.rows[0],
            });
        } catch (error) {
            console.error(error);

            res.status(500).json({
                success: false,
                message: "Failed to update plan status",
            });
        }
    }
);


// ========================================
// DELETE PLAN
// ========================================

router.delete(
    "/:id",
    auth,
    superAdminOnly,
    async (req, res) => {
        try {
            const result = await pool.query(
                `
        DELETE FROM plans
        WHERE id = $1
        RETURNING id
        `,
                [req.params.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Plan not found",
                });
            }

            res.json({
                success: true,
                message: "Plan deleted successfully",
            });
        } catch (error) {
            console.error(error);

            res.status(500).json({
                success: false,
                message: "Failed to delete plan",
            });
        }
    }
);


module.exports = router;