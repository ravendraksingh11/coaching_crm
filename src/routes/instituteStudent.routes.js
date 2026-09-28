const express = require("express");

const { auth } = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

const {
    getStudents,
    getNextAdmissionNumber,
    updateStudent,
    deleteStudent,
} = require("../controllers/instituteStudent.controller");

const router = express.Router();

router.get("/admission-number/next", auth, allowRoles("INSTITUTE_ADMIN"), getNextAdmissionNumber);

router.get(
    "/",
    auth,
    allowRoles("INSTITUTE_ADMIN"),
    getStudents
);
router.put("/:id", auth, allowRoles("INSTITUTE_ADMIN"), updateStudent);
router.delete("/:id", auth, allowRoles("INSTITUTE_ADMIN"), deleteStudent);

module.exports = router;
