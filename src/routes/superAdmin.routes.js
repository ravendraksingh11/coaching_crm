const express = require("express");

const { auth } = require("../middleware/auth");
const allowRoles = require("../middleware/roles");

const {
  getDashboard,
  getInstitutes,
  getPlans,
} = require("../controllers/superAdmin.controller");
const {
  createInstitute, updateInstitute, setInstituteStatus, deleteInstitute,
  createPlan, updatePlan, deletePlan,
} = require("../controllers/adminManagement.controller");

const router = express.Router();

router.get(
  "/dashboard",
  auth,
  allowRoles("SUPER_ADMIN"),
  getDashboard
);

router.get(
  "/institutes",
  auth,
  allowRoles("SUPER_ADMIN"),
  getInstitutes
);

router.post("/institutes", auth, allowRoles("SUPER_ADMIN"), createInstitute);
router.put("/institutes/:id", auth, allowRoles("SUPER_ADMIN"), updateInstitute);
router.patch("/institutes/:id/status", auth, allowRoles("SUPER_ADMIN"), setInstituteStatus);
router.delete("/institutes/:id", auth, allowRoles("SUPER_ADMIN"), deleteInstitute);

router.get(
  "/plans",
  auth,
  allowRoles("SUPER_ADMIN", 'INSTITUTE_ADMIN'),
  getPlans
);

router.post("/plans", auth, allowRoles("SUPER_ADMIN"), createPlan);
router.put("/plans/:id", auth, allowRoles("SUPER_ADMIN"), updatePlan);
router.delete("/plans/:id", auth, allowRoles("SUPER_ADMIN"), deletePlan);

module.exports = router;
