const db = require("../config/database");

async function createNotification(notification, connection = null) {
  connection = connection || db;
  const [result] = await connection.execute(
    `INSERT INTO notifications
      (
        user_id,
        organization_id,
        type,
        title,
        message,
        entity_type,
        entity_id
      )
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      notification.userId,
      notification.organizationId,
      notification.type,
      notification.title,
      notification.message,
      notification.entityType || null,
      notification.entityId || null,
    ]
  );

  return result.insertId;
}

async function findNotificationsByUser(
  userId,
  organizationId,
  { limit = 20, offset = 0 } = {}
) {
  const [rows] = await db.execute(
    `SELECT
       id,
       user_id,
       organization_id,
       type,
       title,
       message,
       entity_type,
       entity_id,
       is_read,
       read_at,
       created_at
     FROM notifications
     WHERE user_id = ?
       AND organization_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [userId, organizationId, Number(limit), Number(offset)]
  );

  return rows;
}

async function countUnreadByUser(userId, organizationId) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count
     FROM notifications
     WHERE user_id = ?
       AND organization_id = ?
       AND is_read = 0`,
    [userId, organizationId]
  );

  return Number(rows[0]?.count || 0);
}

async function markAsRead(id, userId, organizationId) {
  const [result] = await db.execute(
    `UPDATE notifications
     SET is_read = 1,
         read_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND user_id = ?
       AND organization_id = ?
       AND is_read = 0`,
    [id, userId, organizationId]
  );

  return result.affectedRows > 0;
}

async function markAllAsRead(userId, organizationId) {
  const [result] = await db.execute(
    `UPDATE notifications
     SET is_read = 1,
         read_at = CURRENT_TIMESTAMP
     WHERE user_id = ?
       AND organization_id = ?
       AND is_read = 0`,
    [userId, organizationId]
  );

  return result.affectedRows;
}

module.exports = {
  createNotification,
  findNotificationsByUser,
  countUnreadByUser,
  markAsRead,
  markAllAsRead,
};
