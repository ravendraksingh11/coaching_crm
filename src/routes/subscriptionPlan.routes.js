const express = require("express");

const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

const {
  createSubscriptionPlan,
  getSubscriptionPlans,
} = require("../controllers/subscriptionPlan.controller");

const router = express.Router();

router.post(
  "/",
  auth,
  allowRoles("SUPER_ADMIN"),
  createSubscriptionPlan
);

router.get(
  "/",
  auth,
  allowRoles(
    "SUPER_ADMIN",
    "INSTITUTE_ADMIN"
  ),
  getSubscriptionPlans
);

module.exports = router;