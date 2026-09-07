const { z } = require('zod');

const loginSchema = z.object({
    email: z
        .string()
        .trim()
        .email(),

    password: z
        .string()
        .min(8)
});

module.exports = {
    loginSchema
};