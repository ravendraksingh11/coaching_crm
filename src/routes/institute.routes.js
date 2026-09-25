const express = require("express");

const { auth } = require("../middleware/auth");
const allowRoles = require("../middleware/allowRoles");

const {
  createStudent,
  getStudents,
} = require("../controllers/instituteStudent.controller");

const {
  createCourse,
  getCourses,
  deleteCourse,
} = require("../controllers/instituteCourse.controller");

const {
  createBatch,
  getBatches,
  deleteBatch,
} = require("../controllers/instituteBatch.controller");

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


// =========================
// COURSES
// =========================

router.get(
  "/courses",
  ...instituteAdmin,
  getCourses
);

router.post(
  "/courses",
  ...instituteAdmin,
  createCourse
);

router.delete(
  "/courses/:id",
  ...instituteAdmin,
  deleteCourse
);


// =========================
// BATCHES
// =========================

router.get(
  "/batches",
  ...instituteAdmin,
  getBatches
);

router.post(
  "/batches",
  ...instituteAdmin,
  createBatch
);

router.delete(
  "/batches/:id",
  ...instituteAdmin,
  deleteBatch
);


module.exports = router;