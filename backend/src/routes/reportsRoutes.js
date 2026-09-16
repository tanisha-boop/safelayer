const express = require("express");

const reportsController = require("../controllers/reportsController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");

const router = express.Router();

router.use(authenticate);

router.get(
  "/overview",
  authorize("organization:read"),
  reportsController.getOverview
);

module.exports = router;
