const { z } = require("zod");

const activityTypes = [
  "COLLECTION",
  "DELIVERY",
  "VISIT",
  "INSPECTION",
  "MAINTENANCE",
  "WASTE_PICKUP",
  "OTHER",
];

const createActivitySchema = z.object({
  body: z.object({
    assignedTo: z.number().int().positive(),
    activityType: z.enum(activityTypes),
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(5000).optional(),
    scheduledAt: z.string().datetime().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
});

const updateActivitySchema = z.object({
  body: z.object({
    assignedTo: z.number().int().positive().optional(),
    activityType: z.enum(activityTypes).optional(),
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    scheduledAt: z.string().datetime().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
});

const activityIdSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

const completeActivitySchema = z.object({
  body: z.object({
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

module.exports = {
  createActivitySchema,
  updateActivitySchema,
  activityIdSchema,
  completeActivitySchema,
};