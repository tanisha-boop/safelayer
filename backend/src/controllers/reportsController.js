const reportsService = require("../services/reportsService");

async function getOverview(req, res, next) {
  try {
    const data = await reportsService.getOverview(
      req.user.organizationId
    );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getOverview,
};
