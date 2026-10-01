# SafeLayer QA Checklist

## Baseline
- [ ] Git worktree clean
- [ ] Backend tests pass
- [ ] Frontend lint passes
- [ ] Frontend build passes
- [ ] Production dependency audit passes

## Authentication
- [ ] Login works
- [ ] Invalid login rejected
- [ ] Unauthenticated API requests rejected
- [ ] Logout works
- [ ] Session/token behavior works

## Authorization / RBAC
- [ ] OWNER permissions
- [ ] ADMIN permissions
- [ ] MANAGER permissions
- [ ] FIELD permissions
- [ ] FINANCE permissions
- [ ] AUDITOR permissions
- [ ] Unauthorized actions rejected

## Organization Isolation
- [ ] User cannot access another organization
- [ ] Cross-organization IDs rejected
- [ ] Notifications isolated
- [ ] Compliance records isolated
- [ ] Evidence files isolated
- [ ] Field activity data isolated
- [ ] Invoice data isolated

## Compliance
- [ ] Create requirement
- [ ] List requirements
- [ ] View requirement
- [ ] Update requirement
- [ ] Assign responsible user
- [ ] Upload evidence
- [ ] View evidence
- [ ] Verify evidence
- [ ] Reject evidence
- [ ] Prevent duplicate evidence
- [ ] Prevent invalid evidence files
- [ ] Prevent oversized files
- [ ] Prevent invalid state transitions

## Notifications
- [ ] Notifications load
- [ ] Unread count works
- [ ] Mark one read
- [ ] Mark all read
- [ ] Notification navigation works
- [ ] Notifications remain organization-scoped

## Field Operations
- [ ] Create activity
- [ ] Assign activity
- [ ] Field user sees assigned activity
- [ ] Status transitions work
- [ ] Activity data remains organization-scoped

## Evidence
- [ ] Upload
- [ ] Retrieve
- [ ] Verify
- [ ] Reject
- [ ] Invalid file rejected
- [ ] Protected file access works

## Invoice Guard
- [ ] Create invoice
- [ ] Verify invoice
- [ ] Review workflow works
- [ ] Atomic rollback works

## Security
- [ ] Validation works
- [ ] Rate limiting works
- [ ] Helmet/security headers work
- [ ] SQL injection resistance
- [ ] Organization isolation
- [ ] RBAC enforcement
- [ ] Protected uploads
- [ ] File signature validation
- [ ] Duplicate file protection

## UI
- [ ] Dashboard
- [ ] Field Operations
- [ ] Evidence
- [ ] Route Proof
- [ ] Field Ledger
- [ ] Invoice Guard
- [ ] Reviews
- [ ] Risk & Trust
- [ ] Reports
- [ ] Compliance
- [ ] Notifications
- [ ] Search
- [ ] Logout
