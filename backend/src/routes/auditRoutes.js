const express = require("express");

const router = express.Router();

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");

const auditController = require("../controllers/auditController");

const {
  listAuditSchema,
  auditIdSchema,
} = require("../validators/auditValidation");

router.use(authenticate);

router.get(
  "/",
  authorize("audit:read"),
  validate(listAuditSchema),
  auditController.list
);

router.get(
  "/:id",
  authorize("audit:read"),
  validate(auditIdSchema),
  auditController.getOne
);

module.exports = router;
