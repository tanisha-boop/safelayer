# SafeLayer Backend Architecture

## 1. Architecture Overview

SafeLayer uses a layered REST API architecture.

Client applications communicate with the Express API through HTTP.
Requests pass through authentication, authorization, validation, logging,
security, and error-handling middleware before reaching controllers.

Controllers handle HTTP concerns and delegate business operations to services.

Services contain business rules, workflow logic, transaction orchestration,
risk assessment, review workflows, and module-level decisions.

Repositories isolate database access and SQL operations.

MySQL provides persistent relational storage.

## 2. Request Flow

React Client
    ↓
REST API
    ↓
Middleware
    ├── Authentication
    ├── Authorization / RBAC
    ├── Validation
    ├── Rate Limiting
    ├── Security Headers
    ├── Request Logging
    └── Error Handling
    ↓
Controller
    ↓
Service
    ↓
Repository
    ↓
MySQL

## 3. Backend Layers

### Routes

Routes define HTTP endpoints and attach middleware.

### Middleware

Middleware provides cross-cutting concerns such as authentication,
authorization, validation, rate limiting, logging, and error handling.

### Controllers

Controllers receive HTTP requests, call services, and return HTTP responses.

### Services

Services implement application and business logic.

### Repositories

Repositories execute SQL queries and isolate persistence logic.

### Database

MySQL stores organizations, users, roles, activities, evidence,
transactions, invoices, reviews, risk assessments, and audit events.

## 4. Security Model

SafeLayer uses:

- JWT access tokens
- HTTP cookies for authentication
- Role-based authorization
- Organization-level isolation
- Zod request validation
- Helmet security headers
- Rate limiting
- CORS restrictions
- Centralized error handling
- Parameterized SQL queries

## 5. Transactional Workflows

Critical workflows use database transactions.

Examples include:

- Invoice verification
- Invoice review
- Remittance verification
- Activity trust assessment
- Review state transitions

A workflow either commits all related changes or rolls them back.

## 6. Central Review Workflow

The review service acts as the central workflow layer for activities,
invoices, and financial transactions.

Review decisions may synchronize the linked entity:

APPROVED
→ Invoice VERIFIED
→ Transaction CONFIRMED

REJECTED
→ Invoice REJECTED
→ Transaction VOIDED

ESCALATED
→ Invoice REQUIRES_REVIEW
→ Transaction REQUIRES_REVIEW

## 7. Auditability

Important state changes create audit events containing:

- Organization
- Actor
- Action
- Entity type
- Entity ID
- Previous values
- New values
- Timestamp

Audit events are treated as append-only records.

## 8. Organization Isolation

Authenticated users carry an organization identifier.

Repository queries use organization-level filtering for protected entities.

This prevents users from accessing records belonging to another organization.

## 9. InvoiceGuard

InvoiceGuard evaluates invoice trust signals including:

- Missing invoice date
- Missing due date
- Duplicate invoice number
- Duplicate vendor and amount patterns
- Missing evidence
- Unverified evidence

The resulting risk level determines whether an invoice can be verified
automatically or requires human review.

## 10. TrustLayer

TrustLayer combines operational signals into a trust assessment.

Signals may include:

- Assignment validity
- Worker status
- Location evidence
- Timestamp evidence
- Evidence verification
- Collection worker matching
- Remittance variance
- Transaction consistency
- Duplicate invoices
- Existing invoice review requirements

High-risk and critical cases can enter the central review workflow.

## 11. Design Goal

The architecture is designed to demonstrate separation of concerns,
database integrity, security, transactional consistency, auditability,
and extensibility for additional SafeLayer operational modules.
