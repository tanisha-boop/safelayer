const { z } = require("zod");

const roles = [
  "ADMIN",
  "MANAGER",
  "FIELD_WORKER",
  "FINANCE",
  "AUDITOR",
];

const userIdSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

const createUserSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(2).max(100),
    lastName: z.string().trim().min(2).max(100),
    email: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(100),
    role: z.enum(roles),
  }),
});

const updateUserSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(2).max(100).optional(),
    lastName: z.string().trim().min(2).max(100).optional(),
    role: z.enum(roles).optional(),
  }),
});

module.exports = {
  userIdSchema,
  createUserSchema,
  updateUserSchema,
};
