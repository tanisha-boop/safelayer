const express = require("express");

const {
  register,
  login,
  me,
  logout,
} = require("../controllers/authController");

const authenticate = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");

const {
  authRateLimiter,
} = require("../middleware/rateLimiter");

const {
  registerSchema,
  loginSchema,
} = require("../validators/authValidation");

const router = express.Router();

router.post(
  "/register",
  authRateLimiter,
  validate(registerSchema),
  register
);

router.post(
  "/login",
  authRateLimiter,
  validate(loginSchema),
  login
);

router.get(
  "/me",
  authenticate,
  me
);

router.post(
  "/logout",
  authenticate,
  logout
);

module.exports = router;
