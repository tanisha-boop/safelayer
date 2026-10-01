# SafeLayer Database

SafeLayer uses MySQL as its primary relational database.

The database stores the organization's operational structure, users, roles, permissions, field activities, evidence, financial workflows, reviews, trust assessments, notifications, and audit information.

## Migration History

Database changes are maintained as ordered SQL migrations:

```text
001_initial_schema.sql
002_safelayer_core.sql
003_seed_rbac.sql
004_evidence_enhancement.sql
005_notifications.sql
006_compliance.sql
007_compliance_rbac.sql
008_compliance_duplicate_evidence.sql
```

Each migration represents a controlled stage of database evolution.

Design Principles

The database uses:

primary keys
foreign keys
unique constraints
composite indexes
junction tables for many-to-many relationships
normalized relational structures
transactions for related atomic operations
JSON only where information is variable or semi-structured
Core Relationship
Organization
    ↓
Users
    ↓
Field Activities
    ↓
Evidence
    ↓
Transactions
    ↓
Risk Assessments
    ↓
Reviews
    ↓
Audit Events

These relationships allow SafeLayer to maintain traceability from operational activity through verification and review.

Role-Based Access Control

Authorization follows a relational RBAC structure:

User
 ↓
User Roles
 ↓
Roles
 ↓
Role Permissions
 ↓
Permissions

This allows permissions to be managed without embedding authorization rules directly into database enums.

Evidence Integrity

Evidence records include file hashing and verification information.

This supports verification workflows and provides an integrity reference for uploaded evidence.

Notifications

Notifications are organization-scoped and indexed for common access patterns such as:

unread notifications for a user
recently created organization notifications
notifications associated with a particular entity
Transaction Safety

Operations that modify multiple related records can use database transactions so that related changes are committed atomically or rolled back together.

Security Considerations

The database is accessed through backend repositories rather than directly from the frontend.

Database credentials are supplied through environment variables and are not committed to source control.


Save.

---

# STEP 6 — Now fill the architecture documents

Open:

```text
docs/architecture/system-architecture.md

Paste:

# SafeLayer System Architecture

## Overview

SafeLayer follows a layered full-stack architecture separating presentation, HTTP transport, business logic, persistence, and database concerns.

```text
┌──────────────────────────────┐
│        React Frontend        │
│ Dashboard / Modules / Forms  │
└──────────────┬───────────────┘
               │ HTTP
               ▼
┌──────────────────────────────┐
│       Express REST API       │
├──────────────────────────────┤
│ Routes                       │
│ Controllers                  │
│ Middleware                   │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│          Services            │
│ Business Rules / Workflows   │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│        Repositories          │
│ Data Access / SQL Operations │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│            MySQL             │
└──────────────────────────────┘
Frontend

The React application provides the user-facing operational interface.

Major frontend modules include:

Dashboard
Field Operations
Evidence
RouteProof
FieldLedger
InvoiceGuard
Reviews
Risk & Trust
Reports
Compliance
Settings
Help

API communication is centralized through:

frontend/src/services/api.js
Backend

The backend is organized by responsibility.

Routes

Routes define API endpoints and connect HTTP requests to controllers.

Controllers

Controllers handle HTTP-level concerns such as:

reading request data
invoking services
returning responses
handling request-specific errors
Services

Services contain business logic and workflow rules.

Repositories

Repositories isolate database access from business logic.

Middleware

Cross-cutting controls include:

authentication
authorization
validation
rate limiting
request logging
error handling
evidence upload handling
Validators

Zod-based validators provide structured input validation for supported workflows.

Core Operational Flow
Assignment
    ↓
Field Activity
    ↓
Evidence
    ↓
Verification
    ↓
Trust / Risk Assessment
    ↓
Human Review
    ↓
Operational Outcome
    ↓
Audit Event
Security Boundary

The frontend never connects directly to MySQL.

Browser
  ↓
Express API
  ↓
Authenticated request
  ↓
Authorization
  ↓
Business service
  ↓
Repository
  ↓
MySQL

This creates a clear security and data-access boundary.

Organization Isolation

Organization identifiers are used throughout the operational architecture to prevent users from accessing records belonging to unrelated organizations.

Design Rationale

The layered architecture improves:

separation of concerns
testability
maintainability
security review
code reuse
oral-defense explainability

It also allows individual modules to evolve without moving database logic into frontend components.