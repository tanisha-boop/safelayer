const notificationService = require("../services/notificationService");

async function list(req, res, next) {
  try {
    const result = await notificationService.getNotifications(
      req.user.id,
      req.user.organizationId,
      {
        page: req.query.page,
        limit: req.query.limit,
      }
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function unreadCount(req, res, next) {
  try {
    const result = await notificationService.getNotifications(
      req.user.id,
      req.user.organizationId,
      {
        page: 1,
        limit: 1,
      }
    );

    return res.json({
      success: true,
      data: {
        unreadCount: result.unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function markRead(req, res, next) {
  try {
    const notificationId = Number(req.params.id);

    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    const updated =
      await notificationService.markNotificationAsRead(
        notificationId,
        req.user.id,
        req.user.organizationId
      );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Notification not found or already read",
      });
    }

    return res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    next(error);
  }
}

async function markAllRead(req, res, next) {
  try {
    const count =
      await notificationService.markAllNotificationsAsRead(
        req.user.id,
        req.user.organizationId
      );

    return res.json({
      success: true,
      message: "Notifications marked as read",
      data: {
        updated: count,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  unreadCount,
  markRead,
  markAllRead,
};
