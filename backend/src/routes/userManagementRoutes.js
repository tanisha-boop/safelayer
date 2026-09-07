const express = require("express");

const controller = require("../controllers/userManagementController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");

const {
  userIdSchema,
  createUserSchema,
  updateUserSchema,
} = require("../validators/userManagementValidation");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  authorize("users:read"),
  controller.list
);

router.get(
  "/:id",
  authorize("users:read"),
  validate(userIdSchema),
  controller.getOne
);

router.post(
  "/",
  authorize("users:create"),
  validate(createUserSchema),
  controller.create
);

router.patch(
  "/:id",
  authorize("users:update"),
  validate(userIdSchema.merge(updateUserSchema)),
  controller.update
);

router.post(
  "/:id/deactivate",
  authorize("users:deactivate"),
  validate(userIdSchema),
  controller.deactivate
);

module.exports = router;
