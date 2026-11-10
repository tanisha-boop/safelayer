USE safelayer;

-- ============================================================
-- SAFE LAYER REVIEW REMITTANCE SUPPORT
-- ============================================================
-- A review must target exactly one of:
-- ACTIVITY, INVOICE, TRANSACTION, or REMITTANCE.
--
-- Risk assessment and assignee are supplementary references.
-- RESTRICT preserves the exactly-one-target invariant.
-- ============================================================

ALTER TABLE reviews
    ADD COLUMN remittance_id BIGINT UNSIGNED NULL
    AFTER invoice_id;

ALTER TABLE reviews
    ADD KEY fk_review_remittance (remittance_id);

-- Remove the original SET NULL target relationships.
ALTER TABLE reviews
    DROP FOREIGN KEY fk_review_activity,
    DROP FOREIGN KEY fk_review_transaction,
    DROP FOREIGN KEY fk_review_invoice;

-- Recreate all four target relationships with RESTRICT.
ALTER TABLE reviews
    ADD CONSTRAINT fk_review_activity
        FOREIGN KEY (activity_id)
        REFERENCES field_activities(id)
        ON DELETE RESTRICT,
    ADD CONSTRAINT fk_review_transaction
        FOREIGN KEY (transaction_id)
        REFERENCES transactions(id)
        ON DELETE RESTRICT,
    ADD CONSTRAINT fk_review_invoice
        FOREIGN KEY (invoice_id)
        REFERENCES invoices(id)
        ON DELETE RESTRICT,
    ADD CONSTRAINT fk_review_remittance
        FOREIGN KEY (remittance_id)
        REFERENCES remittances(id)
        ON DELETE RESTRICT;

-- Exactly one target must be supplied.
ALTER TABLE reviews
    ADD CONSTRAINT chk_review_exactly_one_entity
    CHECK (
        (
            (activity_id IS NOT NULL) +
            (transaction_id IS NOT NULL) +
            (invoice_id IS NOT NULL) +
            (remittance_id IS NOT NULL)
        ) = 1
    );
