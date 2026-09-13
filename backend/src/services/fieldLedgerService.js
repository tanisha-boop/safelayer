const pool = require("../config/database");

const fieldLedgerRepository =
  require("../repositories/fieldLedgerRepository");

const reviewService =
  require("./reviewService");

const activityRepository =
  require("../repositories/activityRepository");

const userRepository =
  require("../repositories/userRepository");

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function hasRole(currentUser, roles) {
  return currentUser.roles.some((role) =>
    roles.includes(role)
  );
}

async function getActiveCollectorOrThrow(
  organizationId,
  collectorId
) {
  const collector =
    await userRepository.findUserByIdAndOrganization(
      collectorId,
      organizationId
    );

  if (!collector) {
    throw createError(
      "Collector not found in this organization",
      404
    );
  }

  if (!collector.is_active) {
    throw createError(
      "Collector account is inactive",
      409
    );
  }

  return collector;
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
  const collector =
    await getActiveCollectorOrThrow(
      organizationId,
      data.collectorId
    );

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
    !hasRole(currentUser, [
      "OWNER",
      "ADMIN",
      "MANAGER",
    ])
  ) {
    throw createError(
      "Only management can create collection records",
      403
    );
  }

  if (
    data.collectorId !== activity.assigned_to
  ) {
    throw createError(
      "Collector must match the employee assigned to the activity",
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
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const collection =
      await fieldLedgerRepository.findCollectionForUpdate(
        connection,
        organizationId,
        collectionId
      );

    if (!collection) {
      throw createError(
        "Collection record not found",
        404
      );
    }

    if (
      collection.collector_id !== currentUser.id &&
      !hasRole(currentUser, [
        "OWNER",
        "ADMIN",
        "MANAGER",
      ])
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

    const existingRemittance =
      await fieldLedgerRepository.findCollectionRemittance(
        connection,
        organizationId,
        collectionId
      );

    if (existingRemittance) {
      throw createError(
        "This collection is already included in a remittance and cannot be modified",
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
    } else if (
      collectedAmount < expectedAmount
    ) {
      status = "PARTIAL";
    }

    if (
      collectedAmount > expectedAmount
    ) {
      status = "DISPUTED";
    }

    await fieldLedgerRepository.updateCollectionAmount(
      connection,
      organizationId,
      collectionId,
      collectedAmount,
      status,
      data.collectedAt
        ? new Date(data.collectedAt)
        : new Date(),
      data.notes
    );

    /*
     * Keep the financial transaction synchronized
     * with the latest collection amount.
     *
     * We update the existing transaction instead
     * of creating duplicates when a collection
     * changes from partial -> full or full -> partial.
     */
    const existingTransaction =
      await fieldLedgerRepository.findTransactionByReference(
        connection,
        organizationId,
        collection.reference_number
      );

    const transactionDate =
      data.collectedAt
        ? new Date(data.collectedAt)
        : new Date();

    if (existingTransaction) {
      await fieldLedgerRepository.updateTransaction(
        connection,
        organizationId,
        existingTransaction.id,
        {
          amount: collectedAmount,
          transactionDate,
          status:
            collectedAmount === 0
              ? "VOIDED"
              : status === "DISPUTED"
                ? "REQUIRES_REVIEW"
                : "CONFIRMED",
        }
      );
    } else if (collectedAmount > 0) {
      await fieldLedgerRepository.createTransaction(
        connection,
        {
          organizationId,
          activityId:
            collection.activity_id,
          transactionReference:
            collection.reference_number,
          amount: collectedAmount,
          transactionDate,
          createdBy: currentUser.id,
          status:
            status === "DISPUTED"
              ? "REQUIRES_REVIEW"
              : "CONFIRMED",
        }
      );
    }

    await fieldLedgerRepository.createAuditEvent(
      connection,
      {
        organizationId,
        actorId: currentUser.id,
        action: "COLLECTION_RECORDED",
        entityType: "COLLECTION",
        entityId: collectionId,
        oldValues: {
          collected_amount:
            collection.collected_amount,
          collection_status:
            collection.collection_status,
        },
        newValues: {
          collected_amount:
            collectedAmount,
          collection_status: status,
        },
      }
    );

    await connection.commit();

    return getCollectionOrThrow(
      organizationId,
      collectionId
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createRemittance(
  organizationId,
  currentUser,
  data
) {
  await getActiveCollectorOrThrow(
    organizationId,
    data.collectorId
  );

  if (
    currentUser.id !== data.collectorId &&
    !hasRole(currentUser, [
      "OWNER",
      "ADMIN",
      "MANAGER",
      "FINANCE",
    ])
  ) {
    throw createError(
      "You are not authorized to create this remittance",
      403
    );
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    /*
     * expected_amount starts at zero.
     * It will be calculated from remittance items.
     */
    const remittanceId =
      await fieldLedgerRepository.createRemittance(
        connection,
        {
          organizationId,
          collectorId: data.collectorId,
          remittanceReference:
            data.remittanceReference,
          expectedAmount: 0,
          actualAmount: data.declaredAmount,
        }
      );

    await fieldLedgerRepository.createAuditEvent(
      connection,
      {
        organizationId,
        actorId: currentUser.id,
        action: "REMITTANCE_CREATED",
        entityType: "REMITTANCE",
        entityId: remittanceId,
        newValues: {
          collector_id:
            data.collectorId,
          actual_amount:
            data.declaredAmount,
        },
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
      !hasRole(currentUser, [
        "OWNER",
        "ADMIN",
        "MANAGER",
        "FINANCE",
      ])
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
      collection.collection_status ===
      "CANCELLED"
    ) {
      throw createError(
        "Cancelled collections cannot be remitted",
        409
      );
    }

    if (
      Number(collection.collected_amount) <= 0
    ) {
      throw createError(
        "Only collected amounts greater than zero can be remitted",
        400
      );
    }

    if (
      Number(data.amount) !==
      Number(collection.collected_amount)
    ) {
      throw createError(
        "Remittance amount must equal the full collected amount",
        400
      );
    }

    const existingRemittance =
      await fieldLedgerRepository.findCollectionRemittance(
        connection,
        organizationId,
        data.collectionId
      );

    if (existingRemittance) {
      throw createError(
        "This collection has already been included in a remittance",
        409
      );
    }

    const transaction =
      await fieldLedgerRepository.findTransactionByActivity(
        connection,
        organizationId,
        collection.activity_id
      );

    if (!transaction) {
      throw createError(
        "Financial transaction not found for this collection",
        409
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

    await fieldLedgerRepository.linkRemittanceTransaction(
      connection,
      remittanceId,
      transaction.id
    );

    await fieldLedgerRepository.createAuditEvent(
      connection,
      {
        organizationId,
        actorId: currentUser.id,
        action: "REMITTANCE_ITEM_ADDED",
        entityType: "REMITTANCE",
        entityId: remittanceId,
        newValues: {
          collection_id: data.collectionId,
          transaction_id: transaction.id,
          amount: Number(data.amount),
        },
      }
    );

    const expectedAmount =
      await fieldLedgerRepository.getRemittanceTotal(
        connection,
        organizationId,
        remittanceId
      );

    await fieldLedgerRepository.updateRemittanceExpectedAmount(
      connection,
      organizationId,
      remittanceId,
      expectedAmount
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
    !hasRole(currentUser, [
      "OWNER",
      "ADMIN",
      "FINANCE",
    ])
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

    if (
      !["PENDING", "SUBMITTED"].includes(
        remittance.status
      )
    ) {
      throw createError(
        "This remittance has already been processed",
        409
      );
    }

    const expectedAmount =
      await fieldLedgerRepository.getRemittanceTotal(
        connection,
        organizationId,
        remittanceId
      );

    const actualAmount =
      Number(remittance.actual_amount);

    const variance =
      Number(
        (actualAmount - expectedAmount).toFixed(2)
      );

    const reconciliationStatus =
      variance === 0
        ? "MATCHED"
        : "INVESTIGATION";

    const remittanceStatus =
      variance === 0
        ? "VERIFIED"
        : "DISPUTED";

    await fieldLedgerRepository.updateRemittanceExpectedAmount(
      connection,
      organizationId,
      remittanceId,
      expectedAmount
    );

    await fieldLedgerRepository.verifyRemittance(
      connection,
      organizationId,
      remittanceId,
      currentUser.id,
      remittanceStatus
    );

    await fieldLedgerRepository.createReconciliation(
      connection,
      {
        organizationId,
        remittanceId,
        expectedAmount,
        actualAmount,
        status: reconciliationStatus,
        notes:
          variance === 0
            ? "Remittance matched collected amount."
            : `Variance detected: ${variance.toFixed(2)} PHP`,
      }
    );

    if (variance === 0) {
      await fieldLedgerRepository.markCollectionsReconciled(
        connection,
        organizationId,
        remittanceId
      );
    } else {
      const [transactionRows] =
        await connection.execute(
          `SELECT
             t.id,
             t.activity_id
           FROM remittance_transactions rt
           INNER JOIN transactions t
             ON t.id = rt.transaction_id
           WHERE rt.remittance_id = ?
           ORDER BY t.id DESC
           LIMIT 1`,
          [remittanceId]
        );

      const linkedTransaction =
        transactionRows[0] || null;

      if (!linkedTransaction) {
        throw new Error(
          "Cannot create remittance variance review without a linked transaction."
        );
      }

      await fieldLedgerRepository.updateTransaction(
        connection,
        organizationId,
        linkedTransaction.id,
        {
          status: "REQUIRES_REVIEW",
        }
      );

      await reviewService.createReview({
        organizationId,
        actorId: currentUser.id,
        transactionId: linkedTransaction.id,
        priority:
          Math.abs(variance) >= 1000
            ? "CRITICAL"
            : "HIGH",
        reason:
          `Remittance variance detected. ` +
          `Expected ${expectedAmount.toFixed(2)} PHP, ` +
          `actual ${actualAmount.toFixed(2)} PHP, ` +
          `variance ${variance.toFixed(2)} PHP.`,
        connection,
      });
    }

    await fieldLedgerRepository.createAuditEvent(
      connection,
      {
        organizationId,
        actorId: currentUser.id,
        action:
          variance === 0
            ? "REMITTANCE_VERIFIED"
            : "REMITTANCE_DISPUTED",
        entityType: "REMITTANCE",
        entityId: remittanceId,
        oldValues: {
          status: remittance.status,
        },
        newValues: {
          status: remittanceStatus,
          expected_amount: expectedAmount,
          actual_amount: actualAmount,
          variance_amount: variance,
        },
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
      reconciliation: {
        expectedAmount,
        actualAmount,
        variance,
        status: reconciliationStatus,
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}


async function listRemittances(
  organizationId
) {
  return fieldLedgerRepository.findRemittances(
    organizationId
  );
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
  listRemittances,
  getRemittance,
};
