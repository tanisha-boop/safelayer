const { z } = require("zod");

const emptyObject = z.object({}).passthrough();

const collectionParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const remittanceParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createCollectionSchema = z.object({
  body: z.object({
    activityId: z.coerce.number().int().positive(),
    collectorId: z.coerce.number().int().positive(),
    referenceNumber: z.string().trim().min(3).max(100),
    expectedAmount: z.coerce.number().positive().max(999999999.99),
    notes: z.string().trim().max(2000).optional(),
  }),
  params: emptyObject,
  query: emptyObject,
});

const collectPaymentSchema = z.object({
  body: z.object({
    collectedAmount: z.coerce.number().nonnegative().max(999999999.99),
    collectedAt: z.string().datetime().optional(),
    notes: z.string().trim().max(2000).optional(),
  }),
  params: collectionParamsSchema,
  query: emptyObject,
});

const createRemittanceSchema = z.object({
  body: z.object({
    collectorId: z.coerce.number().int().positive(),
    remittanceReference: z.string().trim().min(3).max(100),
    declaredAmount: z.coerce.number().positive().max(999999999.99),
  }),
  params: emptyObject,
  query: emptyObject,
});

const addRemittanceItemSchema = z.object({
  body: z.object({
    collectionId: z.coerce.number().int().positive(),
    amount: z.coerce.number().positive().max(999999999.99),
  }),
  params: remittanceParamsSchema,
  query: emptyObject,
});

const getCollectionSchema = z.object({
  body: emptyObject,
  params: collectionParamsSchema,
  query: emptyObject,
});

const getRemittanceSchema = z.object({
  body: emptyObject,
  params: remittanceParamsSchema,
  query: emptyObject,
});

const submitRemittanceSchema = z.object({
  body: emptyObject,
  params: remittanceParamsSchema,
  query: emptyObject,
});

const verifyRemittanceSchema = z.object({
  body: emptyObject,
  params: remittanceParamsSchema,
  query: emptyObject,
});

const listCollectionsSchema = z.object({
  body: emptyObject,
  params: emptyObject,
  query: z.object({
    status: z
      .enum([
        "EXPECTED",
        "COLLECTED",
        "PARTIAL",
        "DISPUTED",
        "CANCELLED",
        "RECONCILED",
      ])
      .optional(),

    collectorId: z.coerce.number().int().positive().optional(),
  }).passthrough(),
});

module.exports = {
  createCollectionSchema,
  collectPaymentSchema,
  createRemittanceSchema,
  submitRemittanceSchema,
  addRemittanceItemSchema,
  getCollectionSchema,
  getRemittanceSchema,
  verifyRemittanceSchema,
  listCollectionsSchema,
};
