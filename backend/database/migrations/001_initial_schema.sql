USE safelayer;

-- ============================================================
-- SAFE LAYER DATABASE V1
-- Foundational operational architecture
-- ============================================================

CREATE TABLE `organizations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `slug` varchar(150) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint(20) unsigned NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('OWNER','ADMIN','MANAGER','FIELD_WORKER','FINANCE','AUDITOR') NOT NULL DEFAULT 'FIELD_WORKER',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_org_email` (`organization_id`,`email`),
  KEY `idx_users_organization` (`organization_id`),
  KEY `idx_users_role` (`role`),
  CONSTRAINT `fk_users_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `field_activities` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint(20) unsigned NOT NULL,
  `assigned_to` bigint(20) unsigned NOT NULL,
  `activity_type` enum('COLLECTION','DELIVERY','VISIT','INSPECTION','MAINTENANCE','WASTE_PICKUP','OTHER') NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('PENDING','IN_PROGRESS','COMPLETED','CANCELLED','REQUIRES_REVIEW') NOT NULL DEFAULT 'PENDING',
  `scheduled_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_activity_org_status` (`organization_id`,`status`),
  KEY `idx_activity_assigned` (`assigned_to`),
  KEY `idx_activity_scheduled` (`scheduled_at`),
  CONSTRAINT `fk_activity_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_activity_user` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `evidence` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `activity_id` bigint(20) unsigned NOT NULL,
  `uploaded_by` bigint(20) unsigned NOT NULL,
  `evidence_type` enum('PHOTO','DOCUMENT','RECEIPT','SIGNATURE','OTHER') NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  `file_size` bigint(20) unsigned NOT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `captured_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_evidence_activity` (`activity_id`),
  KEY `idx_evidence_uploaded_by` (`uploaded_by`),
  CONSTRAINT `fk_evidence_activity` FOREIGN KEY (`activity_id`) REFERENCES `field_activities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_evidence_user` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `collection_records` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint(20) unsigned NOT NULL,
  `activity_id` bigint(20) unsigned NOT NULL,
  `collector_id` bigint(20) unsigned NOT NULL,
  `reference_number` varchar(100) NOT NULL,
  `expected_amount` decimal(12,2) NOT NULL,
  `collected_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `collection_status` enum('EXPECTED','COLLECTED','PARTIAL','DISPUTED','CANCELLED','RECONCILED') NOT NULL DEFAULT 'EXPECTED',
  `collected_at` datetime DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_collection_reference` (`organization_id`,`reference_number`),
  KEY `idx_collection_org` (`organization_id`),
  KEY `idx_collection_activity` (`activity_id`),
  KEY `idx_collection_collector` (`collector_id`),
  KEY `idx_collection_status` (`collection_status`),
  KEY `idx_collection_reference` (`reference_number`),
  CONSTRAINT `fk_collection_activity` FOREIGN KEY (`activity_id`) REFERENCES `field_activities` (`id`),
  CONSTRAINT `fk_collection_collector` FOREIGN KEY (`collector_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_collection_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `route_proof_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint(20) unsigned NOT NULL,
  `activity_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `event_type` enum('CHECK_IN','CHECK_OUT','GPS_UPDATE') NOT NULL,
  `latitude` decimal(10,8) NOT NULL,
  `longitude` decimal(11,8) NOT NULL,
  `accuracy_meters` decimal(10,2) DEFAULT NULL,
  `recorded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_route_proof_organization` (`organization_id`),
  KEY `idx_route_proof_activity` (`activity_id`),
  KEY `idx_route_proof_user` (`user_id`),
  KEY `idx_route_proof_type` (`event_type`),
  KEY `idx_route_proof_recorded_at` (`recorded_at`),
  CONSTRAINT `fk_route_proof_activity` FOREIGN KEY (`activity_id`) REFERENCES `field_activities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_route_proof_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_route_proof_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `audit_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `organization_id` bigint(20) unsigned NOT NULL,
  `actor_id` bigint(20) unsigned DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entity_type` varchar(100) NOT NULL,
  `entity_id` bigint(20) unsigned DEFAULT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_values`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_audit_org_date` (`organization_id`,`created_at`),
  KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  KEY `idx_audit_actor` (`actor_id`),
  CONSTRAINT `fk_audit_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_audit_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
