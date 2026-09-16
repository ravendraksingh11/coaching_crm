const express = require("express");

const auth = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

const {
    getInstituteDashboard,
} = require("../controllers/instituteDashboard.controller");

const router = express.Router();

router.get(
    "/",
    auth,
    allowRoles("INSTITUTE_ADMIN"),
    getInstituteDashboard
);

module.exports = router;