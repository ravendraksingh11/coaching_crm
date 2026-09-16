const express = require("express");

const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

const {
  assignSubscription,
} = require("../controllers/subscription.controller");

const router = express.Router();

router.post(
  "/institutes/:instituteId",
  auth,
  allowRoles("SUPER_ADMIN"),
  assignSubscription
);

module.exports = router;