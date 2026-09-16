# SafeLayer Capstone Subject Mapping

SafeLayer integrates multiple software engineering and information systems concepts into one full-stack application.

## Advanced Database

SafeLayer demonstrates database concepts through:

- relational schema design
- primary keys
- foreign keys
- unique constraints
- indexes
- normalized entities
- junction tables
- transaction handling
- migration-based schema evolution
- organization-scoped records
- RBAC relationships
- audit data
- evidence metadata

Relevant implementation areas:

```text
backend/database/
backend/src/repositories/

Integrative Programming

SafeLayer demonstrates integration between multiple application layers:

React
  ↓
REST API
  ↓
Express
  ↓
Services
  ↓
Repositories
  ↓
MySQL

Relevant areas include:

REST API development
authentication
RBAC
business services
file uploads
notifications
search
reporting
trust assessment
review workflows
Systems Integration Architecture

The system demonstrates:

layered architecture
modular backend design
API integration
authentication integration
database integration
frontend/backend separation
notification event processing
evidence workflows
operational workflow integration

The application is designed as one connected operational system rather than isolated CRUD screens.

Web Systems

The React frontend demonstrates:

component-based UI
routing through application state
API communication
forms
authentication flows
dashboards
operational tables
filters
responsive layouts
dark mode
module-specific interfaces
Security

Security concepts appear across the system:

password hashing
authentication
HTTP-only cookies
authorization
input validation
rate limiting
security headers
file validation
auditability
organization isolation
Overall Integration

The strongest demonstration of subject integration is the SafeLayer workflow:

Field Assignment
      ↓
Field Activity
      ↓
Evidence
      ↓
Verification
      ↓
Trust / Risk
      ↓
Human Review
      ↓
Operational Outcome
      ↓
Audit Trail
      ↓
Reports / Notifications

This workflow requires coordinated database structures, backend business logic, REST APIs, security controls, and frontend interfaces.