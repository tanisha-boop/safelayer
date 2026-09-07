# SafeLayer Database

SafeLayer uses MySQL as its primary relational database.

## Migration Structure

Database changes are stored as versioned SQL migrations.

Example:

- `001_initial_schema.sql`
- `002_safelayer_core.sql`
- `003_seed_rbac.sql`

## Design Principles

The database uses:

- Primary keys
- Foreign keys
- Unique constraints
- Composite indexes
- Junction tables for many-to-many relationships
- Transactions where multiple related records must change atomically
- JSON only where data is variable or semi-structured
- Normalized relational data for core business entities

## Core Relationship

Organization
→ Users
→ Field Activities
→ Evidence
→ Transactions
→ Risk Assessments
→ Reviews
→ Audit Events

## RBAC

Authorization uses:

User
→ User Roles
→ Roles
→ Role Permissions
→ Permissions

This allows permissions to be changed without changing application code or database enums.