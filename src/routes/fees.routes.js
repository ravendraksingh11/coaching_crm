const express = require("express");
const { auth } = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const c = require("../controllers/fees.controller");

const router = express.Router();
router.get("/my", auth, allowRoles("STUDENT"), c.getMyFees);
router.post("/:feeId/submit", auth, allowRoles("STUDENT"), c.submitMyFeePayment);
router.get("/submissions/pending", auth, allowRoles("INSTITUTE_ADMIN"), c.getPendingStudentPayments);
router.patch("/submissions/:submissionId/approve", auth, allowRoles("INSTITUTE_ADMIN"), c.approveStudentPayment);
router.get("/summary", auth, allowRoles("INSTITUTE_ADMIN"), c.getFeeSummary);
router.get("/pending", auth, allowRoles("INSTITUTE_ADMIN"), c.getPendingFees);
router.get("/students/:studentId", auth, allowRoles("INSTITUTE_ADMIN"), c.getStudentFees);
router.patch("/:feeId/receive", auth, allowRoles("INSTITUTE_ADMIN"), c.receiveFee);
module.exports = router;
