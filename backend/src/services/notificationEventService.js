const notificationService =
  require("./notificationService");

const recipientService =
  require("./notificationRecipientService");

async function notifyUser({
  userId,
  organizationId,
  type,
  title,
  message,
  entityType,
  entityId,
  connection = null,
}) {
  const recipient =
    await recipientService.getUserIfActiveInOrganization(
      userId,
      organizationId
    );

  if (!recipient) {
    return [];
  }

  return notificationService.createNotificationsForUsers({
    userIds: [recipient],
    organizationId,
    type,
    title,
    message,
    entityType,
    entityId,
    connection,
  });
}

async function notifyManagers({
  organizationId,
  type,
  title,
  message,
  entityType,
  entityId,
  connection = null,
}) {
  const recipients =
    await recipientService.getManagers(
      organizationId
    );

  return notificationService.createNotificationsForUsers({
    userIds: recipients,
    organizationId,
    type,
    title,
    message,
    entityType,
    entityId,
    connection,
  });
}

async function notifyFinance({
  organizationId,
  type,
  title,
  message,
  entityType,
  entityId,
  connection = null,
}) {
  const recipients =
    await recipientService.getFinanceUsers(
      organizationId
    );

  return notificationService.createNotificationsForUsers({
    userIds: recipients,
    organizationId,
    type,
    title,
    message,
    entityType,
    entityId,
    connection,
  });
}

async function notifyManagersAndFinance({
  organizationId,
  type,
  title,
  message,
  entityType,
  entityId,
  connection = null,
}) {
  const managers =
    await recipientService.getManagers(
      organizationId
    );

  const financeUsers =
    await recipientService.getFinanceUsers(
      organizationId
    );

  const recipients =
    await recipientService.uniqueUserIds([
      ...managers,
      ...financeUsers,
    ]);

  return notificationService.createNotificationsForUsers({
    userIds: recipients,
    organizationId,
    type,
    title,
    message,
    entityType,
    entityId,
    connection,
  });
}

module.exports = {
  notifyUser,
  notifyManagers,
  notifyFinance,
  notifyManagersAndFinance,
};
