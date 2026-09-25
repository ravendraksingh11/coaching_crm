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
  updateCourse,
  deleteCourse,
} = require("../controllers/instituteCourse.controller");

const {
  createBatch,
  getBatches,
  updateBatch,
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
router.put("/courses/:id", ...instituteAdmin, updateCourse);

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
router.put("/batches/:id", ...instituteAdmin, updateBatch);

router.delete(
  "/batches/:id",
  ...instituteAdmin,
  deleteBatch
);


module.exports = router;
