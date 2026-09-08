const { z } = require("zod");

const collectionIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const remittanceIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createCollectionSchema = z.object({
  activityId: z.coerce.number().int().positive(),
  collectorId: z.coerce.number().int().positive(),

  referenceNumber: z
    .string()
    .trim()
    .min(3)
    .max(100),

  expectedAmount: z
    .coerce
    .number()
    .positive()
    .max(999999999.99),

  notes: z
    .string()
    .trim()
    .max(2000)
    .optional(),
});

const collectPaymentSchema = z.object({
  collectedAmount: z
    .coerce
    .number()
    .nonnegative()
    .max(999999999.99),

  collectedAt: z
    .string()
    .datetime()
    .optional(),

  notes: z
    .string()
    .trim()
    .max(2000)
    .optional(),
});

const createRemittanceSchema = z.object({
  collectorId: z.coerce.number().int().positive(),

  remittanceReference: z
    .string()
    .trim()
    .min(3)
    .max(100),

  declaredAmount: z
    .coerce
    .number()
    .nonnegative()
    .max(999999999.99),

  remittedAt: z
    .string()
    .datetime(),

  notes: z
    .string()
    .trim()
    .max(2000)
    .optional(),
});

const addRemittanceItemSchema = z.object({
  collectionId: z.coerce.number().int().positive(),

  amount: z
    .coerce
    .number()
    .positive()
    .max(999999999.99),
});

module.exports = {
  collectionIdSchema,
  remittanceIdSchema,
  createCollectionSchema,
  collectPaymentSchema,
  createRemittanceSchema,
  addRemittanceItemSchema,
};
