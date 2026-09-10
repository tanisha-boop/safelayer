const auditService = require("../services/auditService");

async function list(req, res, next) {
  try {
    const result = await auditService.listAuditEvents({
      organizationId: req.user.organizationId,
      ...req.validated.query,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const event = await auditService.getAuditEvent({
      organizationId: req.user.organizationId,
      id: req.validated.params.id,
    });

    res.json({
      success: true,
      data: event,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  getOne,
};
