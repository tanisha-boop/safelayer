# SafeLayer System Architecture

## Overview

SafeLayer is a full-stack web application designed as an evidence and operational trust platform for organizations with distributed or field-based operations.

The architecture separates presentation, API handling, business logic, data access, and persistence.

## Architecture Layers

```text
React Frontend
      │
      ▼
Express REST API
      │
      ├── Routes
      ├── Controllers
      ├── Middleware
      │
      ▼
Application Services
      │
      ▼
Repositories
      │
      ▼
MySQL Database

Supporting services such as authentication, validation, file handling, audit logging, notifications, and trust assessment operate across the appropriate application layers.

Frontend Layer

The frontend is implemented using React.

Its responsibilities include:

Rendering the user interface
Managing page and component state
Collecting user input
Displaying operational information
Sending requests to the backend API
Handling authenticated application state
Presenting verification, review, risk, and reporting information

The frontend does not directly access the database.

API communication is centralized through:

frontend/src/services/api.js

This prevents individual components from implementing unrelated API request logic.

API Layer

The backend uses Express to expose REST-style API endpoints.

Routes organize requests by functional domain, including:

Authentication
Users
Organizations
Activities
Evidence
RouteProof
FieldLedger
Invoices
Reviews
Trust
Audit
Notifications
Dashboard
Reports
Search

The API layer is responsible for receiving requests and passing them through the appropriate middleware, controller, and service layers.

Middleware Layer

Middleware provides cross-cutting application controls.

Examples include:

Authentication
Authorization
Request validation
Rate limiting
Security headers
File upload validation
Centralized error handling
Request logging

Authentication determines whether a request is associated with a valid session.

Authorization determines whether the authenticated user has permission to perform the requested operation.

Controller Layer

Controllers handle HTTP-level concerns.

A controller typically:

Receives the request.
Extracts validated input.
Calls the appropriate service.
Returns an HTTP response.

Controllers are intentionally kept separate from deeper business logic.

Service Layer

Services contain application and business logic.

Examples include:

Activity lifecycle management
Evidence processing
Financial workflow logic
Invoice verification
Review processing
Trust assessment
Notification behavior
Organization management
User management

The service layer provides a central place for business rules instead of duplicating them across route handlers.

Repository Layer

Repositories provide database access.

They are responsible for:

Executing database queries
Retrieving records
Creating records
Updating records
Deleting records where permitted
Performing related database operations

This separation prevents controllers and frontend components from depending directly on SQL implementation details.

Database Layer

MySQL provides persistent storage.

The database stores:

Organizations
Users
Roles and permissions
Field activities
Evidence
RouteProof records
Financial records
Invoices
Reviews
Risk and trust assessments
Notifications
Audit information

Foreign keys, constraints, indexes, and transactions support data integrity.

Security Boundary

The frontend is considered an untrusted client.

Security-sensitive decisions are enforced by the backend.

Browser
  │
  │ authenticated request
  ▼
Express API
  │
  ├── Authentication
  ├── Authorization
  ├── Validation
  ├── Business Rules
  └── Organization Isolation
  │
  ▼
Database

The client interface must not be relied upon as the only security control.

Core Operational Flow

SafeLayer's core workflow can be represented as:

Assignment
    ↓
Field Activity
    ↓
Evidence
    ↓
Verification
    ↓
Risk Assessment
    ↓
Human Review
    ↓
Operational Outcome
    ↓
Audit Trail

Different modules implement different parts of this workflow.

For example, RouteProof strengthens field activity evidence, FieldLedger handles financial accountability, InvoiceGuard supports invoice verification, and the Trust Engine connects operational evidence with risk and review decisions.

Organization Isolation

SafeLayer is designed for multi-organization use.

Organization context is carried through authenticated backend requests.

Database queries for organization-scoped resources must respect that context.

This provides an architectural boundary between organizations and reduces the risk of cross-organization data access.

Error Handling

Errors are handled centrally by backend middleware.

The API returns structured error responses instead of exposing internal implementation details.

Expected errors such as validation failures, authentication failures, authorization failures, missing resources, conflicts, and server errors are handled consistently.

File Handling

Evidence files are uploaded through the backend.

The upload pipeline includes validation and storage handling before evidence becomes available to the application.

File integrity information can be recorded so that evidence can later be verified against its stored integrity reference.

Architectural Rationale

The layered architecture was selected because SafeLayer contains multiple business domains that need to share common security and data rules.

Separating routes, controllers, services, and repositories provides:

Clear responsibility boundaries
Easier testing
Reusable business logic
Centralized authorization
Easier database maintenance
Better error handling
Greater explainability during system defense
A structure that can scale as additional modules are introduced
Technology Stack
Frontend
React
Vite
Tailwind CSS
Lucide React
Backend
Node.js
Express
Zod
MySQL2
JWT
bcrypt
Multer
Helmet
express-rate-limit
Database
MySQL
Deployment Direction

The current project is designed for local development and academic demonstration.

The architecture can later be containerized using Docker and deployed as a SaaS application with separate frontend, backend, database, object storage, and monitoring infrastructure.