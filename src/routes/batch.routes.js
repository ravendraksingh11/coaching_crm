const express = require("express");

const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

const {
  createBatch,
} = require("../controllers/batch.controller");

const router = express.Router();

router.post(
  "/",
  auth,
  allowRoles(
    "INSTITUTE_ADMIN",
    "TEACHER"
  ),
  createBatch
);

module.exports = router;