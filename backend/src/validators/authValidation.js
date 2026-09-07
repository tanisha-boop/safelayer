const { z } = require("zod");

const registerSchema = z.object({
  body: z.object({
    organizationName: z
      .string()
      .trim()
      .min(2)
      .max(150),

    firstName: z
      .string()
      .trim()
      .min(1)
      .max(100),

    lastName: z
      .string()
      .trim()
      .min(1)
      .max(100),

    email: z
      .string()
      .trim()
      .email()
      .max(255)
      .transform((value) => value.toLowerCase()),

    password: z
      .string()
      .min(8)
      .max(128),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .email()
      .max(255)
      .transform((value) => value.toLowerCase()),

    password: z
      .string()
      .min(8)
      .max(128),
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
};