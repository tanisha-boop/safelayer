const searchService = require("../services/searchService");

async function search(req, res, next) {
  try {
    const query =
      typeof req.query.q === "string"
        ? req.query.q
        : "";

    if (query.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Search query is too long",
      });
    }

    const result = await searchService.search({
      organizationId: req.user.organizationId,
      query,
      permissions: req.permissions || [],
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  search,
};
