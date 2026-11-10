const STATE_CHANGING_METHODS = new Set([
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

function createOriginGuard(allowedOrigin) {
  let trustedOrigin;

  try {
    trustedOrigin = new URL(allowedOrigin).origin;
  } catch {
    throw new Error("FRONTEND_URL must be a valid absolute URL");
  }

  return function originGuard(req, res, next) {
    if (!STATE_CHANGING_METHODS.has(req.method)) {
      return next();
    }

    const requestOrigin = req.get("Origin");

    // Allow non-browser clients that do not send an Origin header.
    if (requestOrigin === undefined) {
      return next();
    }

    let parsedOrigin;

    try {
      parsedOrigin = new URL(requestOrigin);
    } catch {
      return res.status(403).json({
        success: false,
        message: "Request origin is not allowed",
      });
    }

    if (
      requestOrigin === "null" ||
      parsedOrigin.origin !== requestOrigin ||
      parsedOrigin.origin !== trustedOrigin
    ) {
      return res.status(403).json({
        success: false,
        message: "Request origin is not allowed",
      });
    }

    return next();
  };
}

module.exports = createOriginGuard;
