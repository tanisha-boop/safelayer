USE safelayer;

ALTER TABLE users
ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0
AFTER is_active;
