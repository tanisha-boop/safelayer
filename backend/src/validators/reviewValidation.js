const { z } = require("zod");

const emptyObject = z.object({}).passthrough();

const reviewIdParams = z.object({
  id: z.coerce.number().int().positive(),
});

const listReviewsSchema = z.object({
  body: emptyObject,
  params: emptyObject,
  query: z.object({
    status: z.enum([
      "OPEN",
      "IN_REVIEW",
      "APPROVED",
      "REJECTED",
      "ESCALATED",
      "RESOLVED",
    ]).optional(),

    priority: z.enum([
      "LOW",
      "MEDIUM",
      "HIGH",
      "CRITICAL",
    ]).optional(),

    entityType: z.enum([
      "ACTIVITY",
      "INVOICE",
      "TRANSACTION",
    ]).optional(),

    page: z.coerce
      .number()
      .int()
      .positive()
      .default(1),

    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(100)
      .default(20),
  }),
});

const getReviewSchema = z.object({
  body: emptyObject,
  params: reviewIdParams,
  query: emptyObject,
});

const updateReviewSchema = z.object({
  body: z.object({
    status: z.enum([
      "IN_REVIEW",
      "APPROVED",
      "REJECTED",
      "ESCALATED",
      "RESOLVED",
    ]).optional(),

    assignedTo: z.coerce
      .number()
      .int()
      .positive()
      .nullable()
      .optional(),

    resolution: z.string()
      .trim()
      .max(2000)
      .nullable()
      .optional(),
  }).refine(
    (data) =>
      data.status !== undefined ||
      data.assignedTo !== undefined ||
      data.resolution !== undefined,
    {
      message: "At least one review field must be provided.",
    }
  ),

  params: reviewIdParams,
  query: emptyObject,
});

module.exports = {
  listReviewsSchema,
  getReviewSchema,
  updateReviewSchema,
};
