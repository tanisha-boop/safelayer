USE safelayer;

-- ============================================================
-- SAFE LAYER DATABASE V2
-- Core operational architecture
-- ============================================================


-- ============================================================
-- 1. ROLES
-- ============================================================

CREATE TABLE roles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 2. PERMISSIONS
-- ============================================================

CREATE TABLE permissions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 3. ROLE PERMISSIONS
-- ============================================================

CREATE TABLE role_permissions (
    role_id BIGINT UNSIGNED NOT NULL,
    permission_id BIGINT UNSIGNED NOT NULL,

    PRIMARY KEY (role_id, permission_id),

    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id)
        REFERENCES roles(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_id)
        REFERENCES permissions(id)
        ON DELETE CASCADE
);


-- ============================================================
-- 4. USER ROLES
-- ============================================================

CREATE TABLE user_roles (
    user_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,

    PRIMARY KEY (user_id, role_id),

    CONSTRAINT fk_user_roles_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_roles_role
        FOREIGN KEY (role_id)
        REFERENCES roles(id)
        ON DELETE CASCADE
);


-- ============================================================
-- 5. AUTHENTICATION SESSIONS
-- ============================================================

CREATE TABLE auth_sessions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,

    token_hash VARCHAR(255) NOT NULL UNIQUE,

    expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,

    ip_address VARCHAR(45),
    user_agent TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_auth_sessions_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_sessions_user (user_id),
    INDEX idx_sessions_expiry (expires_at),
    INDEX idx_sessions_revoked (revoked_at)
);


-- ============================================================
-- 6. FIELD ACTIVITY ASSIGNMENTS
-- ============================================================

CREATE TABLE activity_assignments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    activity_id BIGINT UNSIGNED NOT NULL,
    assigned_by BIGINT UNSIGNED NOT NULL,
    assigned_to BIGINT UNSIGNED NOT NULL,

    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    started_at DATETIME NULL,
    completed_at DATETIME NULL,

    status ENUM(
        'ASSIGNED',
        'ACCEPTED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED'
    ) NOT NULL DEFAULT 'ASSIGNED',

    CONSTRAINT fk_assignment_activity
        FOREIGN KEY (activity_id)
        REFERENCES field_activities(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_assignment_assigner
        FOREIGN KEY (assigned_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_assignment_worker
        FOREIGN KEY (assigned_to)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    INDEX idx_assignment_activity (activity_id),
    INDEX idx_assignment_worker_status (assigned_to, status)
);


-- ============================================================
-- 7. FINANCIAL TRANSACTIONS
-- ============================================================

CREATE TABLE transactions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    organization_id BIGINT UNSIGNED NOT NULL,
    activity_id BIGINT UNSIGNED NULL,

    transaction_reference VARCHAR(100) NOT NULL,

    transaction_type ENUM(
        'COLLECTION',
        'PAYMENT',
        'EXPENSE',
        'ADJUSTMENT'
    ) NOT NULL,

    amount DECIMAL(15,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'PHP',

    status ENUM(
        'PENDING',
        'CONFIRMED',
        'VOIDED',
        'REQUIRES_REVIEW'
    ) NOT NULL DEFAULT 'PENDING',

    transaction_date DATETIME NOT NULL,

    created_by BIGINT UNSIGNED NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_transaction_org
        FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_transaction_activity
        FOREIGN KEY (activity_id)
        REFERENCES field_activities(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_transaction_creator
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    UNIQUE KEY uq_transaction_reference (
        organization_id,
        transaction_reference
    ),

    INDEX idx_transaction_org_date (
        organization_id,
        transaction_date
    ),

    INDEX idx_transaction_activity (
        activity_id
    ),

    INDEX idx_transaction_status (
        status
    )
);


-- ============================================================
-- 8. REMITTANCES
-- ============================================================

CREATE TABLE remittances (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    organization_id BIGINT UNSIGNED NOT NULL,
    collector_id BIGINT UNSIGNED NOT NULL,

    remittance_reference VARCHAR(100) NOT NULL,

    expected_amount DECIMAL(15,2) NOT NULL,
    actual_amount DECIMAL(15,2) NOT NULL,

    variance_amount DECIMAL(15,2)
        GENERATED ALWAYS AS (
            actual_amount - expected_amount
        ) STORED,

    status ENUM(
        'PENDING',
        'SUBMITTED',
        'VERIFIED',
        'DISPUTED',
        'RESOLVED'
    ) NOT NULL DEFAULT 'PENDING',

    submitted_at DATETIME NULL,
    verified_at DATETIME NULL,

    verified_by BIGINT UNSIGNED NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_remittance_org
        FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_remittance_collector
        FOREIGN KEY (collector_id)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_remittance_verifier
        FOREIGN KEY (verified_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    UNIQUE KEY uq_remittance_reference (
        organization_id,
        remittance_reference
    ),

    INDEX idx_remittance_collector (
        collector_id
    ),

    INDEX idx_remittance_status (
        status
    )
);


-- ============================================================
-- 9. TRANSACTION ↔ REMITTANCE
-- ============================================================

-- ============================================================
-- 9A. REMITTANCE ITEMS
-- ============================================================

CREATE TABLE `remittance_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint(20) unsigned NOT NULL,
  `remittance_id` bigint(20) unsigned NOT NULL,
  `collection_id` bigint(20) unsigned NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_remittance_collection` (`remittance_id`,`collection_id`),
  KEY `idx_remittance_item_org` (`organization_id`),
  KEY `idx_remittance_item_remittance` (`remittance_id`),
  KEY `idx_remittance_item_collection` (`collection_id`),
  CONSTRAINT `fk_remittance_item_collection` FOREIGN KEY (`collection_id`) REFERENCES `collection_records` (`id`),
  CONSTRAINT `fk_remittance_item_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`),
  CONSTRAINT `fk_remittance_item_remittance` FOREIGN KEY (`remittance_id`) REFERENCES `remittances` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. REMITTANCE TRANSACTIONS
-- ============================================================

CREATE TABLE remittance_transactions (
    remittance_id BIGINT UNSIGNED NOT NULL,
    transaction_id BIGINT UNSIGNED NOT NULL,

    PRIMARY KEY (
        remittance_id,
        transaction_id
    ),

    CONSTRAINT fk_rt_remittance
        FOREIGN KEY (remittance_id)
        REFERENCES remittances(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_rt_transaction
        FOREIGN KEY (transaction_id)
        REFERENCES transactions(id)
        ON DELETE RESTRICT
);


-- ============================================================
-- 10. RECONCILIATIONS
-- ============================================================

CREATE TABLE reconciliations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    organization_id BIGINT UNSIGNED NOT NULL,
    remittance_id BIGINT UNSIGNED NOT NULL,

    expected_amount DECIMAL(15,2) NOT NULL,
    actual_amount DECIMAL(15,2) NOT NULL,

    variance_amount DECIMAL(15,2)
        GENERATED ALWAYS AS (
            actual_amount - expected_amount
        ) STORED,

    status ENUM(
        'MATCHED',
        'VARIANCE',
        'INVESTIGATION',
        'RESOLVED'
    ) NOT NULL DEFAULT 'MATCHED',

    notes TEXT,

    reviewed_by BIGINT UNSIGNED NULL,
    reviewed_at DATETIME NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_reconciliation_org
        FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_reconciliation_remittance
        FOREIGN KEY (remittance_id)
        REFERENCES remittances(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_reconciliation_reviewer
        FOREIGN KEY (reviewed_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    UNIQUE KEY uq_reconciliation_remittance (
        remittance_id
    ),

    INDEX idx_reconciliation_status (
        status
    )
);


-- ============================================================
-- 11. INVOICES
-- ============================================================

CREATE TABLE invoices (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    organization_id BIGINT UNSIGNED NOT NULL,

    vendor_name VARCHAR(255) NOT NULL,
    invoice_number VARCHAR(150) NOT NULL,

    invoice_date DATE NULL,
    due_date DATE NULL,

    amount DECIMAL(15,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'PHP',

    status ENUM(
        'PENDING',
        'VERIFIED',
        'REQUIRES_REVIEW',
        'REJECTED',
        'PAID'
    ) NOT NULL DEFAULT 'PENDING',

    submitted_by BIGINT UNSIGNED NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_invoice_org
        FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_invoice_submitter
        FOREIGN KEY (submitted_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    UNIQUE KEY uq_invoice_number (
        organization_id,
        invoice_number
    ),

    INDEX idx_invoice_vendor (
        vendor_name
    ),

    INDEX idx_invoice_status (
        status
    ),

    INDEX idx_invoice_date (
        invoice_date
    )
);


-- ============================================================
-- 12. INVOICE EVIDENCE
-- ============================================================

CREATE TABLE invoice_evidence (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    invoice_id BIGINT UNSIGNED NOT NULL,
    evidence_id BIGINT UNSIGNED NOT NULL,

    CONSTRAINT fk_invoice_evidence_invoice
        FOREIGN KEY (invoice_id)
        REFERENCES invoices(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_invoice_evidence_evidence
        FOREIGN KEY (evidence_id)
        REFERENCES evidence(id)
        ON DELETE CASCADE,

    UNIQUE KEY uq_invoice_evidence (
        invoice_id,
        evidence_id
    )
);


-- ============================================================
-- 13. REVIEWS
-- ============================================================

-- ============================================================
-- 14A. RISK ASSESSMENTS
-- ============================================================

CREATE TABLE `risk_assessments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `activity_id` bigint(20) unsigned DEFAULT NULL,
  `invoice_id` bigint(20) unsigned DEFAULT NULL,
  `assessment_type` enum('ACTIVITY','INVOICE') NOT NULL DEFAULT 'ACTIVITY',
  `trust_score` decimal(5,2) NOT NULL,
  `risk_level` enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL,
  `location_verified` tinyint(1) DEFAULT 0,
  `timestamp_verified` tinyint(1) DEFAULT 0,
  `duplicate_detected` tinyint(1) DEFAULT 0,
  `document_verified` tinyint(1) DEFAULT 0,
  `requires_review` tinyint(1) DEFAULT 0,
  `explanation` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`explanation`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_risk_activity` (`activity_id`),
  KEY `idx_risk_level` (`risk_level`),
  KEY `idx_risk_review` (`requires_review`),
  KEY `idx_risk_invoice` (`invoice_id`),
  CONSTRAINT `fk_risk_activity` FOREIGN KEY (`activity_id`) REFERENCES `field_activities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_risk_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 15. REVIEWS
-- ============================================================

CREATE TABLE reviews (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    organization_id BIGINT UNSIGNED NOT NULL,

    activity_id BIGINT UNSIGNED NULL,
    transaction_id BIGINT UNSIGNED NULL,
    invoice_id BIGINT UNSIGNED NULL,
    risk_assessment_id BIGINT UNSIGNED NULL,

    assigned_to BIGINT UNSIGNED NULL,

    status ENUM(
        'OPEN',
        'IN_REVIEW',
        'APPROVED',
        'REJECTED',
        'ESCALATED',
        'RESOLVED'
    ) NOT NULL DEFAULT 'OPEN',

    priority ENUM(
        'LOW',
        'MEDIUM',
        'HIGH',
        'CRITICAL'
    ) NOT NULL DEFAULT 'MEDIUM',

    reason TEXT,

    resolution TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME NULL,

    CONSTRAINT fk_review_org
        FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_review_activity
        FOREIGN KEY (activity_id)
        REFERENCES field_activities(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_review_transaction
        FOREIGN KEY (transaction_id)
        REFERENCES transactions(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_review_invoice
        FOREIGN KEY (invoice_id)
        REFERENCES invoices(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_review_risk
        FOREIGN KEY (risk_assessment_id)
        REFERENCES risk_assessments(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_review_assignee
        FOREIGN KEY (assigned_to)
        REFERENCES users(id)
        ON DELETE SET NULL,

    INDEX idx_review_status_priority (
        status,
        priority
    ),

    INDEX idx_review_assignee (
        assigned_to
    )
);