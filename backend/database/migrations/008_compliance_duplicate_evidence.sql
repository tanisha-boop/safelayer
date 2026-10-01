USE safelayer;

-- ============================================================
-- SAFE LAYER COMPLIANCE DUPLICATE EVIDENCE PROTECTION
-- ============================================================
-- The same binary document cannot be attached more than once
-- to the same compliance requirement.
--
-- file_hash remains nullable for compatibility with historical
-- records, but all newly uploaded Compliance evidence receives
-- a SHA-256 hash before insertion.
-- ============================================================

ALTER TABLE compliance_requirement_evidence
ADD CONSTRAINT uq_compliance_requirement_file_hash
UNIQUE (
    requirement_id,
    file_hash
);
