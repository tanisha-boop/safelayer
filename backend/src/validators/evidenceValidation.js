const { z } = require("zod");

const evidenceIdSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

const activityEvidenceSchema = z.object({
  params: z.object({
    activityId: z.coerce.number().int().positive(),
  }),
});

const verificationSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),

  body: z.object({
    verificationStatus: z.enum([
      "VERIFIED",
      "REJECTED",
    ]),

    verificationNotes: z
      .string()
      .trim()
      .max(5000)
      .optional(),
  }),
});

module.exports = {
  evidenceIdSchema,
  activityEvidenceSchema,
  verificationSchema,
};
