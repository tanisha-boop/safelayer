ALTER TABLE evidence
ADD COLUMN file_hash CHAR(64) NULL AFTER file_size,
ADD COLUMN verification_status ENUM('PENDING','VERIFIED','REJECTED')
  NOT NULL DEFAULT 'PENDING'
  AFTER file_hash,
ADD COLUMN verification_notes TEXT NULL
  AFTER verification_status;
