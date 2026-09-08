const express = require("express");

const evidenceController =
  require("../controllers/evidenceController");

const authenticate =
  require("../middleware/authMiddleware");

const authorize =
  require("../middleware/authorize");

const validate =
  require("../middleware/validate");

const uploadEvidence =
  require("../middleware/uploadEvidence");

const {
  evidenceIdSchema,
  activityEvidenceSchema,
  verificationSchema,
} = require("../validators/evidenceValidation");

const router = express.Router();

router.use(authenticate);

router.post(
  "/activity/:activityId",
  authorize("evidence:create"),
  validate(activityEvidenceSchema),
  uploadEvidence.single("evidence"),
  evidenceController.upload
);

router.get(
  "/activity/:activityId",
  authorize("evidence:read"),
  validate(activityEvidenceSchema),
  evidenceController.getForActivity
);

router.get(
  "/:id",
  authorize("evidence:read"),
  validate(evidenceIdSchema),
  evidenceController.getOne
);

router.patch(
  "/:id/verify",
  authorize("reviews:create"),
  validate(verificationSchema),
  evidenceController.verify
);

module.exports = router;
