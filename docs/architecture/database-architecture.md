# SafeLayer Database Architecture

## Overview

SafeLayer uses MySQL as its primary relational database.

The database supports the organization's operational structure, users, roles, permissions, field activities, evidence, financial workflows, reviews, trust assessments, notifications, and audit information.

The database is designed around traceability, integrity, organization isolation, and controlled relationships between operational records.

## Core Relationship

The primary operational relationship is:

Organization
→ Users
→ Field Activities
→ Evidence
→ Transactions
→ Risk Assessments
→ Reviews
→ Audit Events

This structure allows SafeLayer to trace an operational event from field activity through evidence, verification, risk evaluation, review, and audit history.

## Relational Design

SafeLayer uses relational database principles including:

- Primary keys
- Foreign keys
- Unique constraints
- Composite indexes
- Normalized tables
- Junction tables for many-to-many relationships
- Transactional operations
- Organization-scoped records
- JSON fields only where information is variable or semi-structured

Relationships are enforced at the database and application layers where appropriate.

## Role-Based Access Control

Authorization follows a relational structure:

User
→ User Roles
→ Roles
→ Role Permissions
→ Permissions

This design separates users from their permissions and allows authorization rules to evolve without embedding every permission directly into user records.

## Organization Isolation

Operational records are associated with an organization.

The backend uses the authenticated user's organization context when accessing organization-scoped resources.

This prevents the frontend from being treated as the security boundary and ensures that authorization is enforced server-side.

## Evidence Integrity

Evidence records maintain verification-related information and file integrity references.

Uploaded evidence can be associated with a field activity and subsequently reviewed or verified.

File hashing provides an integrity reference that can be used to detect changes to stored evidence.

## Auditability

Important operational actions are represented through audit information.

Audit records support investigation of:

- Record creation
- Record updates
- Status changes
- Verification actions
- Review decisions
- Financial workflow events
- Permission or role changes
- Other security-sensitive operations

This provides a historical record beyond the current state of an entity.

## Notifications

Notifications are organization-scoped and associated with users and operational events where appropriate.

Indexes support common access patterns such as:

- Unread notifications for a user
- Recently created notifications
- Notifications associated with an entity

## Transaction Safety

Operations that modify multiple related records can use database transactions.

Transactions help ensure that related changes are committed atomically or rolled back when an operation fails.

This is particularly important for workflows involving financial records, evidence state changes, and other related entities.

## Indexing

Indexes are used for common lookup and filtering patterns.

Examples include:

- Organization identifiers
- User identifiers
- Activity status
- Activity dates
- Evidence activity relationships
- Notification recipient and read status
- Review status and priority
- Transaction relationships

Indexes are intended to support predictable query performance without unnecessarily duplicating data.

## Migration Strategy

Database changes are maintained through ordered SQL migrations.

Current migration sequence:

1. `001_initial_schema.sql`
2. `002_safelayer_core.sql`
3. `003_seed_rbac.sql`
4. `004_evidence_enhancement.sql`
5. `005_notifications.sql`
6. `006_compliance.sql`
7. `007_compliance_rbac.sql`
8. `008_compliance_duplicate_evidence.sql`

Each migration represents a controlled stage of database evolution.

## Database Security

The frontend never connects directly to MySQL.

Database access occurs through backend repositories and services.

Database credentials are provided through environment variables and are excluded from source control.

The database layer therefore remains behind the backend security boundary.