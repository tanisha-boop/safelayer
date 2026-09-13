const invoiceRepository =
  require("../repositories/invoiceRepository");

const reviewService =
  require("./reviewService");

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function calculateRisk({
  invoice,
  duplicateCandidates,
  evidence,
}) {
  const signals = [];

  let riskPoints = 0;

  if (!invoice.invoice_date) {
    riskPoints += 15;

    signals.push({
      code: "MISSING_INVOICE_DATE",
      severity: "MEDIUM",
      message: "Invoice date is missing.",
    });
  }

  if (!invoice.due_date) {
    riskPoints += 5;

    signals.push({
      code: "MISSING_DUE_DATE",
      severity: "LOW",
      message: "Due date is missing.",
    });
  }

  if (duplicateCandidates.length > 0) {
    const exactNumberMatch =
      duplicateCandidates.some(
        (candidate) =>
          candidate.invoice_number ===
          invoice.invoice_number
      );

    if (exactNumberMatch) {
      riskPoints += 60;

      signals.push({
        code: "DUPLICATE_INVOICE_NUMBER",
        severity: "CRITICAL",
        message:
          "Another invoice already uses this invoice number.",
      });
    } else {
      riskPoints += 30;

      signals.push({
        code: "DUPLICATE_PATTERN",
        severity: "HIGH",
        message:
          "A similar vendor and amount combination already exists.",
      });
    }
  }

  if (!evidence || evidence.length === 0) {
    riskPoints += 20;

    signals.push({
      code: "MISSING_EVIDENCE",
      severity: "HIGH",
      message:
        "No supporting invoice evidence is attached.",
    });
  }

  const verifiedEvidence =
    evidence?.filter(
      (item) =>
        item.verification_status ===
        "VERIFIED"
    ) || [];

  if (
    evidence &&
    evidence.length > 0 &&
    verifiedEvidence.length === 0
  ) {
    riskPoints += 10;

    signals.push({
      code: "EVIDENCE_NOT_VERIFIED",
      severity: "MEDIUM",
      message:
        "Supporting evidence exists but has not been verified.",
    });
  }

  const trustScore =
    Math.max(0, 100 - riskPoints);

  let riskLevel = "LOW";

  if (riskPoints >= 70) {
    riskLevel = "CRITICAL";
  } else if (riskPoints >= 45) {
    riskLevel = "HIGH";
  } else if (riskPoints >= 20) {
    riskLevel = "MEDIUM";
  }

  return {
    trustScore,
    riskLevel,
    requiresReview:
      riskLevel === "HIGH" ||
      riskLevel === "CRITICAL",
    duplicateDetected:
      duplicateCandidates.length > 0,
    documentVerified:
      verifiedEvidence.length > 0,
    signals,
  };
}

async function createInvoice({
  organizationId,
  submittedBy,
  data,
}) {
  const existing =
    await invoiceRepository.findByInvoiceNumber(
      organizationId,
      data.invoiceNumber
    );

  if (existing) {
    throw createError(
      "An invoice with this invoice number already exists",
      409
    );
  }

  const invoice =
    await invoiceRepository.createInvoice({
      organizationId,
      vendorName: data.vendorName,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate,
      amount: data.amount,
      currency: data.currency,
      submittedBy,
      activityId: data.activityId,
    });

  await invoiceRepository.createAuditEvent({
    organizationId,
    actorId: submittedBy,
    action: "INVOICE_CREATED",
    entityType: "INVOICE",
    entityId: invoice.id,
    newValues: {
      vendor_name: invoice.vendor_name,
      invoice_number: invoice.invoice_number,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
    },
  });

  return invoice;
}

async function listInvoices(
  organizationId,
  filters
) {
  return invoiceRepository.listInvoices(
    organizationId,
    filters
  );
}

async function getInvoice(
  organizationId,
  invoiceId
) {
  const invoice =
    await invoiceRepository.findById(
      organizationId,
      invoiceId
    );

  if (!invoice) {
    throw createError(
      "Invoice not found",
      404
    );
  }

  const evidence =
    await invoiceRepository.findEvidenceForInvoice(
      organizationId,
      invoiceId
    );

  const reviewResult =
    await reviewService.listReviews({
      organizationId,
      entityType: "INVOICE",
      page: 1,
      limit: 100,
    });

  const reviews =
    reviewResult.reviews.filter(
      (review) =>
        review.entity?.id === invoiceId
    );

  return {
    invoice,
    evidence,
    reviews,
  };
}

async function verifyInvoice({
  organizationId,
  invoiceId,
  actorId,
}) {
  const connection =
    await invoiceRepository.getConnection();

  try {
    await connection.beginTransaction();

    const invoice =
      await invoiceRepository.findById(
        organizationId,
        invoiceId,
        connection
      );

    if (!invoice) {
      throw createError(
        "Invoice not found",
        404
      );
    }

    if (invoice.status === "PAID") {
      throw createError(
        "A paid invoice cannot be re-verified",
        409
      );
    }

    const duplicateCandidates =
      await invoiceRepository.findDuplicateCandidates(
        organizationId,
        invoice,
        connection
      );

    const evidence =
      await invoiceRepository.findEvidenceForInvoice(
        organizationId,
        invoiceId,
        connection
      );

    const assessment = calculateRisk({
      invoice,
      duplicateCandidates,
      evidence,
    });

    const riskAssessmentId =
      await invoiceRepository.createRiskAssessment({
        activityId:
          invoice.activity_id ?? null,
        invoiceId,
        trustScore:
          assessment.trustScore,
        riskLevel:
          assessment.riskLevel,
        locationVerified: false,
        timestampVerified: false,
        duplicateDetected:
          assessment.duplicateDetected,
        documentVerified:
          assessment.documentVerified,
        requiresReview:
          assessment.requiresReview,
        explanation: assessment,
        connection,
      });

    const oldStatus =
      invoice.status;

    const newStatus =
      assessment.requiresReview
        ? "REQUIRES_REVIEW"
        : "VERIFIED";

    await invoiceRepository.updateStatus(
      organizationId,
      invoiceId,
      newStatus,
      connection
    );

    let reviewId = null;

    if (assessment.requiresReview) {
      const reason =
        assessment.signals
          .map(
            (signal) =>
              `${signal.code}: ${signal.message}`
          )
          .join(" ");

      const priority =
        assessment.riskLevel === "CRITICAL"
          ? "CRITICAL"
          : "HIGH";

      const existingReview =
        await reviewService.findOpenReviewByEntity({
          organizationId,
          invoiceId,
          connection,
        });

      if (existingReview) {
        reviewId =
          existingReview.id;
      } else {
        const review =
          await reviewService.createReview({
            organizationId,
            actorId,
            invoiceId,
            riskAssessmentId,
            priority,
            reason,
            connection,
          });

        reviewId = review.id;
      }
    }

    await invoiceRepository.createAuditEvent({
      organizationId,
      actorId,
      action: "INVOICE_VERIFIED",
      entityType: "INVOICE",
      entityId: invoiceId,
      oldValues: {
        status: oldStatus,
      },
      newValues: {
        status: newStatus,
        trust_score:
          assessment.trustScore,
        risk_level:
          assessment.riskLevel,
        duplicate_detected:
          assessment.duplicateDetected,
        requires_review:
          assessment.requiresReview,
        risk_assessment_id:
          riskAssessmentId,
        review_id:
          reviewId,
      },
      connection,
    });

    const updatedInvoice =
      await invoiceRepository.findById(
        organizationId,
        invoiceId,
        connection
      );

    await connection.commit();

    return {
      invoice: updatedInvoice,
      assessment,
      riskAssessmentId,
      reviewId,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function reviewInvoice({
  organizationId,
  invoiceId,
  actorId,
  decision,
  resolution,
}) {
  const invoice =
    await invoiceRepository.findById(
      organizationId,
      invoiceId
    );

  if (!invoice) {
    throw createError(
      "Invoice not found",
      404
    );
  }

  if (
    ![
      "REQUIRES_REVIEW",
      "PENDING",
    ].includes(invoice.status)
  ) {
    throw createError(
      "This invoice is not awaiting review",
      409
    );
  }

  const matchingReview =
    await reviewService.findOpenReviewByEntity({
      organizationId,
      invoiceId,
    });

  if (!matchingReview) {
    throw createError(
      "No open review exists for this invoice",
      409
    );
  }

  const statusMap = {
    APPROVE: "APPROVED",
    REJECT: "REJECTED",
    ESCALATE: "ESCALATED",
  };

  const reviewStatus =
    statusMap[decision];

  if (!reviewStatus) {
    throw createError(
      "Invalid review decision",
      400
    );
  }

  await reviewService.updateReview({
    organizationId,
    reviewId:
      matchingReview.id,
    actorId,
    status: reviewStatus,
    resolution:
      resolution || null,
  });

  return getInvoice(
    organizationId,
    invoiceId
  );
}

module.exports = {
  createInvoice,
  listInvoices,
  getInvoice,
  verifyInvoice,
  reviewInvoice,
};
