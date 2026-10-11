const express = require("express");

const {
  login,
} = require("../controllers/auth.controller");
const rateLimit = require("../middleware/rateLimit");

const router = express.Router();

router.post("/login", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please try again in 15 minutes.",
}), login);

module.exports = router;
