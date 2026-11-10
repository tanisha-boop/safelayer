# SafeLayer Security Model

## Security Objectives

SafeLayer is designed around:

1. authenticated access
2. authorized operations
3. organization isolation
4. validated input
5. controlled file handling
6. traceability
7. secure session handling

## Authentication

Passwords are hashed using bcrypt.

Authentication uses signed access tokens.

Authentication credentials are delivered through HTTP-only cookies so application JavaScript does not need direct access to the authentication token.

## Authorization

SafeLayer implements role-based access control.

The architecture separates:

```text
Authentication
    ↓
Who is the user?

Authorization
    ↓
What may the user do?

Roles and permissions are represented relationally.

Organization Isolation

Operational records are associated with organizations.

Backend authorization and repository logic are responsible for ensuring that users cannot access unrelated organization data.

Input Validation

Structured request validation is implemented using Zod validators.

Validation is applied at the API boundary before business logic processes incoming data.

File Security

Evidence uploads are processed through dedicated upload middleware.

File handling includes validation and hashing.

The goal is to avoid treating uploaded files as automatically trustworthy input.

## Database Query Security

Database repositories use parameterized SQL statements for operations involving user-supplied values.

Values are passed separately from SQL statements through database driver parameters rather than being concatenated into SQL strings. This helps prevent SQL injection through those parameterized values.

## Cross-Site Request Forgery Mitigation

The backend uses an Origin guard for state-changing HTTP methods: POST, PUT, PATCH, and DELETE.

The middleware compares the request Origin against the configured frontend origin. Foreign, malformed, and null origins are rejected with HTTP 403.

GET, HEAD, and OPTIONS requests are not checked by this middleware. Requests without an Origin header are allowed to support non-browser clients.

This is an Origin-based CSRF mitigation. SameSite cookie settings provide an additional layer of protection. CORS restricts browser access to the API but is not itself CSRF protection.

SafeLayer does not currently implement a synchronizer-token or double-submit-token CSRF mechanism. The Origin guard should therefore not be described as token-based CSRF protection.

## Output Escaping

The React frontend uses JSX, which automatically escapes ordinary text interpolations before rendering them into the page.

The frontend should avoid inserting untrusted content through unsafe HTML APIs such as dangerouslySetInnerHTML unless that content has been appropriately sanitized.

Automatic JSX escaping does not make every context safe. Untrusted URL attributes and other security-sensitive rendering contexts still require appropriate validation.

Rate Limiting

Rate limiting is applied to reduce abuse of API endpoints, particularly authentication-related operations.

Security Headers

Helmet is used to apply security-related HTTP headers.

Auditability

Important system actions can produce audit records.

Auditability allows authorized users to investigate operational changes and understand what occurred within the system.

Error Handling

The application uses centralized error handling to avoid exposing unnecessary internal implementation details through inconsistent error responses.

Secrets

Environment-specific credentials and secrets are stored in .env files.

These files are excluded from Git through .gitignore.

Example configuration files are provided without real credentials.

Security Limitations

SafeLayer is an academic and portfolio implementation.

Production deployment would require additional controls such as:

managed secret storage
production TLS configuration
centralized monitoring
infrastructure hardening
backup and disaster recovery
dependency vulnerability management
production database access controls
penetration testing