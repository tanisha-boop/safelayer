const pool = require("../config/database");
const fieldLedgerRepository = require("../repositories/fieldLedgerRepository");
const activityRepository = require("../repositories/activityRepository");

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function getCollectionOrThrow(
  organizationId,
  collectionId
) {
  const collection =
    await fieldLedgerRepository.findCollectionById(
      organizationId,
      collectionId
    );

  if (!collection) {
    throw createError(
      "Collection record not found",
      404
    );
  }

  return collection;
}

async function createCollection(
  organizationId,
  currentUser,
  data
) {
  const activity =
    await activityRepository.findActivityById(
      organizationId,
      data.activityId
    );

  if (!activity) {
    throw createError(
      "Activity not found",
      404
    );
  }

  if (activity.activity_type !== "COLLECTION") {
    throw createError(
      "FieldLedger collections require a COLLECTION activity",
      400
    );
  }

  if (
    currentUser.id !== activity.assigned_to &&
    !currentUser.roles.some((role) =>
      ["OWNER", "ADMIN", "MANAGER"].includes(role)
    )
  ) {
    throw createError(
      "You are not authorized to create a collection for this activity",
      403
    );
  }

  if (Number(data.expectedAmount) <= 0) {
    throw createError(
      "Expected amount must be greater than zero",
      400
    );
  }

  return fieldLedgerRepository.createCollection({
    organizationId,
    activityId: data.activityId,
    collectorId: data.collectorId,
    referenceNumber: data.referenceNumber,
    expectedAmount: data.expectedAmount,
    notes: data.notes,
  });
}

async function listCollections(
  organizationId,
  filters
) {
  return fieldLedgerRepository.findCollections(
    organizationId,
    filters
  );
}

async function getCollection(
  organizationId,
  collectionId
) {
  return getCollectionOrThrow(
    organizationId,
    collectionId
  );
}

async function collectPayment(
  organizationId,
  currentUser,
  collectionId,
  data
) {
  const collection =
    await getCollectionOrThrow(
      organizationId,
      collectionId
    );

  if (
    collection.collector_id !== currentUser.id &&
    !currentUser.roles.some((role) =>
      ["OWNER", "ADMIN", "MANAGER"].includes(role)
    )
  ) {
    throw createError(
      "You are not authorized to record this collection",
      403
    );
  }

  if (
    ["CANCELLED", "RECONCILED"].includes(
      collection.collection_status
    )
  ) {
    throw createError(
      "This collection can no longer be modified",
      409
    );
  }

  const collectedAmount =
    Number(data.collectedAmount);

  const expectedAmount =
    Number(collection.expected_amount);

  let status = "COLLECTED";

  if (collectedAmount === 0) {
    status = "EXPECTED";
  } else if (collectedAmount < expectedAmount) {
    status = "PARTIAL";
  }

  return fieldLedgerRepository.updateCollectionAmount(
    organizationId,
    collectionId,
    collectedAmount,
    status,
    data.collectedAt
      ? new Date(data.collectedAt)
      : new Date(),
    data.notes
  );
}

async function createRemittance(
  organizationId,
  currentUser,
  data
) {
  if (
    currentUser.id !== data.collectorId &&
    !currentUser.roles.some((role) =>
      ["OWNER", "ADMIN", "MANAGER", "FINANCE"].includes(role)
    )
  ) {
    throw createError(
      "You are not authorized to create this remittance",
      403
    );
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const remittanceId =
      await fieldLedgerRepository.createRemittance(
        connection,
        {
          organizationId,
          collectorId: data.collectorId,
          remittanceReference:
            data.remittanceReference,
          declaredAmount:
            data.declaredAmount,
          remittedAt:
            new Date(data.remittedAt),
          notes: data.notes,
        }
      );

    await connection.commit();

    return fieldLedgerRepository.findRemittanceById(
      organizationId,
      remittanceId
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function addRemittanceItem(
  organizationId,
  currentUser,
  remittanceId,
  data
) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const remittance =
      await fieldLedgerRepository.findRemittanceForUpdate(
        connection,
        organizationId,
        remittanceId
      );

    if (!remittance) {
      throw createError(
        "Remittance not found",
        404
      );
    }

    if (remittance.status !== "PENDING") {
      throw createError(
        "Only pending remittances can be modified",
        409
      );
    }

    if (
      remittance.collector_id !== currentUser.id &&
      !currentUser.roles.some((role) =>
        ["OWNER", "ADMIN", "MANAGER", "FINANCE"].includes(role)
      )
    ) {
      throw createError(
        "You are not authorized to modify this remittance",
        403
      );
    }

    const collection =
      await fieldLedgerRepository.findCollectionForUpdate(
        connection,
        organizationId,
        data.collectionId
      );

    if (!collection) {
      throw createError(
        "Collection record not found",
        404
      );
    }

    if (
      collection.collector_id !==
      remittance.collector_id
    ) {
      throw createError(
        "Collection belongs to a different collector",
        409
      );
    }

    if (
      ["CANCELLED", "RECONCILED"].includes(
        collection.collection_status
      )
    ) {
      throw createError(
        "Collection cannot be added to a remittance",
        409
      );
    }

    if (
      Number(data.amount) >
      Number(collection.collected_amount)
    ) {
      throw createError(
        "Remittance amount cannot exceed collected amount",
        400
      );
    }

    await fieldLedgerRepository.addRemittanceItem(
      connection,
      {
        organizationId,
        remittanceId,
        collectionId: data.collectionId,
        amount: data.amount,
      }
    );

    await connection.commit();

    return {
      remittance:
        await fieldLedgerRepository.findRemittanceById(
          organizationId,
          remittanceId
        ),
      items:
        await fieldLedgerRepository.findRemittanceItems(
          organizationId,
          remittanceId
        ),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function verifyRemittance(
  organizationId,
  currentUser,
  remittanceId
) {
  if (
    !currentUser.roles.some((role) =>
      ["OWNER", "ADMIN", "FINANCE"].includes(role)
    )
  ) {
    throw createError(
      "Only finance or authorized administrators can verify remittances",
      403
    );
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const remittance =
      await fieldLedgerRepository.findRemittanceForUpdate(
        connection,
        organizationId,
        remittanceId
      );

    if (!remittance) {
      throw createError(
        "Remittance not found",
        404
      );
    }

    if (remittance.status !== "PENDING") {
      throw createError(
        "This remittance has already been processed",
        409
      );
    }

    const total =
      await fieldLedgerRepository.getRemittanceTotal(
        connection,
        organizationId,
        remittanceId
      );

    const declaredAmount =
      Number(remittance.declared_amount);

    const discrepancy =
      Number((declaredAmount - total).toFixed(2));

    const status =
      discrepancy === 0
        ? "VERIFIED"
        : "REJECTED";

    await fieldLedgerRepository.verifyRemittance(
      connection,
      organizationId,
      remittanceId,
      currentUser.id,
      total,
      discrepancy,
      status
    );

    if (status === "VERIFIED") {
      await fieldLedgerRepository.markCollectionsReconciled(
        connection,
        organizationId,
        remittanceId
      );
    }

    await connection.commit();

    return {
      remittance:
        await fieldLedgerRepository.findRemittanceById(
          organizationId,
          remittanceId
        ),
      items:
        await fieldLedgerRepository.findRemittanceItems(
          organizationId,
          remittanceId
        ),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getRemittance(
  organizationId,
  remittanceId
) {
  const remittance =
    await fieldLedgerRepository.findRemittanceById(
      organizationId,
      remittanceId
    );

  if (!remittance) {
    throw createError(
      "Remittance not found",
      404
    );
  }

  const items =
    await fieldLedgerRepository.findRemittanceItems(
      organizationId,
      remittanceId
    );

  return {
    remittance,
    items,
  };
}

module.exports = {
  createCollection,
  listCollections,
  getCollection,
  collectPayment,
  createRemittance,
  addRemittanceItem,
  verifyRemittance,
  getRemittance,
};
