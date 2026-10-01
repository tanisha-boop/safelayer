# SafeLayer QA Bugs

## Open

None.

## Resolved

### 1. Incomplete database migration chain
- **Issue:** The repository migration history did not contain the foundational tables required by the application schema.
- **Impact:** A fresh database could not reliably reproduce the application's database architecture.
- **Resolution:** Restored the foundational schema to `001_initial_schema.sql` and missing core tables to `002_safelayer_core.sql`.
- **Verification:** All migrations `001` through `008` successfully execute against a clean scratch database and produce 25 tables.

### 2. Notification navigation
- **Issue:** Clicking a notification did not consistently navigate to the related application module.
- **Impact:** Users could receive notifications without being taken to the relevant record/module.
- **Resolution:** Added entity-type-to-page navigation handling and notification read-state updates.
- **Verification:** Browser end-to-end navigation confirmed working.

### 3. Compliance test upload cleanup
- **Issue:** Integration-test cleanup did not remove physical files created by Multer.
- **Impact:** Repeated test execution could leave orphaned upload files.
- **Resolution:** Updated test cleanup to remove physical evidence files before deleting test records.
- **Verification:** Storage audit confirmed no real orphaned or missing evidence files.

### 4. Frontend lint dependency issues
- **Issue:** Several React effects had incomplete dependency declarations.
- **Impact:** ESLint warnings/errors could indicate unreliable effect behavior.
- **Resolution:** Corrected effect dependency arrays in affected frontend components.
- **Verification:** `npm run lint` passes cleanly.

### 5. Backend dependency vulnerabilities
- **Issue:** Backend dependencies required security updates.
- **Impact:** Production dependency audit reported dependency security concerns.
- **Resolution:** Updated `multer`, `ip-address`, and related dependency versions.
- **Verification:** `npm audit --omit=dev` reports 0 vulnerabilities.
