const reviewService = require("../services/reviewService");

async function list(req, res, next) {
  try {
    const result =
      await reviewService.listReviews({
        organizationId:
          req.user.organizationId,
        ...req.validated.query,
      });

    res.json({
      success: true,
      data: result.reviews,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const review =
      await reviewService.getReview({
        organizationId:
          req.user.organizationId,
        reviewId:
          req.validated.params.id,
      });

    res.json({
      success: true,
      data: review,
    });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const review =
      await reviewService.updateReview({
        organizationId:
          req.user.organizationId,

        reviewId:
          req.validated.params.id,

        actorId:
          req.user.id,

        ...req.validated.body,
      });

    res.json({
      success: true,
      message: "Review updated successfully.",
      data: review,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  getOne,
  update,
};
