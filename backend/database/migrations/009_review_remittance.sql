USE safelayer;

-- ============================================================
-- SAFE LAYER REVIEW REMITTANCE SUPPORT
-- ============================================================
-- Reviews may now target exactly one of:
-- ACTIVITY, INVOICE, TRANSACTION, or REMITTANCE.
-- ============================================================

ALTER TABLE reviews
    ADD COLUMN remittance_id BIGINT UNSIGNED NULL
    AFTER invoice_id;

ALTER TABLE reviews
    ADD KEY fk_review_remittance (remittance_id);

ALTER TABLE reviews
    ADD CONSTRAINT fk_review_remittance
        FOREIGN KEY (remittance_id)
        REFERENCES remittances(id)
        ON DELETE SET NULL;

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
