const express = require("express");
const { auth } = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const c = require("../controllers/fees.controller");
const rateLimit = require("../middleware/rateLimit");

const router = express.Router();
router.get("/my", auth, allowRoles("STUDENT"), c.getMyFees);
router.post("/:feeId/submit", rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }), auth, allowRoles("STUDENT"), c.submitMyFeePayment);
router.get("/submissions/pending", auth, allowRoles("INSTITUTE_ADMIN"), c.getPendingStudentPayments);
router.patch("/submissions/:submissionId/approve", rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }), auth, allowRoles("INSTITUTE_ADMIN"), c.approveStudentPayment);
router.get("/summary", auth, allowRoles("INSTITUTE_ADMIN"), c.getFeeSummary);
router.get("/pending", auth, allowRoles("INSTITUTE_ADMIN"), c.getPendingFees);
router.get("/students/:studentId", auth, allowRoles("INSTITUTE_ADMIN"), c.getStudentFees);
router.patch("/:feeId/receive", rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }), auth, allowRoles("INSTITUTE_ADMIN"), c.receiveFee);
module.exports = router;
