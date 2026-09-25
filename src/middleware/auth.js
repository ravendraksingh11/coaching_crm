const jwt = require("jsonwebtoken");

function auth(req, res, next) {
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

    req.user = decoded;

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