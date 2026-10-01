USE safelayer;

-- ============================================================
-- SAFE LAYER COMPLIANCE REQUIREMENTS
-- Organization-specific operational requirements and evidence
-- ============================================================

-- ============================================================
-- 1. COMPLIANCE REQUIREMENTS
-- ============================================================

CREATE TABLE compliance_requirements (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    organization_id BIGINT UNSIGNED NOT NULL,

    name VARCHAR(255) NOT NULL,
    requirement_type VARCHAR(100) NOT NULL,
    description TEXT NULL,

    responsible_user_id BIGINT UNSIGNED NULL,

    expiry_date DATE NULL,

    created_by BIGINT UNSIGNED NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_compliance_requirement_org
        FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_compliance_requirement_responsible_user
        FOREIGN KEY (responsible_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_compliance_requirement_creator
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    INDEX idx_compliance_requirement_org (
        organization_id
    ),

    INDEX idx_compliance_requirement_expiry (
        organization_id,
        expiry_date
    )
);


-- ============================================================
-- 2. COMPLIANCE REQUIREMENT EVIDENCE
-- ============================================================

CREATE TABLE compliance_requirement_evidence (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    requirement_id BIGINT UNSIGNED NOT NULL,

    uploaded_by BIGINT UNSIGNED NOT NULL,

    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL,
    file_hash CHAR(64) NULL,

    verification_status ENUM(
        'PENDING',
        'VERIFIED',
        'REJECTED'
    ) NOT NULL DEFAULT 'PENDING',

    verification_notes TEXT NULL,

    document_date DATE NULL,
    expiry_date DATE NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_compliance_evidence_requirement
        FOREIGN KEY (requirement_id)
        REFERENCES compliance_requirements(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_compliance_evidence_user
        FOREIGN KEY (uploaded_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    INDEX idx_compliance_evidence_requirement (
        requirement_id
    ),

    INDEX idx_compliance_evidence_status (
        verification_status
    )
);