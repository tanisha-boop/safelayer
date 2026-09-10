const { z } = require("zod");

const emptyObject = z.object({}).passthrough();

const invoiceIdParams = z.object({
  id: z.coerce.number().int().positive(),
});

const createInvoiceSchema = z.object({
  body: z.object({
    vendorName: z.string().trim().min(2).max(255),
    invoiceNumber: z.string().trim().min(2).max(150),
    invoiceDate: z.string().date().optional(),
    dueDate: z.string().date().optional(),
    amount: z.coerce.number().positive().max(999999999999.99),
    currency: z.string().trim().length(3).toUpperCase().default("PHP"),
    activityId: z.coerce.number().int().positive().optional(),
  }),
  params: emptyObject,
  query: emptyObject,
});

const invoiceIdSchema = z.object({
  body: emptyObject,
  params: invoiceIdParams,
  query: emptyObject,
});

const listInvoicesSchema = z.object({
  body: emptyObject,
  params: emptyObject,
  query: z.object({
    status: z
      .enum([
        "PENDING",
        "VERIFIED",
        "REQUIRES_REVIEW",
        "REJECTED",
        "PAID",
      ])
      .optional(),

    vendorName: z.string().trim().min(1).max(255).optional(),
  }).passthrough(),
});

const reviewInvoiceSchema = z.object({
  body: z.object({
    decision: z.enum([
      "APPROVE",
      "REJECT",
      "ESCALATE",
    ]),

    resolution: z.string().trim().max(2000).optional(),
  }),
  params: invoiceIdParams,
  query: emptyObject,
});

module.exports = {
  createInvoiceSchema,
  invoiceIdSchema,
  listInvoicesSchema,
  reviewInvoiceSchema,
};
