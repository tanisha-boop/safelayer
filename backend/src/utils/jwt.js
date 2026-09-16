const jwt = require("jsonwebtoken");
const env = require("../config/env");

function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      organizationId: user.organization_id,
      roles: user.roles,
      tokenVersion: user.token_version,
    },
    env.jwt.secret,
    {
      algorithm: "HS256",
      expiresIn: env.jwt.expiresIn,
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
    }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.secret, {
    algorithms: ["HS256"],
    issuer: env.jwt.issuer,
    audience: env.jwt.audience,
  });
}

module.exports = {
  generateAccessToken,
  verifyAccessToken,
};