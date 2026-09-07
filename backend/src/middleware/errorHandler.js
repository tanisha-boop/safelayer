function errorHandler(err, req, res, next) {
  console.error("ERROR:", err);
  console.error("MESSAGE:", err.message);
  console.error("STACK:", err.stack);

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? err.message || "Internal server error"
        : err.message,
  });
}

module.exports = errorHandler;
