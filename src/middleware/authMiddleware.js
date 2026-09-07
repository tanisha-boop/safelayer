const { verifyToken } = require('../utils/jwt');

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    const token = authHeader.substring(7);

    try {
        const decoded = verifyToken(token);

        req.user = decoded;

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
}

function authorize(...allowedRoles) {
    return (req, res, next) => {
        const userRoles = req.user?.roles || [];

        const hasPermission = allowedRoles.some(
            role => userRoles.includes(role)
        );

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions'
            });
        }

        next();
    };
}

module.exports = {
    authenticate,
    authorize
};