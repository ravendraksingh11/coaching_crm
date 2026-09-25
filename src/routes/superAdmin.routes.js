const express = require("express");

const { auth } = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

const {
  getDashboard,
  getInstitutes,
  getPlans,
} = require("../controllers/superAdmin.controller");

const router = express.Router();

router.get(
  "/dashboard",
  auth,
  allowRoles("SUPER_ADMIN"),
  getDashboard
);

router.get(
  "/institutes",
  auth,
  allowRoles("SUPER_ADMIN"),
  getInstitutes
);

router.get(
  "/plans",
  auth,
  allowRoles("SUPER_ADMIN", 'INSTITUTE_ADMIN'),
  getPlans
);

module.exports = router;