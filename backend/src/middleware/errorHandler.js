function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      message: "File is too large. Maximum size is 10 MB.",
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

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? "Internal server error"
        : err.message,
  });
}

module.exports = errorHandler;