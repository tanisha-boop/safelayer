const authService = require('../services/authService');

async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        const result = await authService.login(
            email,
            password
        );

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: result
        });
    } catch (error) {
        next(error);
    }
}

async function me(req, res) {
    return res.status(200).json({
        success: true,
        data: {
            user: req.user
        }
    });
}

module.exports = {
    login,
    me
};