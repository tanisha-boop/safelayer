function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    console.error(err);
  } else {
    console.warn(
      `${req.method} ${req.originalUrl} -> ${statusCode}: ${err.message}`
    );
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      message:
        "File is too large. Maximum size is 10 MB.",
    });
  }

  if (
    err.message ===
    "Only JPEG, PNG, WEBP, and PDF files are allowed"
  ) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      success: false,
      message:
        "Unexpected file field in upload request.",
    });
  }

  res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? "Internal server error"
        : err.message,
  });
}

module.exports = errorHandler;
