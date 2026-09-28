const bcrypt = require("bcryptjs");
const pool = require("../../database/connection");

async function getInstituteSettings(req, res) {
  try {
    const result = await pool.query(
      "SELECT name FROM institutes WHERE id = $1",
      [req.user.instituteId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: "Institute not found" });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Load institute settings error:", error);
    return res.status(500).json({ success: false, message: "Could not load institute settings" });
  }
}

async function updateInstituteName(req, res) {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    return res.status(400).json({ success: false, message: "Institute name is required" });
  }
  if (name.length > 255) {
    return res.status(400).json({ success: false, message: "Institute name must be 255 characters or fewer" });
  }

  try {
    const result = await pool.query(
      "UPDATE institutes SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING name",
      [name, req.user.instituteId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: "Institute not found" });
    }
    return res.json({ success: true, message: "Institute name updated", data: result.rows[0] });
  } catch (error) {
    console.error("Update institute name error:", error);
    return res.status(500).json({ success: false, message: "Could not update institute name" });
  }
}

async function changeAdminPassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (typeof currentPassword !== "string" || !currentPassword || typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ success: false, message: "Current password and a new password of at least 8 characters are required" });
  }

  try {
    const userResult = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1 AND institute_id = $2 AND role = 'INSTITUTE_ADMIN'",
      [req.user.userId, req.user.instituteId]
    );
    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ success: false, message: "Institute administrator not found" });
    }

    const currentPasswordMatches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!currentPasswordMatches) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND institute_id = $3",
      [passwordHash, req.user.userId, req.user.instituteId]
    );

    return res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Change institute admin password error:", error);
    return res.status(500).json({ success: false, message: "Could not change password" });
  }
}

module.exports = { getInstituteSettings, updateInstituteName, changeAdminPassword };
