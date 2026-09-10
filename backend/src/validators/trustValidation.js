const { z } = require("zod");

const emptyObject = z.object({}).passthrough();

const activityParamsSchema = z.object({
  activityId: z.coerce.number().int().positive(),
});

const activityTrustSchema = z.object({
  body: emptyObject,
  params: activityParamsSchema,
  query: emptyObject,
});

module.exports = {
  activityTrustSchema,
};
