const express = require("express");

const controller =
  require("../controllers/routeProofController");

const authenticate =
  require("../middleware/authMiddleware");

const authorize =
  require("../middleware/authorize");

const validate =
  require("../middleware/validate");

const {
  activityIdSchema,
  checkInSchema,
  checkOutSchema,
  gpsUpdateSchema,
} = require("../validators/routeProofValidation");

const router = express.Router();

router.use(authenticate);

router.post(
  "/activity/:activityId/check-in",
  authorize("activities:update"),
  validate(checkInSchema),
  controller.checkIn
);

router.post(
  "/activity/:activityId/gps",
  authorize("activities:update"),
  validate(gpsUpdateSchema),
  controller.gpsUpdate
);

router.post(
  "/activity/:activityId/check-out",
  authorize("activities:update"),
  validate(checkOutSchema),
  controller.checkOut
);

router.get(
  "/activity/:activityId",
  authorize("activities:read"),
  validate(activityIdSchema),
  controller.getActivityRouteProof
);

module.exports = router;
