const express = require("express");

const authenticate =
  require("../middleware/authMiddleware");

const authorize =
  require("../middleware/authorize");

const validate =
  require("../middleware/validate");

const uploadEvidence =
  require("../middleware/uploadEvidence");

const controller =
  require("../controllers/complianceController");

const {
  createRequirementSchema,
  updateRequirementSchema,
  listRequirementsSchema,
  requirementIdSchema,
  uploadComplianceEvidenceSchema,
  evidenceIdSchema,
  verifyComplianceEvidenceSchema,
} = require("../validators/complianceValidation");

const router = express.Router();

router.use(authenticate);

router.post(
  "/requirements",
  authorize("compliance:create"),
  validate(createRequirementSchema),
  controller.create
);

router.get(
  "/requirements",
  authorize("compliance:read"),
  validate(listRequirementsSchema),
  controller.list
);

router.get(
  "/requirements/:id",
  authorize("compliance:read"),
  validate(requirementIdSchema),
  controller.getOne
);

router.patch(
  "/requirements/:id",
  authorize("compliance:update"),
  validate(updateRequirementSchema),
  controller.update
);

router.post(
  "/requirements/:id/evidence",
  authorize("compliance:create"),
  uploadEvidence.single("evidence"),
  validate(uploadComplianceEvidenceSchema),
  controller.uploadEvidence
);

router.get(
  "/requirements/:id/evidence",
  authorize("compliance:read"),
  validate(requirementIdSchema),
  controller.getEvidence
);

router.get(
  "/evidence/:id",
  authorize("compliance:read"),
  validate(evidenceIdSchema),
  controller.getEvidenceById
);

router.get(
  "/evidence/:id/file",
  authorize("compliance:read"),
  validate(evidenceIdSchema),
  controller.getEvidenceFile
);

router.patch(
  "/evidence/:id/verify",
  authorize("compliance:verify"),
  validate(verifyComplianceEvidenceSchema),
  controller.verifyEvidence
);

module.exports = router;