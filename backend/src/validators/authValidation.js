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
      .max(128)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).+$/,
        "Password must contain uppercase and lowercase letters, a number, and a special character."
      ),
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


const profileUpdateSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(2).max(100),
    lastName: z.string().trim().min(2).max(100),
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  profileUpdateSchema,
};