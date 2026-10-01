const { z } = require("zod");

const emptyObject = z.object({}).passthrough();

const requirementIdParams = z.object({
  id: z.coerce.number().int().positive(),
});

const evidenceIdParams = z.object({
  id: z.coerce.number().int().positive(),
});

const createRequirementSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(255),
    requirementType: z.string().trim().min(2).max(100),
    description: z.string().trim().max(5000).optional(),
    responsibleUserId: z.coerce.number().int().positive().optional(),
    expiryDate: z.string().date().optional(),
  }),
  params: emptyObject,
  query: emptyObject,
});

const updateRequirementSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(255).optional(),
    requirementType: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    responsibleUserId: z.coerce.number().int().positive().nullable().optional(),
    expiryDate: z.string().date().nullable().optional(),
  }),
  params: requirementIdParams,
  query: emptyObject,
});

const listRequirementsSchema = z.object({
  body: emptyObject,
  params: emptyObject,
  query: z.object({
    status: z
      .enum([
        "ACTIVE",
        "EXPIRING_SOON",
        "EXPIRED",
        "PENDING",
      ])
      .optional(),

    requirementType: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional(),

    search: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .optional(),
  }).passthrough(),
});

const requirementIdSchema = z.object({
  body: emptyObject,
  params: requirementIdParams,
  query: emptyObject,
});

const uploadComplianceEvidenceSchema = z.object({
  body: z.object({
    documentDate: z.string().date().optional(),
    expiryDate: z.string().date().optional(),
  }),
  params: requirementIdParams,
  query: emptyObject,
});

const evidenceIdSchema = z.object({
  body: emptyObject,
  params: evidenceIdParams,
  query: emptyObject,
});

const verifyComplianceEvidenceSchema = z.object({
  body: z.object({
    verificationStatus: z.enum([
      "VERIFIED",
      "REJECTED",
    ]),
    verificationNotes: z
      .string()
      .trim()
      .max(2000)
      .optional(),
  }),
  params: evidenceIdParams,
  query: emptyObject,
});

module.exports = {
  createRequirementSchema,
  updateRequirementSchema,
  listRequirementsSchema,
  requirementIdSchema,
  uploadComplianceEvidenceSchema,
  evidenceIdSchema,
  verifyComplianceEvidenceSchema,
};