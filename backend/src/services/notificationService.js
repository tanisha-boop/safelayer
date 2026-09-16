const notificationRepository = require("../repositories/notificationRepository");

async function createNotification({
  userId,
  organizationId,
  type,
  title,
  message,
  entityType = null,
  entityId = null,
}) {
  if (!userId || !organizationId) {
    throw new Error("Notification recipient is required");
  }

  if (!type || !title || !message) {
    throw new Error("Notification type, title, and message are required");
  }

  return notificationRepository.createNotification({
    userId,
    organizationId,
    type,
    title,
    message,
    entityType,
    entityId,
  });
}

async function getNotifications(userId, organizationId, options = {}) {
  const limit = Math.min(
    Math.max(Number(options.limit) || 20, 1),
    50
  );

  const page = Math.max(Number(options.page) || 1, 1);

  const offset = (page - 1) * limit;

  const notifications =
    await notificationRepository.findNotificationsByUser(
      userId,
      organizationId,
      {
        limit,
        offset,
      }
    );

  const unreadCount =
    await notificationRepository.countUnreadByUser(
      userId,
      organizationId
    );

  return {
    notifications,
    unreadCount,
    page,
    limit,
  };
}

async function markNotificationAsRead(
  notificationId,
  userId,
  organizationId
) {
  return notificationRepository.markAsRead(
    notificationId,
    userId,
    organizationId
  );
}

async function markAllNotificationsAsRead(
  userId,
  organizationId
) {
  return notificationRepository.markAllAsRead(
    userId,
    organizationId
  );
}

module.exports = {
  createNotification,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
