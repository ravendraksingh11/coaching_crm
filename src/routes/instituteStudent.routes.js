const express = require("express");

const { auth } = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

const {
    getStudents,
} = require("../controllers/instituteStudent.controller");

const router = express.Router();

router.get(
    "/",
    auth,
    allowRoles("INSTITUTE_ADMIN"),
    getStudents
);

module.exports = router;