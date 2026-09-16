const express = require("express");

const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

const {
    createTeacher,
    getTeachers,
} = require("../controllers/teacher.controller");

const router = express.Router();

router.get(
    "/",
    auth,
    allowRoles("INSTITUTE_ADMIN"),
    getTeachers
);

router.post(
    "/",
    auth,
    allowRoles("INSTITUTE_ADMIN"),
    createTeacher
);


module.exports = router;