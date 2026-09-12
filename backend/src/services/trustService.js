const trustRepository =
  require("../repositories/trustRepository");

const reviewService =
  require("./reviewService");

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function haversineDistanceMeters(
  latitude1,
  longitude1,
  latitude2,
  longitude2
) {
  const toRadians = (value) =>
    (value * Math.PI) / 180;

  const earthRadius = 6371000;

  const dLat = toRadians(
    latitude2 - latitude1
  );

  const dLon = toRadians(
    longitude2 - longitude1
  );

  const lat1 = toRadians(latitude1);
  const lat2 = toRadians(latitude2);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadius * c;
}

function calculateLocationVerification(
  activity,
  routeEvents,
  evidence
) {
  const referenceLatitude =
    activity.latitude !== null
      ? Number(activity.latitude)
      : null;

  const referenceLongitude =
    activity.longitude !== null
      ? Number(activity.longitude)
      : null;

  if (
    referenceLatitude === null ||
    referenceLongitude === null
  ) {
    return {
      verified: false,
      captured: routeEvents.length > 0 ||
        evidence.some(
          (item) =>
            item.latitude !== null &&
            item.longitude !== null
        ),
      distanceMeters: null,
    };
  }

  const locationEvents = [
    ...routeEvents.map((event) => ({
      latitude: Number(event.latitude),
      longitude: Number(event.longitude),
    })),
    ...evidence
      .filter(
        (item) =>
          item.latitude !== null &&
          item.longitude !== null
      )
      .map((item) => ({
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
      })),
  ];

  if (locationEvents.length === 0) {
    return {
      verified: false,
      captured: false,
      distanceMeters: null,
    };
  }

  const distances = locationEvents.map(
    (location) =>
      haversineDistanceMeters(
        referenceLatitude,
        referenceLongitude,
        location.latitude,
        location.longitude
      )
  );

  const minimumDistance = Math.min(
    ...distances
  );

  return {
    verified: minimumDistance <= 500,
    captured: true,
    distanceMeters: Number(
      minimumDistance.toFixed(2)
    ),
  };
}

function calculateTimestampVerification(
  activity,
  routeEvents
) {
  const checkIn = routeEvents.find(
    (event) =>
      event.event_type === "CHECK_IN"
  );

  const checkOut = [...routeEvents]
    .reverse()
    .find(
      (event) =>
        event.event_type === "CHECK_OUT"
    );

  if (!checkIn) {
    return {
      verified: false,
      checkIn: null,
      checkOut: checkOut
        ? checkOut.recorded_at
        : null,
    };
  }

  if (
    checkOut &&
    new Date(checkOut.recorded_at) <
      new Date(checkIn.recorded_at)
  ) {
    return {
      verified: false,
      checkIn: checkIn.recorded_at,
      checkOut: checkOut.recorded_at,
    };
  }

  if (!activity.scheduled_at) {
    return {
      verified: true,
      checkIn: checkIn.recorded_at,
      checkOut: checkOut
        ? checkOut.recorded_at
        : null,
    };
  }

  const scheduled =
    new Date(activity.scheduled_at);

  const actual =
    new Date(checkIn.recorded_at);

  const difference =
    Math.abs(
      actual.getTime() -
        scheduled.getTime()
    );

  const twentyFourHours =
    24 * 60 * 60 * 1000;

  return {
    verified:
      difference <= twentyFourHours,
    checkIn: checkIn.recorded_at,
    checkOut: checkOut
      ? checkOut.recorded_at
      : null,
  };
}

function calculateTrustScore({
  activity,
  routeEvents,
  evidence,
  collections,
  transactions,
  remittances,
  invoices,
}) {
  const signals = [];
  let score = 0;

  function addSignal(
    code,
    impact,
    severity,
    message
  ) {
    score += impact;

    signals.push({
      code,
      impact,
      severity,
      message,
    });
  }

  // Start from a neutral 0 and add trust points.
  addSignal(
    "ASSIGNMENT_VALID",
    20,
    "LOW",
    "The activity has a valid assigned worker."
  );

  if (activity.worker_active) {
    addSignal(
      "WORKER_ACTIVE",
      10,
      "LOW",
      "The assigned worker account is active."
    );
  } else {
    addSignal(
      "WORKER_INACTIVE",
      -20,
      "HIGH",
      "The assigned worker account is inactive."
    );
  }

  const location =
    calculateLocationVerification(
      activity,
      routeEvents,
      evidence
    );

  if (location.captured) {
    addSignal(
      "LOCATION_CAPTURED",
      15,
      "LOW",
      "Location data was captured during field activity."
    );
  } else {
    addSignal(
      "LOCATION_MISSING",
      -15,
      "HIGH",
      "No location evidence was captured."
    );
  }

  if (location.verified) {
    addSignal(
      "LOCATION_VERIFIED",
      15,
      "LOW",
      `Captured location is within ${location.distanceMeters} meters of the activity location.`
    );
  } else if (location.captured) {
    addSignal(
      "LOCATION_NOT_VERIFIED",
      -15,
      "HIGH",
      "Captured location could not be verified against the activity location."
    );
  }

  const timestamp =
    calculateTimestampVerification(
      activity,
      routeEvents
    );

  if (timestamp.verified) {
    addSignal(
      "TIMESTAMP_VERIFIED",
      10,
      "LOW",
      "The route-proof timestamps are logically valid."
    );
  } else {
    addSignal(
      "TIMESTAMP_NOT_VERIFIED",
      -10,
      "MEDIUM",
      "The activity timestamps could not be fully verified."
    );
  }

  if (evidence.length > 0) {
    addSignal(
      "EVIDENCE_ATTACHED",
      15,
      "LOW",
      `${evidence.length} evidence item(s) are attached to the activity.`
    );
  } else {
    addSignal(
      "MISSING_REQUIRED_EVIDENCE",
      -15,
      "HIGH",
      "No evidence is attached to the activity."
    );
  }

  const verifiedEvidence =
    evidence.filter(
      (item) =>
        item.verification_status ===
        "VERIFIED"
    );

  if (verifiedEvidence.length > 0) {
    addSignal(
      "EVIDENCE_VERIFIED",
      10,
      "LOW",
      `${verifiedEvidence.length} evidence item(s) have been verified.`
    );
  } else if (evidence.length > 0) {
    addSignal(
      "EVIDENCE_NOT_VERIFIED",
      -10,
      "MEDIUM",
      "Evidence exists but none has been verified."
    );
  }

  if (
    activity.assigned_to &&
    collections.length > 0
  ) {
    const invalidCollector =
      collections.some(
        (collection) =>
          Number(collection.collector_id) !==
          Number(activity.assigned_to)
      );

    if (invalidCollector) {
      addSignal(
        "COLLECTOR_MISMATCH",
        -20,
        "HIGH",
        "A collection record is associated with a different worker than the activity assignment."
      );
    } else {
      addSignal(
        "COLLECTOR_MATCH",
        10,
        "LOW",
        "Collection records match the assigned field worker."
      );
    }
  }

  const financialDiscrepancy =
    remittances.some(
      (remittance) =>
        Math.abs(
          Number(remittance.variance_amount)
        ) > 0
    );

  if (financialDiscrepancy) {
    addSignal(
      "FINANCIAL_DISCREPANCY",
      -30,
      "CRITICAL",
      "A remittance contains a financial variance."
    );
  } else if (
    collections.length > 0 &&
    remittances.length > 0
  ) {
    addSignal(
      "FINANCIAL_RECONCILED",
      10,
      "LOW",
      "Collection and remittance records contain no financial variance."
    );
  }

  const transactionMismatch =
    collections.some((collection) => {
      const collectionAmount =
        Number(
          collection.collected_amount
        );

      if (collectionAmount <= 0) {
        return false;
      }

      return !transactions.some(
        (transaction) =>
          Number(transaction.amount) ===
            collectionAmount &&
          transaction.transaction_type ===
            "COLLECTION"
      );
    });

  if (transactionMismatch) {
    addSignal(
      "TRANSACTION_MISMATCH",
      -20,
      "HIGH",
      "A collection amount does not have a matching collection transaction."
    );
  } else if (collections.length > 0) {
    addSignal(
      "TRANSACTION_CONSISTENT",
      10,
      "LOW",
      "Collection records are consistent with collection transactions."
    );
  }

  const duplicateDetected =
    invoices.some(
      (invoice, index) =>
        invoices.some(
          (otherInvoice, otherIndex) =>
            index !== otherIndex &&
            invoice.vendor_name ===
              otherInvoice.vendor_name &&
            Number(invoice.amount) ===
              Number(otherInvoice.amount)
        )
    );

  const invoiceReviewRequired =
    invoices.some(
      (invoice) =>
        invoice.status ===
        "REQUIRES_REVIEW"
    );

  if (duplicateDetected) {
    addSignal(
      "DUPLICATE_INVOICE_PATTERN",
      -25,
      "HIGH",
      "Multiple invoices on the activity share the same vendor and amount pattern."
    );
  }

  if (invoiceReviewRequired) {
    addSignal(
      "INVOICE_REQUIRES_REVIEW",
      -20,
      "HIGH",
      "At least one invoice associated with the activity requires human review."
    );
  }

  score = Math.max(
    0,
    Math.min(100, score)
  );

  let riskLevel = "LOW";

  if (score < 40) {
    riskLevel = "CRITICAL";
  } else if (score < 60) {
    riskLevel = "HIGH";
  } else if (score < 80) {
    riskLevel = "MEDIUM";
  }

  const requiresReview =
    riskLevel === "HIGH" ||
    riskLevel === "CRITICAL" ||
    financialDiscrepancy ||
    invoiceReviewRequired;

  return {
    trustScore: score,
    riskLevel,
    requiresReview,
    locationVerified:
      location.verified,
    timestampVerified:
      timestamp.verified,
    duplicateDetected,
    documentVerified:
      verifiedEvidence.length > 0,
    signals,
    summary: {
      routeProofEvents:
        routeEvents.length,
      evidenceItems:
        evidence.length,
      verifiedEvidenceItems:
        verifiedEvidence.length,
      collections:
        collections.length,
      transactions:
        transactions.length,
      remittances:
        remittances.length,
      invoices:
        invoices.length,
    },
  };
}

async function buildAssessment(
  organizationId,
  activityId
) {
  const activity =
    await trustRepository.findActivityContext(
      organizationId,
      activityId
    );

  if (!activity) {
    throw createError(
      "Activity not found",
      404
    );
  }

  const [
    routeEvents,
    evidence,
    collections,
    transactions,
    remittances,
    invoices,
  ] = await Promise.all([
    trustRepository.findRouteProofEvents(
      organizationId,
      activityId
    ),
    trustRepository.findEvidence(
      organizationId,
      activityId
    ),
    trustRepository.findCollections(
      organizationId,
      activityId
    ),
    trustRepository.findTransactions(
      organizationId,
      activityId
    ),
    trustRepository.findRemittances(
      organizationId,
      activityId
    ),
    trustRepository.findInvoices(
      organizationId,
      activityId
    ),
  ]);

  return {
    activity,
    assessment:
      calculateTrustScore({
        activity,
        routeEvents,
        evidence,
        collections,
        transactions,
        remittances,
        invoices,
      }),
  };
}

async function assessActivity({
  organizationId,
  activityId,
  actorId,
}) {
  const connection = await trustRepository.getConnection();

  try {
    await connection.beginTransaction();

    const { activity, assessment } =
      await buildAssessment(
        organizationId,
        activityId,
        connection
      );

    const riskAssessmentId =
      await trustRepository.createRiskAssessment({
        activityId,
        trustScore: assessment.trustScore,
        riskLevel: assessment.riskLevel,
        locationVerified: assessment.locationVerified,
        timestampVerified: assessment.timestampVerified,
        duplicateDetected: assessment.duplicateDetected,
        documentVerified: assessment.documentVerified,
        requiresReview: assessment.requiresReview,
        explanation: assessment,
        connection,
      });

    let reviewId = null;

    if (assessment.requiresReview) {
      const priority =
        assessment.riskLevel === "CRITICAL"
          ? "CRITICAL"
          : "HIGH";

      const reason =
        assessment.signals
          .filter(signal => signal.impact < 0)
          .map(
            signal =>
              `${signal.code}: ${signal.message}`
          )
          .join(" ");

      const existingReview =
          await reviewService.findOpenReviewByEntity({
            organizationId,
            activityId,
            connection,
          });

      if (existingReview) {
        reviewId = existingReview.id;
      } else {
        const review =
          await reviewService.createReview({
            organizationId,
            actorId,
            activityId,
            riskAssessmentId,
            priority,
            reason:
              reason ||
              "Activity requires trust review.",
            connection,
          });

        reviewId = review.id;
      }
    }

    await trustRepository.createAuditEvent({
      organizationId,
      actorId,
      action: "TRUST_ASSESSMENT_CREATED",
      entityType: "FIELD_ACTIVITY",
      entityId: activityId,
      newValues: {
        riskAssessmentId,
        trustScore: assessment.trustScore,
        riskLevel: assessment.riskLevel,
        requiresReview: assessment.requiresReview,
        reviewId,
      },
      connection,
    });

    await connection.commit();

    return {
      activityId: activity.id,
      activityStatus: activity.status,
      assignedWorker: {
        id: activity.worker_id,
        firstName: activity.worker_first_name,
        lastName: activity.worker_last_name,
        email: activity.worker_email,
        active: Boolean(activity.worker_active),
      },
      riskAssessmentId,
      reviewId,
      ...assessment,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getLatestAssessment({
  organizationId,
  activityId,
}) {
  const activity =
    await trustRepository.findActivityContext(
      organizationId,
      activityId
    );

  if (!activity) {
    throw createError(
      "Activity not found",
      404
    );
  }

  const assessment =
    await trustRepository.findLatestRiskAssessment(
      activityId
    );

  if (!assessment) {
    return {
      activityId,
      assessment: null,
    };
  }

  let explanation =
    assessment.explanation;

  if (typeof explanation === "string") {
    try {
      explanation =
        JSON.parse(explanation);
    } catch {
      explanation = null;
    }
  }

  return {
    activityId,
    riskAssessmentId:
      assessment.id,
    trustScore:
      Number(assessment.trust_score),
    riskLevel:
      assessment.risk_level,
    requiresReview:
      Boolean(
        assessment.requires_review
      ),
    locationVerified:
      Boolean(
        assessment.location_verified
      ),
    timestampVerified:
      Boolean(
        assessment.timestamp_verified
      ),
    duplicateDetected:
      Boolean(
        assessment.duplicate_detected
      ),
    documentVerified:
      Boolean(
        assessment.document_verified
      ),
    explanation,
    createdAt:
      assessment.created_at,
  };
}

module.exports = {
  assessActivity,
  getLatestAssessment,
};
