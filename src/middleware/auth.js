const jwt = require("jsonwebtoken");
const pool = require("../../database/connection");

async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization token is required",
      });
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : authHeader;

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const userResult = await pool.query(
      `SELECT u.id,u.role,u.status,u.institute_id,i.status AS institute_status
       FROM users u LEFT JOIN institutes i ON i.id=u.institute_id WHERE u.id=$1`,
      [decoded.userId]
    );
    const user = userResult.rows[0];
    if (!user || user.status !== "ACTIVE") return res.status(403).json({ success: false, message: "User account is not active" });
    if (user.institute_id && !["TRIAL", "ACTIVE"].includes(user.institute_status)) {
      return res.status(403).json({ success: false, message: "Institute access is blocked or expired" });
    }
    req.user = { userId: user.id, role: user.role, instituteId: user.institute_id };

    next();
  } catch (error) {
    console.error(error);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}

function superAdminOnly(req, res, next) {
  if (req.user?.role !== "SUPER_ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Super admin access required",
    });
  }

  next();
}

function instituteAdminOnly(req, res, next) {
  if (req.user?.role !== "INSTITUTE_ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Institute admin access required",
    });
  }

  next();
}

module.exports = {
  auth,
  superAdminOnly,
  instituteAdminOnly,
};
