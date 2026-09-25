const express = require("express");

const { auth } = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

const {
    createCourse,
    getCourses,
} = require("../controllers/course.controller");

const router = express.Router();

router.get(
    "/",
    auth,
    allowRoles("INSTITUTE_ADMIN"),
    getCourses
);

router.post(
    "/",
    auth,
    allowRoles("INSTITUTE_ADMIN"),
    createCourse
);

module.exports = router;