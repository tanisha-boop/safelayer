const invoiceRepository =
  require("../repositories/invoiceRepository");

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

  const reviews =
    await invoiceRepository.findReviewsByInvoice(
      organizationId,
      invoiceId
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

  if (invoice.status === "PAID") {
    throw createError(
      "A paid invoice cannot be re-verified",
      409
    );
  }

  const duplicateCandidates =
    await invoiceRepository.findDuplicateCandidates(
      organizationId,
      invoice
    );

  const evidence =
    await invoiceRepository.findEvidenceForInvoice(
      organizationId,
      invoiceId
    );

  const assessment = calculateRisk({
    invoice,
    duplicateCandidates,
    evidence,
  });

  let riskAssessmentId = null;

  /*
   * risk_assessments requires an activity_id.
   * InvoiceGuard can therefore create a risk
   * assessment only when the invoice is linked
   * to an activity.
   */
  if (invoice.activity_id) {
    riskAssessmentId =
      await invoiceRepository.createRiskAssessment({
        activityId: invoice.activity_id,
        trustScore: assessment.trustScore,
        riskLevel: assessment.riskLevel,
        locationVerified: false,
        timestampVerified: false,
        duplicateDetected:
          assessment.duplicateDetected,
        documentVerified:
          assessment.documentVerified,
        requiresReview:
          assessment.requiresReview,
        explanation: assessment,
      });
  }

  const oldStatus = invoice.status;

  const newStatus =
    assessment.requiresReview
      ? "REQUIRES_REVIEW"
      : "VERIFIED";

  await invoiceRepository.updateStatus(
    organizationId,
    invoiceId,
    newStatus
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

    reviewId =
      await invoiceRepository.createReview({
        organizationId,
        invoiceId,
        riskAssessmentId,
        priority,
        reason,
      });
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
        review_id: reviewId,
    },
  });

  return {
    invoice:
      await invoiceRepository.findById(
        organizationId,
        invoiceId
      ),
    assessment,
    riskAssessmentId,
    reviewId,
  };
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

  const affected =
    await invoiceRepository.resolveReview({
      organizationId,
      invoiceId,
      decision,
      resolution,
    });

  if (!affected) {
    throw createError(
      "No open review exists for this invoice",
      409
    );
  }

  const statusMap = {
    APPROVE: "VERIFIED",
    REJECT: "REJECTED",
    ESCALATE: "REQUIRES_REVIEW",
  };

  const newStatus =
    statusMap[decision];

  await invoiceRepository.updateStatus(
    organizationId,
    invoiceId,
    newStatus
  );

  await invoiceRepository.createAuditEvent({
    organizationId,
    actorId,
    action: "INVOICE_REVIEWED",
    entityType: "INVOICE",
    entityId: invoiceId,
    oldValues: {
      status: invoice.status,
    },
    newValues: {
      status: newStatus,
      decision,
      resolution:
        resolution || null,
    },
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
