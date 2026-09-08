const express = require("express");

const router = express.Router();

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");

const controller = require("../controllers/fieldLedgerController");

const {
  collectionIdSchema,
  remittanceIdSchema,
  createCollectionSchema,
  collectPaymentSchema,
  createRemittanceSchema,
  addRemittanceItemSchema,
} = require("../validators/fieldLedgerValidation");

router.use(authenticate);

/*
 * COLLECTIONS
 */

router.post(
  "/collections",
  authorize("transactions:create"),
  validate(createCollectionSchema),
  controller.createCollection
);

router.get(
  "/collections",
  authorize("transactions:read"),
  controller.listCollections
);

router.get(
  "/collections/:id",
  authorize("transactions:read"),
  validate(collectionIdSchema),
  controller.getCollection
);

router.patch(
  "/collections/:id/collect",
  authorize("transactions:update"),
  validate(collectPaymentSchema),
  controller.collectPayment
);

/*
 * REMITTANCES
 */

router.post(
  "/remittances",
  authorize("remittances:create"),
  validate(createRemittanceSchema),
  controller.createRemittance
);

router.get(
  "/remittances/:id",
  authorize("remittances:read"),
  validate(remittanceIdSchema),
  controller.getRemittance
);

router.post(
  "/remittances/:id/items",
  authorize("remittances:create"),
  validate(addRemittanceItemSchema),
  validate(remittanceIdSchema),
  controller.addRemittanceItem
);

router.post(
  "/remittances/:id/verify",
  authorize("remittances:verify"),
  validate(remittanceIdSchema),
  controller.verifyRemittance
);

module.exports = router;
