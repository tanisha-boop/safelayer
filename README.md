# SafeLayer

## Evidence & Operational Trust Platform

SafeLayer is a full-stack web application designed to help organizations create a reliable operational record of distributed and field-based work.

It connects field activities, evidence, verification, risk assessment, human review, transactions, compliance requirements, notifications, reporting, and audit events into a traceable workflow.

> **Know what happened in the field.**

---

## Problem

Organizations that rely on distributed workers often have operational information spread across different systems, spreadsheets, messages, receipts, uploaded files, and manual reports.

This creates problems such as:

- incomplete field activity records
- weak evidence verification
- unclear responsibility for operational actions
- difficult cash reconciliation
- duplicate or suspicious invoice records
- compliance requirements approaching expiration
- limited visibility into operational risk
- difficulty investigating what happened after a record changes
- fragmented audit information

SafeLayer addresses this by creating a centralized operational trust layer around the organization's existing workflows.

---

## Core Workflow

```text
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
Operational / Financial / Compliance Outcome
    ↓
Audit Trail

Core Modules
Field Operations

Manages field assignments and operational activities.

Capabilities include:

activity creation
assignment
activity lifecycle tracking
start and completion workflows
cancellation
operational status tracking
Evidence

Provides evidence collection and verification around field activities.

Capabilities include:

evidence upload
file validation
file hashing
activity-linked evidence
verification status
verification notes
evidence review
RouteProof

Adds location and time-based proof to field activities.

Capabilities include:

check-in
GPS capture
check-out
activity-linked location records
operational traceability
FieldLedger

Provides operational cash collection and remittance controls.

Capabilities include:

collection records
payment collection
remittance creation
remittance items
verification
reconciliation-oriented workflows
InvoiceGuard

Provides invoice verification and review workflows.

Capabilities include:

invoice records
vendor information
verification
review decisions
review resolutions
Trust Engine

Evaluates operational activity information and produces trust assessment data.

The Trust Engine is designed as decision support. It does not replace authorized human decision-making.

Risk & Trust

Provides visibility into operational risk and trust assessments.

Human Reviews

Provides a controlled workflow for records requiring human investigation or resolution.

Compliance

Provides a compliance control center for operational requirements such as:

permits
certifications
insurance
registrations
accreditation
Notifications

Provides organization-scoped notifications for relevant system events.

Reports

Provides operational reporting and analytical summaries across SafeLayer data.

Audit

Maintains traceable records of important system actions and operational events.

Technology Stack
Frontend
React
Vite
Tailwind CSS
lucide-react
Fetch API
Backend
Node.js
Express
MySQL
mysql2
Zod
JWT
bcrypt
Multer
Helmet
express-rate-limit
Development
VS Code
Git
GitHub
XAMPP/MySQL for local database development
Architecture

SafeLayer uses a layered backend architecture:

React Frontend
      ↓
REST API
      ↓
Routes
      ↓
Controllers
      ↓
Services
      ↓
Repositories
      ↓
MySQL

Cross-cutting concerns are handled through middleware and shared utilities.

Authentication
Authorization
Validation
Rate Limiting
Request Logging
Error Handling
File Validation
Audit Logging

The architecture separates HTTP concerns, business logic, persistence logic, and security controls.

See the architecture documentation:

- [Overall Architecture](ARCHITECTURE.md)
- [System Architecture](docs/architecture/system-architecture.md)
- [Database Architecture](docs/architecture/database-architecture.md)
- [API Architecture](docs/architecture/api-architecture.md)
- [Backend Architecture](backend/docs/architecture/backend-architecture.md)
- [Changelog](CHANGELOG.md)
Security

SafeLayer includes multiple security controls:

password hashing
JWT-based authentication
HTTP-only authentication cookies
role-based authorization
organization isolation
request validation
parameterized SQL queries
Origin-based CSRF mitigation for state-changing requests
restricted CORS configuration
rate limiting
Helmet security headers
React JSX automatic output escaping for ordinary text
file validation
file hashing
controlled evidence access
audit logging
protected state transitions

The Origin guard rejects state-changing browser requests from untrusted origins. Requests without an Origin header are allowed for non-browser clients. This is Origin-based mitigation, not token-based CSRF protection.

See [Security Model](docs/security/security-model.md) for implementation details and limitations.

Database

SafeLayer uses MySQL as its primary relational database.

Database changes are maintained through versioned migrations:

001_initial_schema.sql
002_safelayer_core.sql
003_seed_rbac.sql
004_evidence_enhancement.sql
005_notifications.sql
006_compliance.sql
007_compliance_rbac.sql
008_compliance_duplicate_evidence.sql
009_review_remittance.sql

The database uses:

primary keys
foreign keys
unique constraints
indexes
junction tables
normalized relational structures
transactions
controlled JSON usage where appropriate
Testing

The backend includes an automated Node.js test suite covering authentication, authorization, field operations, evidence, FieldLedger, InvoiceGuard, Trust, Reviews, Audit, and related workflows.

Current verified backend test result:

119 tests
119 passing
0 failing

See Test Strategy.

Project Structure
SafeLayer/
├── backend/
│   ├── database/
│   │   ├── migrations/
│   │   └── README.md
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── repositories/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── validators/
│   ├── test/
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── assets/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── .env.example
│
├── docs/
│   ├── architecture/
│   ├── capstone/
│   ├── security/
│   └── testing/
│
├── .env.example
├── .gitignore
├── ARCHITECTURE.md
├── CHANGELOG.md
└── README.md
Local Development
Backend
cd backend
npm install
npm run dev

The backend API runs on the configured backend port.

Frontend

In another terminal:

cd frontend
npm install
npm run dev

The frontend is served by Vite.

Environment Configuration

Environment files containing secrets are intentionally excluded from Git.

Use the provided examples:

backend/.env.example
frontend/.env.example

Configure local credentials and environment-specific values in local .env files.

Capstone Scope

SafeLayer was developed as a full-stack capstone demonstrating:

relational database design
REST API development
layered software architecture
authentication and authorization
operational workflows
evidence management
transaction controls
risk assessment
human review
auditability
frontend application development
automated testing
security engineering

See:

Project Scope
Subject Mapping
Project Status

SafeLayer currently includes working implementations for:

Authentication
RBAC
Organization management
User management
Field Operations
Evidence
RouteProof
FieldLedger
InvoiceGuard
Trust Engine
Risk assessment
Human Reviews
Audit
Notifications
Dashboard
Reports
Compliance
Search

Further work includes deployment packaging, expanded documentation, architecture diagrams, and presentation/oral-defense preparation.

Disclaimer

SafeLayer is an academic and portfolio software project. Risk assessments, verification workflows, and operational recommendations are intended to support authorized human decisions rather than replace them.