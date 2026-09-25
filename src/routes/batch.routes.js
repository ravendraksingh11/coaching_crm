const express = require("express");

const { auth } = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

const {
  createBatch, getBatches
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

router.get(
  "/",
  auth,
  allowRoles(
    "INSTITUTE_ADMIN",
    "TEACHER"
  ),
  getBatches
);

module.exports = router;