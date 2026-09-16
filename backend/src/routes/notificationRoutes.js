const express = require("express");

const notificationController = require("../controllers/notificationController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  authorize("organization:read"),
  notificationController.list
);

router.get(
  "/unread-count",
  authorize("organization:read"),
  notificationController.unreadCount
);

router.patch(
  "/:id/read",
  authorize("organization:read"),
  notificationController.markRead
);

router.patch(
  "/read-all",
  authorize("organization:read"),
  notificationController.markAllRead
);

module.exports = router;
