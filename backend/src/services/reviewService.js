const pool = require("../config/database");

const reviewRepository =
  require("../repositories/reviewRepository");

const userRepository =
  require("../repositories/userRepository");

const invoiceRepository =
  require("../repositories/invoiceRepository");

const transactionRepository =
  require("../repositories/transactionRepository");

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function findOpenReviewByEntity({
  organizationId,
  activityId,
  invoiceId,
  transactionId,
  connection = pool,
}) {
  return reviewRepository.findOpenReviewByEntity({
    organizationId,
    activityId,
    invoiceId,
    transactionId,
    connection,
  });
}

async function createReview({
  organizationId,
  actorId,
  activityId,
  invoiceId,
  transactionId,
  riskAssessmentId,
  priority,
  reason,
  connection = pool,
}) {
  const entityCount = [
    activityId,
    invoiceId,
    transactionId,
  ].filter((value) => value !== undefined && value !== null).length;

  if (entityCount !== 1) {
    throw createError(
      "A review must reference exactly one entity.",
      400
    );
  }

  if (!priority) {
    throw createError(
      "Review priority is required.",
      400
    );
  }

  if (!reason || !reason.trim()) {
    throw createError(
      "Review reason is required.",
      400
    );
  }

  const existingOpenReview =
    await reviewRepository.findOpenReviewByEntity({
      organizationId,
      activityId,
      invoiceId,
      transactionId,
      connection,
    });

  if (existingOpenReview) {
    throw createError(
      "An active review already exists for this entity.",
      409
    );
  }

  const fields = [
    "organization_id",
    "activity_id",
    "invoice_id",
    "transaction_id",
    "risk_assessment_id",
    "status",
    "priority",
    "reason",
  ];

  const values = [
    organizationId,
    activityId ?? null,
    invoiceId ?? null,
    transactionId ?? null,
    riskAssessmentId ?? null,
    "OPEN",
    priority,
    reason.trim(),
  ];

  const placeholders = values.map(() => "?").join(", ");

  const [result] = await connection.execute(
    `
      INSERT INTO reviews (
        ${fields.join(", ")}
      )
      VALUES (${placeholders})
    `,
    values
  );

  const created =
    await reviewRepository.findById(
      organizationId,
      result.insertId,
      connection
    );

  if (!created) {
    throw createError(
      "Review was created but could not be retrieved.",
      500
    );
  }

  await connection.execute(
    `
      INSERT INTO audit_events (
        organization_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      organizationId,
      actorId ?? null,
      "REVIEW_CREATED",
      "REVIEW",
      result.insertId,
      null,
      JSON.stringify({
        status: "OPEN",
        priority,
        activityId: activityId ?? null,
        invoiceId: invoiceId ?? null,
        transactionId: transactionId ?? null,
        riskAssessmentId: riskAssessmentId ?? null,
        reason: reason.trim(),
      }),
    ]
  );

  return formatReview(created);
}

async function listReviews({
  organizationId,
  status,
  priority,
  entityType,
  page,
  limit,
}) {
  const result =
    await reviewRepository.findReviews({
      organizationId,
      status,
      priority,
      entityType,
      page,
      limit,
    });

  return {
    reviews: result.rows.map(formatReview),

    pagination: {
      page,
      limit,
      total: result.total,
      totalPages:
        Math.ceil(result.total / limit),
    },
  };
}

async function getReview({
  organizationId,
  reviewId,
}) {
  const review =
    await reviewRepository.findById(
      organizationId,
      reviewId
    );

  if (!review) {
    throw createError(
      "Review not found",
      404
    );
  }

  return formatReview(review);
}

async function updateReview({
  organizationId,
  reviewId,
  actorId,
  status,
  assignedTo,
  resolution,
}) {
  const existing =
    await reviewRepository.findById(
      organizationId,
      reviewId
    );

  if (!existing) {
    throw createError(
      "Review not found",
      404
    );
  }

  if (
    [
      "APPROVED",
      "REJECTED",
      "ESCALATED",
      "RESOLVED",
    ].includes(existing.status)
  ) {
    throw createError(
      "This review has already been resolved.",
      409
    );
  }

  // Validate the assignee before opening
  // the transaction.
  if (
    assignedTo !== undefined &&
    assignedTo !== null
  ) {
    const assignee =
      await userRepository
        .findUserByIdAndOrganization(
          assignedTo,
          organizationId
        );

    if (!assignee) {
      throw createError(
        "Assigned user not found in this organization.",
        400
      );
    }

    if (!assignee.is_active) {
      throw createError(
        "Cannot assign a review to an inactive user.",
        400
      );
    }
  }

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const affected =
      await reviewRepository.updateReview({
        organizationId,
        reviewId,
        status,
        assignedTo,
        resolution,
        connection,
      });

    if (!affected) {
      throw createError(
        "Review could not be updated.",
        409
      );
    }

    let updated =
      await reviewRepository.findById(
        organizationId,
        reviewId,
        connection
      );

    /*
     * Synchronize the linked entity inside
     * the same database transaction.
     *
     * APPROVED  -> entity becomes trusted/confirmed
     * REJECTED  -> entity becomes rejected/voided
     * ESCALATED -> entity remains under review
     */
    const terminalDecisionStatuses = [
      "APPROVED",
      "REJECTED",
      "ESCALATED",
    ];

    let entitySynchronized = false;

    /*
     * Invoice synchronization.
     */
    if (
      updated.invoice_id &&
      terminalDecisionStatuses.includes(updated.status)
    ) {
      const invoiceStatusMap = {
        APPROVED: "VERIFIED",
        REJECTED: "REJECTED",
        ESCALATED: "REQUIRES_REVIEW",
      };

      await invoiceRepository.updateStatus(
        organizationId,
        updated.invoice_id,
        invoiceStatusMap[updated.status],
        connection
      );

      entitySynchronized = true;
    }

    /*
     * Transaction synchronization.
     */
    if (
      updated.transaction_id &&
      terminalDecisionStatuses.includes(updated.status)
    ) {
      const transactionStatusMap = {
        APPROVED: "CONFIRMED",
        REJECTED: "VOIDED",
        ESCALATED: "REQUIRES_REVIEW",
      };

      await transactionRepository.updateStatus(
        organizationId,
        updated.transaction_id,
        transactionStatusMap[updated.status],
        connection
      );

      entitySynchronized = true;
    }

    /*
     * Reload through the same transaction connection
     * so the response reflects the synchronized
     * entity state before COMMIT.
     */
    if (entitySynchronized) {
      updated =
        await reviewRepository.findById(
          organizationId,
          reviewId,
          connection
        );
    }

    await createReviewAudit({
      organizationId,
      actorId,
      reviewId,
      existing,
      updated,
      connection,
    });

    await connection.commit();

    return formatReview(updated);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createReviewAudit({
  organizationId,
  actorId,
  reviewId,
  existing,
  updated,
  connection = pool,
}) {
  await connection.execute(
    `
      INSERT INTO audit_events
        (
          organization_id,
          actor_id,
          action,
          entity_type,
          entity_id,
          old_values,
          new_values
        )
      VALUES
        (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      organizationId,
      actorId,
      "REVIEW_UPDATED",
      "REVIEW",
      reviewId,
      JSON.stringify({
        status: existing.status,
        assignedTo: existing.assigned_to,
        resolution: existing.resolution,
      }),
      JSON.stringify({
        status: updated.status,
        assignedTo: updated.assigned_to,
        resolution: updated.resolution,
      }),
    ]
  );
}

function formatReview(review) {
  let entityType = "UNKNOWN";
  let entity = null;

  if (review.activity_id) {
    entityType = "ACTIVITY";

    entity = {
      id: review.activity_id,
      title: review.activity_title,
      type: review.activity_type,
      status: review.activity_status,
    };
  } else if (review.invoice_id) {
    entityType = "INVOICE";

    entity = {
      id: review.invoice_id,
      vendorName: review.vendor_name,
      invoiceNumber: review.invoice_number,
      amount: review.invoice_amount,
      status: review.invoice_status,
    };
  } else if (review.transaction_id) {
    entityType = "TRANSACTION";

    entity = {
      id: review.transaction_id,
      reference: review.transaction_reference,
      amount: review.transaction_amount,
      type: review.transaction_type,
      status: review.transaction_status,
    };
  }

  return {
    id: review.id,

    entityType,

    entity,

    riskAssessmentId:
      review.risk_assessment_id,

    assignedTo:
      review.assigned_to
        ? {
            id: review.assigned_to,
            firstName:
              review.assignee_first_name,
            lastName:
              review.assignee_last_name,
            email:
              review.assignee_email,
          }
        : null,

    status: review.status,
    priority: review.priority,
    reason: review.reason,
    resolution: review.resolution,
    createdAt: review.created_at,
    resolvedAt: review.resolved_at,
  };
}

module.exports = {
  createReview,
  findOpenReviewByEntity,
  listReviews,
  getReview,
  updateReview,
};
