const organizationService = require("../services/organizationService");

async function get(req, res, next) {
  try {
    const organization = await organizationService.getOrganization(
      req.user.organizationId
    );

    res.json({
      success: true,
      data: organization,
    });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const organization = await organizationService.updateOrganization(
      req.user.organizationId,
      req.validated.body
    );

    res.json({
      success: true,
      data: organization,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  get,
  update,
};
