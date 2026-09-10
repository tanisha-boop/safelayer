const { z } = require("zod");

const emptyObject = z.object({}).passthrough();

const listAuditSchema = z.object({
  body: emptyObject,
  params: emptyObject,
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    action: z.string().trim().min(1).max(100).optional(),
    entityType: z.string().trim().min(1).max(100).optional(),
    entityId: z.coerce.number().int().positive().optional(),
    actorId: z.coerce.number().int().positive().optional(),
  }).passthrough(),
});

const auditIdSchema = z.object({
  body: emptyObject,
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  query: emptyObject,
});

module.exports = {
  listAuditSchema,
  auditIdSchema,
};
