const authService = require("../services/authService");

const {
  setAccessTokenCookie,
  clearAccessTokenCookie,
} = require("../utils/authCookies");

async function register(req, res, next) {
  try {
    const result = await authService.register(
      req.validated.body
    );

    setAccessTokenCookie(res, result.token);

    res.status(201).json({
      success: true,
      message: "Organization and owner account created successfully",
      data: {
        user: result.user,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.validated.body;

    const result = await authService.login(
      email,
      password
    );

    setAccessTokenCookie(res, result.token);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: result.user,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function me(req, res, next) {
  try {
    const user = await authService.getCurrentUser(
      req.user.id
    );

    res.json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
}

function logout(req, res) {
  clearAccessTokenCookie(res);

  res.json({
    success: true,
    message: "Logout successful",
  });
}

module.exports = {
  register,
  login,
  me,
  logout,
};