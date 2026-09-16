# SafeLayer API Architecture

## API Design

SafeLayer exposes a REST-style HTTP API consumed by the React frontend.

The frontend communicates through:

```text
frontend/src/services/api.js

The centralized API client handles:

HTTP requests
JSON serialization
FormData uploads
authentication cookies
response parsing
common error handling
Request Flow
Frontend Component
       ↓
services/api.js
       ↓
HTTP Request
       ↓
Express Route
       ↓
Middleware
       ↓
Controller
       ↓
Service
       ↓
Repository
       ↓
MySQL
Endpoint Groups

SafeLayer currently organizes endpoints around major operational domains:

/auth
/users
/organizations
/activities
/evidence
/route-proof
/field-ledger
/invoices
/reviews
/trust
/audit
/notifications
/dashboard
/reports
/search
Authentication

Authentication endpoints establish the authenticated user session.

Protected requests use authentication credentials supplied through HTTP-only cookies.

Authorization

Authentication establishes identity.

Authorization determines whether the authenticated user can perform a particular operation.

The backend uses role-based authorization middleware to enforce access rules.

Validation

Incoming request data is validated before business logic executes.

Validation protects service-layer logic from malformed or unexpected input.

Error Handling

The API uses centralized error handling so that controllers do not need to duplicate the complete response strategy.

Common HTTP outcomes include:

200  Successful request
201  Resource created
400  Invalid request
401  Unauthenticated
403  Unauthorized
404  Resource not found
409  Conflict
500  Internal server error
File Uploads

Evidence uploads are handled separately from ordinary JSON requests.

The upload pipeline includes:

Multipart Request
      ↓
Upload Middleware
      ↓
File Validation
      ↓
Storage
      ↓
Evidence Record
      ↓
Hash / Verification Workflow
API Security

API protection includes:

authentication
role-based authorization
input validation
rate limiting
security headers
organization-level data isolation
controlled file access
centralized error handling