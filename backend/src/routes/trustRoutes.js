const express = require("express");

const authenticate =
  require("../middleware/authMiddleware");

const authorize =
  require("../middleware/authorize");

const validate =
  require("../middleware/validate");

const controller =
  require("../controllers/trustController");

const {
  activityTrustSchema,
} = require("../validators/trustValidation");

const router = express.Router();

router.use(authenticate);

router.get(
  "/activity/:activityId",
  authorize("activities:read"),
  validate(activityTrustSchema),
  controller.getLatestAssessment
);

router.post(
  "/activity/:activityId/assess",
  authorize("reviews:create"),
  validate(activityTrustSchema),
  controller.assessActivity
);

module.exports = router;
