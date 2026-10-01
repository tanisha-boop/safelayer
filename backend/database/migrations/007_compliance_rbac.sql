USE safelayer;

-- ============================================================
-- SAFE LAYER COMPLIANCE RBAC
-- ============================================================

INSERT INTO permissions (name, description)
VALUES
    ('compliance:create', 'Create compliance requirements'),
    ('compliance:read', 'View compliance requirements and evidence'),
    ('compliance:update', 'Update compliance requirements'),
    ('compliance:verify', 'Verify or reject compliance evidence');


-- MANAGER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.name = 'MANAGER'
AND p.name IN (
    'compliance:create',
    'compliance:read',
    'compliance:update',
    'compliance:verify'
);


-- FINANCE
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.name = 'FINANCE'
AND p.name IN (
    'compliance:read',
    'compliance:verify'
);


-- AUDITOR
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.name = 'AUDITOR'
AND p.name IN (
    'compliance:read'
);

-- OWNER gets every Compliance permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.name = 'OWNER'
AND p.name IN (
    'compliance:create',
    'compliance:read',
    'compliance:update',
    'compliance:verify'
);

-- ADMIN gets every Compliance permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.name = 'ADMIN'
AND p.name IN (
    'compliance:create',
    'compliance:read',
    'compliance:update',
    'compliance:verify'
);