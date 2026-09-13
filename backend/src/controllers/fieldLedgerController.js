const fieldLedgerService = require("../services/fieldLedgerService");

async function createCollection(req, res, next) {
  try {
    const collection =
      await fieldLedgerService.createCollection(
        req.user.organizationId,
        req.user,
        req.validated.body
      );

    res.status(201).json({
      success: true,
      data: collection,
    });
  } catch (error) {
    next(error);
  }
}

async function listCollections(req, res, next) {
  try {
    const collections =
      await fieldLedgerService.listCollections(
        req.user.organizationId,
        req.validated.query
      );

    res.json({
      success: true,
      data: collections,
    });
  } catch (error) {
    next(error);
  }
}

async function getCollection(req, res, next) {
  try {
    const collection =
      await fieldLedgerService.getCollection(
        req.user.organizationId,
        req.validated.params.id
      );

    res.json({
      success: true,
      data: collection,
    });
  } catch (error) {
    next(error);
  }
}

async function collectPayment(req, res, next) {
  try {
    const collection =
      await fieldLedgerService.collectPayment(
        req.user.organizationId,
        req.user,
        req.validated.params.id,
        req.validated.body
      );

    res.json({
      success: true,
      data: collection,
    });
  } catch (error) {
    next(error);
  }
}

async function createRemittance(req, res, next) {
  try {
    const remittance =
      await fieldLedgerService.createRemittance(
        req.user.organizationId,
        req.user,
        req.validated.body
      );

    res.status(201).json({
      success: true,
      data: remittance,
    });
  } catch (error) {
    next(error);
  }
}

async function addRemittanceItem(req, res, next) {
  try {
    const result =
      await fieldLedgerService.addRemittanceItem(
        req.user.organizationId,
        req.user,
        req.validated.params.id,
        req.validated.body
      );

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function verifyRemittance(req, res, next) {
  try {
    const result =
      await fieldLedgerService.verifyRemittance(
        req.user.organizationId,
        req.user,
        req.validated.params.id
      );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}


async function listRemittances(req, res, next) {
  try {
    const remittances =
      await fieldLedgerService.listRemittances(
        req.user.organizationId
      );

    res.json({
      success: true,
      data: remittances,
    });
  } catch (error) {
    next(error);
  }
}

async function getRemittance(req, res, next) {
  try {
    const result =
      await fieldLedgerService.getRemittance(
        req.user.organizationId,
        req.validated.params.id
      );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createCollection,
  listCollections,
  getCollection,
  collectPayment,
  createRemittance,
  addRemittanceItem,
  verifyRemittance,
  listRemittances,
  getRemittance,
};
