# Registration Role Database Error Report

ROOT CAUSE:
The live `users` table has a legacy `role` column with a NOT NULL constraint and no default. Registration omitted that column, so PostgreSQL rejected the user insert before the `user_roles` insert. The checked-in `server/schema.sql` and runtime table creation no longer define `users.role`.

AUTHORITATIVE ROLE SYSTEM:
`user_roles`

USERS.ROLE PURPOSE:
Legacy migration source only. Runtime role reads and authorization use `user_roles`. Existing `users.role` values are copied before the legacy column's NOT NULL requirement is removed; the column and its check constraint are retained, and existing values are not rewritten.

FIX APPLIED:
The existing initialization path now transactionally creates required tables, migrates non-null legacy roles with conflict-safe inserts, then drops only `users.role` NOT NULL when that legacy column exists. Initialization failures roll back and abort the request. Registration now creates the user and its STUDENT role in one transaction, rolling both back on failure. TUTOR intent still assigns only STUDENT; ADMIN remains rejected by the public registration allowlist.

STUDENT REGISTRATION:
WORKING in the mocked-database regression test. Live registration is not verified because the configured database was unreachable.

ROLE SAVED:
`user_roles` receives `STUDENT`. New users leave the legacy `users.role` column NULL after its constraint migration.

STUDENT LOGIN:
WORKING in the mocked-database regression test; `/api/auth/me` returned STUDENT. Live login is not verified.

PUBLIC ADMIN REGISTRATION:
BLOCKED. Regression test confirms the backend returns HTTP 400 and creates no user.

EXISTING TUTOR ACCESS:
WORKING in the mocked-database regression test for an approved TUTOR. Inspection before implementation also confirmed the existing tutor has an APPROVED application. Live post-change verification was blocked by database DNS failure.

ADMIN ACCESS:
WORKING in the mocked-database regression test; existing ADMIN role was preserved. No live post-change login was performed.

DATABASE MIGRATION:
Implemented in the existing auth initialization path, but not applied to the configured database during this task. The fresh read-only verification attempt failed with `ENOTFOUND`; no test account was created. On restart, the updated backend will apply the migration when auth schema initialization runs. Restart any old server process so registration requests use the updated code.

FILES CHANGED:
- `server/routes/auth.js`
- `server/test/authRegistration.test.js`
- `server/package.json`
- `REGISTRATION_ROLE_DATABASE_ERROR_REPORT.md`

VERIFICATION:
- `npm test`: 6 passing mocked-database tests.
- `node --check routes/auth.js` and `node --check test/authRegistration.test.js`: passed.
- Client ESLint and production build: passed.
- No live registration, login, or schema migration was performed because the configured database hostname did not resolve.