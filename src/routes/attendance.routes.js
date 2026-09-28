const express = require("express");
const { auth } = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const c = require("../controllers/attendance.controller");

const router = express.Router();
const staff = ["INSTITUTE_ADMIN", "TEACHER"];

router.post("/sessions", auth, allowRoles(...staff), c.createSession);
router.get("/sessions", auth, allowRoles(...staff), c.listSessions);
router.get("/sessions/:sessionId", auth, allowRoles(...staff), c.getSession);
router.put("/sessions/:sessionId/records", auth, allowRoles(...staff), c.saveRecords);
router.patch("/sessions/:sessionId/status", auth, allowRoles(...staff), c.updateSessionStatus);
router.get("/reports/batches/:batchId", auth, allowRoles(...staff), c.getBatchReport);
router.get("/student/me", auth, allowRoles("STUDENT"), c.getStudentAttendance);
router.get("/parents/children", auth, allowRoles("PARENT"), c.getParentAttendance);

module.exports = router;
