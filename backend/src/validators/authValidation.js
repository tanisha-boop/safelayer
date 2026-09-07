const { z } = require("zod");

const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .email("A valid email address is required")
      .max(255),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128),
  }),
});

module.exports = {
  loginSchema,
};