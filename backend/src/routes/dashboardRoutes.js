const express = require("express");

const dashboardController = require("../controllers/dashboardController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");

const router = express.Router();

router.use(authenticate);

router.get(
  "/overview",
  authorize("organization:read"),
  dashboardController.getOverview
);

module.exports = router;
