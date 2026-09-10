const invoiceService =
  require("../services/invoiceService");

async function create(req, res, next) {
  try {
    const invoice =
      await invoiceService.createInvoice({
        organizationId:
          req.user.organizationId,
        submittedBy:
          req.user.id,
        data:
          req.validated.body,
      });

    res.status(201).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
}

async function list(req, res, next) {
  try {
    const invoices =
      await invoiceService.listInvoices(
        req.user.organizationId,
        req.validated.query
      );

    res.json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const invoice =
      await invoiceService.getInvoice(
        req.user.organizationId,
        req.validated.params.id
      );

    res.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
}

async function verify(req, res, next) {
  try {
    const result =
      await invoiceService.verifyInvoice({
        organizationId:
          req.user.organizationId,
        invoiceId:
          req.validated.params.id,
        actorId:
          req.user.id,
      });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function review(req, res, next) {
  try {
    const result =
      await invoiceService.reviewInvoice({
        organizationId:
          req.user.organizationId,
        invoiceId:
          req.validated.params.id,
        actorId:
          req.user.id,
        decision:
          req.validated.body.decision,
        resolution:
          req.validated.body.resolution,
      });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  create,
  list,
  getOne,
  verify,
  review,
};
