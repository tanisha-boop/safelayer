const { z } = require("zod");

const locationFields = {
  latitude: z.coerce
    .number()
    .min(-90)
    .max(90),

  longitude: z.coerce
    .number()
    .min(-180)
    .max(180),

  accuracyMeters: z.coerce
    .number()
    .positive()
    .max(10000)
    .optional(),
};

const activityIdSchema = z.object({
  params: z.object({
    activityId: z.coerce
      .number()
      .int()
      .positive(),
  }),
});

const checkInSchema = z.object({
  params: z.object({
    activityId: z.coerce
      .number()
      .int()
      .positive(),
  }),

  body: z.object(locationFields),
});

const checkOutSchema = z.object({
  params: z.object({
    activityId: z.coerce
      .number()
      .int()
      .positive(),
  }),

  body: z.object(locationFields),
});

const gpsUpdateSchema = z.object({
  params: z.object({
    activityId: z.coerce
      .number()
      .int()
      .positive(),
  }),

  body: z.object(locationFields),
});

module.exports = {
  activityIdSchema,
  checkInSchema,
  checkOutSchema,
  gpsUpdateSchema,
};
