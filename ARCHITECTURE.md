# SafeLayer Architecture

## 1. System Overview

SafeLayer is a full-stack web application for field workforce accountability, evidence verification, financial reconciliation, and operational trust management.

The system uses a decoupled React frontend, an Express REST API, and a MySQL relational database. The frontend communicates with the backend through HTTP requests and does not access the database directly.

## 2. Technology Stack

### Frontend
- React
- Vite
- JavaScript
- Tailwind CSS
- Lucide React
- Fetch API

### Backend
- Node.js
- Express.js
- Zod
- MySQL2
- JSON Web Tokens (JWT)
- bcrypt
- Multer
- Helmet
- express-rate-limit

### Database
- MySQL
- Versioned SQL migrations

## 3. High-Level Architecture

React Frontend
      |
      | HTTP / JSON / FormData
      | Authentication Cookie
      v
Express REST API
      |
      | Routes and Middleware
      | Controllers
      | Application Services
      | Repositories
      v
MySQL Database
      |
      | Relational Tables
      | Constraints and Indexes
      | Foreign Keys
      | Transactions

## 4. Frontend Architecture

The frontend is implemented using React and Vite.

Its responsibilities include:
- Rendering application pages and components.
- Managing interface and application state.
- Collecting user input.
- Displaying operational records and reports.
- Communicating with backend endpoints.
- Presenting authentication, verification, and review workflows.

API communication is centralized in:

`frontend/src/services/api.js`

Application module navigation is managed through frontend component state. The frontend and backend remain separate applications.

## 5. Backend Architecture

The backend follows a layered architecture.

### Routes
Define API endpoints and connect requests to the appropriate middleware and controllers.

### Middleware
Handles authentication, authorization, request validation, rate limiting, security headers, request logging, and error handling.

### Controllers
Handle HTTP requests and responses and delegate business operations to services.

### Services
Contain application rules, workflow logic, and transaction orchestration.

### Repositories
Encapsulate SQL queries and database operations.

This separation of responsibilities improves maintainability, testability, and explainability.

## 6. API Architecture

The backend exposes REST-style endpoints under `/api`.

| API Prefix | Responsibility |
|---|---|
| `/api/auth` | Authentication |
| `/api/activities` | Field activities |
| `/api/evidence` | Evidence management |
| `/api/route-proof` | Field activity location and route evidence |
| `/api/organization` | Organization management |
| `/api/dashboard` | Dashboard information |
| `/api/reports` | Operational reports |
| `/api/users` | User management |
| `/api/field-ledger` | Collections and remittances |
| `/api/invoices` | Invoice verification |
| `/api/audit-events` | Audit records |
| `/api/trust` | Trust assessments |
| `/api/reviews` | Human review workflows |
| `/api/notifications` | Notifications |
| `/api/search` | Search |
| `/api/compliance` | Compliance management |

Request flow:

Frontend Component → API Client → Express Route → Middleware → Controller → Service → Repository → MySQL.

## 7. Database Architecture

MySQL is the persistent relational data store.

The database includes tables for:
- Organizations and users
- Roles and permissions
- Field activities and assignments
- Evidence and RouteProof events
- Transactions and collections
- Remittances and reconciliations
- Invoices and invoice evidence
- Risk assessments and reviews
- Notifications and compliance
- Audit events and authentication sessions

Database integrity is supported through primary keys, foreign keys, unique constraints, indexes, and transactional operations.

Database changes are managed through ordered SQL migration files in:

`backend/database/migrations/`

## 8. Security Architecture

Security-sensitive operations are enforced by the backend rather than relying on frontend controls.

Implemented security mechanisms include:
- JWT-based authentication.
- HTTP-only authentication cookies.
- Role-based access control.
- Organization-level access restrictions.
- Zod request validation.
- Parameterized SQL queries.
- Origin validation for state-changing requests as a CSRF mitigation.
- HTTP-only authentication cookies with SameSite protection.
- Helmet security headers.
- CORS configuration restricted to the configured frontend origin.
- Rate limiting.
- File upload validation.
- Centralized error handling.
- React JSX automatic output escaping for ordinary rendered text.

Authentication cookies use the HttpOnly and SameSite settings, with the Secure flag enabled in production.

The Origin guard validates the Origin header on POST, PUT, PATCH, and DELETE requests against the configured frontend origin. Requests with foreign, malformed, or null origins are rejected with HTTP 403. Safe methods such as GET, HEAD, and OPTIONS are not checked by this middleware. Requests without an Origin header are allowed for non-browser clients.

This is an Origin-based CSRF mitigation, not a token-based CSRF implementation. CORS restricts browser access to the API but is not itself a CSRF protection mechanism.

React JSX automatically escapes ordinary text interpolations rendered in the interface. This protection should not be assumed for unsafe HTML injection APIs or untrusted URL attributes.

Environment-specific configuration and secrets are supplied through environment variables rather than hardcoded application values.

## 9. Data Integrity and Transactions

Repositories use parameterized SQL statements for database operations.

Services coordinate transactions for workflows that modify multiple related records. These operations commit when successful and roll back when an error occurs.

This supports consistency in workflows involving activities, evidence, financial records, invoices, remittances, and reviews.

## 10. Core Operational Workflow

Field Assignment
       |
       v
Field Activity
       |
       v
Evidence Collection
       |
       v
Verification
       |
       v
Risk Assessment
       |
       v
Human Review (when required)
       |
       v
Operational Decision
       |
       v
Audit Trail

Major modules support different parts of this workflow:

- **RouteProof:** Supports field activity and location evidence.
- **FieldLedger:** Supports collection, remittance, and reconciliation workflows.
- **InvoiceGuard:** Supports invoice verification and risk evaluation.
- **Trust and Reviews:** Support risk assessment and human review.
- **Evidence and Compliance:** Support documentation and compliance workflows.
- **Audit and Notifications:** Support traceability and operational awareness.

## 11. Detailed Architecture Documentation

The following documents provide additional implementation details:

- [System Architecture](docs/architecture/system-architecture.md)
- [API Architecture](docs/architecture/api-architecture.md)
- [Database Architecture](docs/architecture/database-architecture.md)
- [Backend Architecture](backend/docs/architecture/backend-architecture.md)
- [Security Model](docs/security/security-model.md)
- [Testing Strategy](docs/testing/test-strategy.md)

## 12. Development and Deployment

The frontend and backend are developed as separate applications and communicate through the configured API endpoint.

The project supports local development using the documented environment configuration and startup instructions in `README.md`.

Production deployment requires configuring the frontend, backend, database, environment variables, and appropriate hosting infrastructure.
