const express = require("express");
const validate = require("../middleware/validate");
const { loginSchema } = require("../validators/authValidation");
const { authRateLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.post(
  "/login",
  authRateLimiter,
  validate(loginSchema),
  (req, res) => {
    res.json({
      success: true,
      message: "Login route is connected",
      data: req.validated.body,
    });
  }
);

module.exports = router;