const pool = require("../../database/connection");

async function getChildrenPerformance(req, res) {
    try {
        const r = await pool.query(
            `SELECT s.id AS student_id,u.name AS student_name,t.id AS test_id,t.title,t.total_marks,t.result_declaration_date,
                CASE WHEN t.result_declaration_date IS NULL OR t.result_declaration_date <= CURRENT_DATE THEN tr.marks_obtained END AS marks_obtained,
                CASE WHEN t.result_declaration_date IS NULL OR t.result_declaration_date <= CURRENT_DATE THEN tr.percentage END AS percentage,
                tr.submitted_at,
                (tr.id IS NOT NULL AND (t.result_declaration_date IS NULL OR t.result_declaration_date <= CURRENT_DATE)) AS result_available
             FROM parents p
             JOIN parent_students ps ON ps.parent_id=p.id
             JOIN students s ON s.id=ps.student_id
             JOIN users u ON u.id=s.user_id
             LEFT JOIN test_results tr ON tr.student_id=s.id
             LEFT JOIN tests t ON t.id=tr.test_id
             WHERE p.user_id=$1
             ORDER BY tr.submitted_at DESC NULLS LAST`,
            [req.user.userId],
        );
        return res.json({ success: true, data: r.rows });
    } catch (e) {
        console.error(e);
        return res
            .status(500)
            .json({ success: false, message: "Failed to fetch child performance" });
    }
}
async function getNotifications(req, res) {
    try {
        const r = await pool.query(
            `SELECT n.* FROM notifications n JOIN parents p ON p.institute_id=n.institute_id WHERE p.user_id=$1 AND (n.recipient_user_id=$1 OR n.recipient_user_id IS NULL) ORDER BY n.created_at DESC`,
            [req.user.userId],
        );
        return res.json({ success: true, data: r.rows });
    } catch (e) {
        return res
            .status(500)
            .json({ success: false, message: "Failed to fetch notifications" });
    }
}
module.exports = { getChildrenPerformance, getNotifications };
