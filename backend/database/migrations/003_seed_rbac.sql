USE safelayer;

-- ============================================================
-- SAFE LAYER RBAC SEED DATA
-- ============================================================

INSERT INTO roles (name, description)
VALUES
    ('OWNER', 'Organization owner with full system access'),
    ('ADMIN', 'System administrator'),
    ('MANAGER', 'Operations manager'),
    ('FIELD_WORKER', 'Employee performing field activities'),
    ('FINANCE', 'Financial operations user'),
    ('AUDITOR', 'Read-only audit and investigation user');


INSERT INTO permissions (name, description)
VALUES
    ('organization:read', 'View organization information'),
    ('organization:update', 'Update organization information'),

    ('users:create', 'Create users'),
    ('users:read', 'View users'),
    ('users:update', 'Update users'),
    ('users:deactivate', 'Deactivate users'),

    ('activities:create', 'Create field activities'),
    ('activities:read', 'View field activities'),
    ('activities:update', 'Update field activities'),
    ('activities:assign', 'Assign field activities'),

    ('evidence:create', 'Upload evidence'),
    ('evidence:read', 'View evidence'),

    ('transactions:create', 'Create financial transactions'),
    ('transactions:read', 'View financial transactions'),
    ('transactions:update', 'Update financial transactions'),

    ('remittances:create', 'Submit remittances'),
    ('remittances:read', 'View remittances'),
    ('remittances:verify', 'Verify remittances'),

    ('invoices:create', 'Submit invoices'),
    ('invoices:read', 'View invoices'),
    ('invoices:review', 'Review invoices'),

    ('reviews:create', 'Create reviews'),
    ('reviews:read', 'View reviews'),
    ('reviews:resolve', 'Resolve reviews'),

    ('audit:read', 'View audit events')
;


-- OWNER gets every permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    r.id,
    p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'OWNER';


-- ADMIN gets every permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    r.id,
    p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'ADMIN';


-- MANAGER permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    r.id,
    p.id
FROM roles r
JOIN permissions p
WHERE r.name = 'MANAGER'
AND p.name IN (
    'organization:read',
    'users:read',
    'activities:create',
    'activities:read',
    'activities:update',
    'activities:assign',
    'evidence:read',
    'transactions:read',
    'remittances:read',
    'remittances:verify',
    'invoices:read',
    'invoices:review',
    'reviews:create',
    'reviews:read',
    'reviews:resolve',
    'audit:read'
);


-- FIELD WORKER permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    r.id,
    p.id
FROM roles r
JOIN permissions p
WHERE r.name = 'FIELD_WORKER'
AND p.name IN (
    'organization:read',
    'activities:read',
    'evidence:create',
    'evidence:read',
    'transactions:create',
    'transactions:read',
    'remittances:create',
    'remittances:read',
    'invoices:create'
);


-- FINANCE permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    r.id,
    p.id
FROM roles r
JOIN permissions p
WHERE r.name = 'FINANCE'
AND p.name IN (
    'organization:read',
    'activities:read',
    'evidence:read',
    'transactions:create',
    'transactions:read',
    'transactions:update',
    'remittances:read',
    'remittances:verify',
    'invoices:create',
    'invoices:read',
    'invoices:review',
    'reviews:create',
    'reviews:read',
    'reviews:resolve',
    'audit:read'
);


-- AUDITOR permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    r.id,
    p.id
FROM roles r
JOIN permissions p
WHERE r.name = 'AUDITOR'
AND p.name IN (
    'organization:read',
    'users:read',
    'activities:read',
    'evidence:read',
    'transactions:read',
    'remittances:read',
    'invoices:read',
    'reviews:read',
    'audit:read'
);