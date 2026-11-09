function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;

  if (err.code === "LIMIT_FILE_SIZE") {
    statusCode = 413;

    console.warn(
      `${req.method} ${req.originalUrl} -> ${statusCode}: File too large`
    );

    return res.status(statusCode).json({
      success: false,
      message:
        "File is too large. Maximum size is 10 MB.",
    });
  }

  if (
    err.message ===
    "Only JPEG, PNG, WEBP, and PDF files are allowed"
  ) {
    statusCode = 400;

    console.warn(
      `${req.method} ${req.originalUrl} -> ${statusCode}: ${err.message}`
    );

    return res.status(statusCode).json({
      success: false,
      message: err.message,
    });
  }

  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    statusCode = 400;

    console.warn(
      `${req.method} ${req.originalUrl} -> ${statusCode}: Unexpected file field`
    );

    return res.status(statusCode).json({
      success: false,
      message:
        "Unexpected file field in upload request.",
    });
  }

  if (statusCode >= 500) {
    console.error(err);
  } else {
    console.warn(
      `${req.method} ${req.originalUrl} -> ${statusCode}: ${err.message}`
    );
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
