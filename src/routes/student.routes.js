const express = require("express");

const { auth } = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

const {
  createStudent,
} = require("../controllers/student.controller");

const router = express.Router();

router.post(
  "/",
  auth,
  allowRoles("INSTITUTE_ADMIN"),
  createStudent
);

module.exports = router;