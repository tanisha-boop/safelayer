const jwt = require("jsonwebtoken");
const env = require("../config/env");

function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      organizationId: user.organization_id,
      roles: user.roles,
    },
    env.jwt.secret,
    {
      expiresIn: env.jwt.expiresIn,
    }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.secret);
}

module.exports = {
  generateAccessToken,
  verifyAccessToken,
};