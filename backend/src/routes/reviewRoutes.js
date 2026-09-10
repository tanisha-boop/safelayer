const express = require("express");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");

const reviewController = require("../controllers/reviewController");

const {
  listReviewsSchema,
  getReviewSchema,
  updateReviewSchema,
} = require("../validators/reviewValidation");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  authorize("reviews:read"),
  validate(listReviewsSchema),
  reviewController.list
);

router.get(
  "/:id",
  authorize("reviews:read"),
  validate(getReviewSchema),
  reviewController.getOne
);

router.patch(
  "/:id",
  authorize("reviews:resolve"),
  validate(updateReviewSchema),
  reviewController.update
);

module.exports = router;
