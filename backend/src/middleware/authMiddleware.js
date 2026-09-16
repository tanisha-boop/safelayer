const { verifyAccessToken } = require("../utils/jwt");
const userRepository = require("../repositories/userRepository");

async function authenticate(req, res, next) {
  try {
    const token = req.cookies?.access_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const payload = verifyAccessToken(token);

    const user = await userRepository.findUserAuthState(
      payload.sub
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (
      Number(payload.tokenVersion) !==
      Number(user.token_version)
    ) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    req.user = {
      id: user.id,
      organizationId: user.organization_id,
      roles: payload.roles || [],
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }
}

module.exports = authenticate;
