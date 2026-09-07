const userRepository = require('../repositories/userRepository');
const { comparePassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');

async function login(email, password) {
    const user = await userRepository.findUserByEmail(email);

    if (!user) {
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
    }

    if (user.status !== 'active') {
        const error = new Error('User account is not active');
        error.statusCode = 403;
        throw error;
    }

    const passwordMatches = await comparePassword(
        password,
        user.password_hash
    );

    if (!passwordMatches) {
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
    }

    const roles = await userRepository.findUserWithRoles(user.id);

    const roleNames = roles
        .map(row => row.role_name)
        .filter(Boolean);

    const token = generateToken({
        sub: user.id,
        organizationId: user.organization_id,
        roles: roleNames
    });

    return {
        token,
        user: {
            id: user.id,
            organizationId: user.organization_id,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            roles: roleNames
        }
    };
}

module.exports = {
    login
};