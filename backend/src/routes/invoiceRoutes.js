const express = require("express");

const authenticate =
  require("../middleware/authMiddleware");

const authorize =
  require("../middleware/authorize");

const validate =
  require("../middleware/validate");

const controller =
  require("../controllers/invoiceController");

const {
  createInvoiceSchema,
  invoiceIdSchema,
  listInvoicesSchema,
  reviewInvoiceSchema,
} = require("../validators/invoiceValidation");

const router = express.Router();

router.use(authenticate);

router.post(
  "/",
  authorize("invoices:create"),
  validate(createInvoiceSchema),
  controller.create
);

router.get(
  "/",
  authorize("invoices:read"),
  validate(listInvoicesSchema),
  controller.list
);

router.get(
  "/:id",
  authorize("invoices:read"),
  validate(invoiceIdSchema),
  controller.getOne
);

router.post(
  "/:id/verify",
  authorize("invoices:review"),
  validate(invoiceIdSchema),
  controller.verify
);

router.post(
  "/:id/review",
  authorize("invoices:review"),
  validate(reviewInvoiceSchema),
  controller.review
);

module.exports = router;
