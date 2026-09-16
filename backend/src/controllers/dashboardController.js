const dashboardService = require("../services/dashboardService");

async function getOverview(req, res, next) {
  try {
    const dashboard = await dashboardService.getOverview(
      req.user.organizationId
    );

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getOverview,
};
