const express = require("express");
const { auth } = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const c = require("../controllers/fees.controller");

const router = express.Router();
router.get("/summary", auth, allowRoles("INSTITUTE_ADMIN"), c.getFeeSummary);
router.get("/pending", auth, allowRoles("INSTITUTE_ADMIN"), c.getPendingFees);
router.get("/students/:studentId", auth, allowRoles("INSTITUTE_ADMIN"), c.getStudentFees);
router.patch("/:feeId/receive", auth, allowRoles("INSTITUTE_ADMIN"), c.receiveFee);
module.exports = router;
