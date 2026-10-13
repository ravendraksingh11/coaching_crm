const express = require("express");

const { auth } = require("../middleware/auth");
const allowRoles = require("../middleware/roles");
const rateLimit = require("../middleware/rateLimit");
const {
  createEnquiry,
  getEnquiries,
  updateEnquiryContacted,
} = require("../controllers/enquiries.controller");

const router = express.Router();

router.post(
  "/",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Enquiry limit reached. Please try again in 15 minutes.",
  }),
  createEnquiry
);
router.get("/", auth, allowRoles("SUPER_ADMIN"), getEnquiries);
router.patch("/:id/contacted", auth, allowRoles("SUPER_ADMIN"), updateEnquiryContacted);

module.exports = router;
