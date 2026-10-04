const express = require("express");

const router = express.Router();

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");

const controller = require("../controllers/fieldLedgerController");

const {
  createCollectionSchema,
  collectPaymentSchema,
  createRemittanceSchema,
  submitRemittanceSchema,
  addRemittanceItemSchema,
  getCollectionSchema,
  getRemittanceSchema,
  verifyRemittanceSchema,
  listCollectionsSchema,
} = require("../validators/fieldLedgerValidation");

router.use(authenticate);

router.post(
  "/collections",
  authorize("transactions:create"),
  validate(createCollectionSchema),
  controller.createCollection
);

router.get(
  "/collections",
  authorize("transactions:read"),
  validate(listCollectionsSchema),
  controller.listCollections
);

router.get(
  "/collections/:id",
  authorize("transactions:read"),
  validate(getCollectionSchema),
  controller.getCollection
);

router.patch(
  "/collections/:id/collect",
  authorize("transactions:create"),
  validate(collectPaymentSchema),
  controller.collectPayment
);

router.post(
  "/remittances",
  authorize("remittances:create"),
  validate(createRemittanceSchema),
  controller.createRemittance
);

router.get(
  "/remittances",
  authorize("remittances:read"),
  controller.listRemittances
);

router.post(
  "/remittances/:id/submit",
  authorize("remittances:create"),
  validate(submitRemittanceSchema),
  controller.submitRemittance
);

router.get(
  "/remittances/:id",
  authorize("remittances:read"),
  validate(getRemittanceSchema),
  controller.getRemittance
);

router.post(
  "/remittances/:id/items",
  authorize("remittances:create"),
  validate(addRemittanceItemSchema),
  controller.addRemittanceItem
);

router.post(
  "/remittances/:id/verify",
  authorize("remittances:verify"),
  validate(verifyRemittanceSchema),
  controller.verifyRemittance
);

module.exports = router;
