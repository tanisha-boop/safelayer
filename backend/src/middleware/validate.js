const fs = require("fs/promises");

async function removeUploadedFile(req) {
  if (!req.file?.path) {
    return;
  }

  await fs.unlink(req.file.path).catch(() => {});
}

function validate(schema) {
  return async (req, res, next) => {
    const result = schema.safeParse({
      body: req.body ?? {},
      params: req.params ?? {},
      query: req.query ?? {},
    });

    if (!result.success) {
      await removeUploadedFile(req);

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.flatten(),
      });
    }

    req.validated = result.data;
    next();
  };
}

module.exports = validate;
