# Dedicated Admin Account Report

ADMIN EMAIL:
`admin@universitydomain`

ADMIN CREATION METHOD:
Trusted server bootstrap: `cd server` then `npm run admin:bootstrap`. It requires server-only `ADMIN_PASSWORD` of at least 12 characters. The value is hashed with bcryptjs, is never logged, and is not committed or exposed to the client.

ADMIN ROLE:
The bootstrap sets `users.role = 'ADMIN'` and ensures the dedicated user's `user_roles` contains only `ADMIN`. Bootstrap behavior is covered by mock-database tests. The dedicated account is not currently present in the live database.

USER_ROLES:
Bootstrap logic leaves only `ADMIN` on the dedicated account. The live ADMIN role was removed from user ID 2 only; `STUDENT` and `TUTOR` remain. No user, application, profile, subject, or history rows were deleted.

USERS.ROLE:
The prior development account's legacy value remains `STUDENT`, consistent with its remaining roles. Bootstrap sets the dedicated account's legacy value to `ADMIN` when run.

ADMIN LOGIN:
PASS in mocked auth tests: login and `/api/auth/me` returned only ADMIN. A live administrator account was not available for verification.

ADMIN REDIRECT:
PASS in mocked browser check: successful ADMIN login routed to `/dashboard/admin`.

STUDENT ROUTE BLOCKED:
PASS in mocked browser check: ADMIN visiting `/dashboard/student` was redirected to `/dashboard/admin`.

TUTOR ROUTE BLOCKED:
PASS in mocked browser check: ADMIN visiting `/dashboard/tutor` was redirected to `/dashboard/admin`.

ADMIN NAVBAR:
PASS in mocked browser check: only Home, Admin Dashboard, and Logout links/actions were shown, plus the brand link.

PUBLIC ADMIN REGISTRATION:
BLOCKED. Server tests reject both `role: ADMIN` and the reserved email, including uppercase email input. No public account is created.

STUDENT EMAIL VALIDATION:
PASS / unchanged. The existing registration page's university-email validation was not modified.

EXISTING USER ADMIN ROLE REMOVED:
YES. Removed only ADMIN from ID 2 (`224870809@tut4life.ac.za`); retained STUDENT/TUTOR and all user data.

FILES CHANGED:
- `server/adminConfig.js`
- `server/scripts/bootstrapAdmin.js`
- `server/package.json`
- `server/routes/auth.js`
- `server/test/adminBootstrap.test.js`
- `server/test/authRegistration.test.js`
- `client/app/dashboard/student/page.tsx`
- `client/app/dashboard/tutor/page.tsx`
- `AGENTS.md`
- `DEDICATED_ADMIN_ACCOUNT_REPORT.md`

LIVE SETUP STATUS:
DEDICATED ACCOUNT NOT PRESENT. A live read-only query found no `admin@universitydomain` row and no remaining ADMIN role assignments. The server environment has no qualifying `ADMIN_PASSWORD`, so the bootstrap has not been run. Set `ADMIN_PASSWORD` privately in the server environment, then run `npm run admin:bootstrap` from `server/`. Do not send the password through chat.

VERIFICATION:
- `npm test`: 14 tests passed, including stale-role migration, bootstrap, and registration security cases.
- Client ESLint and production build passed.
- Browser account-switch checks passed for ADMIN/student/tutor roles, redirects, and admin navbar contents.
- Live ADMIN revocation on the prior normal account succeeded; no live admin account creation or password reset was performed.