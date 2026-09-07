const express = require("express");

const organizationController = require("../controllers/organizationController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");

const {
  updateOrganizationSchema,
} = require("../validators/organizationValidation");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  authorize("organization:read"),
  organizationController.get
);

router.patch(
  "/",
  authorize("organization:update"),
  validate(updateOrganizationSchema),
  organizationController.update
);

module.exports = router;
