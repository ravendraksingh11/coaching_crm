const express = require("express");

const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

const {
  createStudent,
  getStudents,
} = require("../controllers/instituteStudent.controller");


const router = express.Router();

const instituteAdmin = [
  auth,
  allowRoles("INSTITUTE_ADMIN"),
];


// =========================
// STUDENTS
// =========================

router.get(
  "/students",
  ...instituteAdmin,
  getStudents
);

router.post(
  "/students",
  ...instituteAdmin,
  createStudent
);



module.exports = router;