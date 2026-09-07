const userService = require("../services/userManagementService");

async function list(req, res, next) {
  try {
    const users = await userService.listUsers(
      req.user.organizationId
    );

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const user = await userService.getUser(
      req.validated.params.id,
      req.user.organizationId
    );

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const user = await userService.createUser(
      req.user.organizationId,
      req.validated.body
    );

    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const user = await userService.updateUser(
      req.validated.params.id,
      req.user.organizationId,
      req.validated.body
    );

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

async function deactivate(req, res, next) {
  try {
    const user = await userService.deactivateUser(
      req.validated.params.id,
      req.user.organizationId,
      req.user.id
    );

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  deactivate,
};
