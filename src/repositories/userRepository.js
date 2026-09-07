const db = require('../config/database');

async function findUserByEmail(email) {
    const [rows] = await db.execute(
        `
        SELECT
            u.id,
            u.organization_id,
            u.first_name,
            u.last_name,
            u.email,
            u.password_hash,
            u.status
        FROM users u
        WHERE u.email = ?
        LIMIT 1
        `,
        [email]
    );

    return rows[0] || null;
}

async function findUserWithRoles(userId) {
    const [rows] = await db.execute(
        `
        SELECT
            u.id,
            u.organization_id,
            u.first_name,
            u.last_name,
            u.email,
            u.status,
            r.id AS role_id,
            r.name AS role_name
        FROM users u
        LEFT JOIN user_roles ur
            ON ur.user_id = u.id
        LEFT JOIN roles r
            ON r.id = ur.role_id
        WHERE u.id = ?
        `,
        [userId]
    );

    return rows;
}

module.exports = {
    findUserByEmail,
    findUserWithRoles
};