const express = require("express");

const activityController = require("../controllers/activityController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");

const {
  createActivitySchema,
  updateActivitySchema,
  activityIdSchema,
  completeActivitySchema,
} = require("../validators/activityValidation");

const router = express.Router();

router.use(authenticate);

router.post(
  "/",
  authorize("activities:create"),
  validate(createActivitySchema),
  activityController.create
);

router.get(
  "/",
  authorize("activities:read"),
  activityController.list
);

router.get(
  "/:id",
  authorize("activities:read"),
  validate(activityIdSchema),
  activityController.getOne
);

router.patch(
  "/:id",
  authorize("activities:update"),
  validate(activityIdSchema.merge(updateActivitySchema)),
  activityController.update
);

router.post(
  "/:id/start",
  authorize("activities:update"),
  validate(activityIdSchema),
  activityController.start
);

router.post(
  "/:id/complete",
  authorize("activities:update"),
  validate(completeActivitySchema),
  activityController.complete
);

router.post(
  "/:id/cancel",
  authorize("activities:update"),
  validate(activityIdSchema),
  activityController.cancel
);

module.exports = router;