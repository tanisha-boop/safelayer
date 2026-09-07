const jwt = require("jsonwebtoken");
const env = require("../config/env");

function generateAccessToken(payload) {
  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.secret);
}

module.exports = {
  generateAccessToken,
  verifyAccessToken,
};