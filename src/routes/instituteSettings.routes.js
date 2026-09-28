const express = require("express");
const { auth } = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const {
  getInstituteSettings,
  updateInstituteName,
  changeAdminPassword,
} = require("../controllers/instituteSettings.controller");

const router = express.Router();
const instituteAdmin = [auth, allowRoles("INSTITUTE_ADMIN")];

router.get("/", ...instituteAdmin, getInstituteSettings);
router.put("/name", ...instituteAdmin, updateInstituteName);
router.put("/password", ...instituteAdmin, changeAdminPassword);

module.exports = router;
