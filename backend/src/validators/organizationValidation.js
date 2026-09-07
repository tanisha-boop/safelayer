const { z } = require("zod");

const organizationIdSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

const updateOrganizationSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(150),
  }),
});

module.exports = {
  organizationIdSchema,
  updateOrganizationSchema,
};
