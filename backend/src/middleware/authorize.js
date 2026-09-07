const {
  findUserPermissions,
} = require("../repositories/userRepository");

function authorize(requiredPermission) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const permissions = await findUserPermissions(req.user.id);

      const hasPermission = permissions.some(
        (permission) => permission.name === requiredPermission
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to perform this action",
        });
      }

      req.permissions = permissions;

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = authorize;