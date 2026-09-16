const express = require("express");

const searchController = require("../controllers/searchController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  authorize("organization:read"),
  searchController.search
);

module.exports = router;
