# Implementation Prompt: Fix Stale ADMIN Redirects

## Objective
Stop stale legacy ADMIN values from being reintroduced into `user_roles`, verify that auth and redirects use current normalized roles, and reconcile the prior development ADMIN assignment without deleting user data.

## Findings
- Login redirects from the server-returned `roles` array, prioritizing ADMIN then TUTOR then the requested safe path/default STUDENT dashboard.
- `/api/auth/me` and `authenticateToken` obtain roles from `getEffectiveRoles`, which reads `user_roles`; the signed JWT's role claims and localStorage values are not used for authorization. Logout clears the HttpOnly cookie and known localStorage keys.
- Student and tutor dashboards already check ADMIN first and redirect to `/dashboard/admin`. The admin dashboard checks for ADMIN; the navbar builds role-specific links from `/api/auth/me`.
- The auth schema migration currently copies every non-null `users.role` value into `user_roles` with `ON CONFLICT DO NOTHING`. If a normal account retains legacy `users.role = 'ADMIN'`, initialization can re-add ADMIN even when normalized roles were corrected.
- The configured live database returned `ENOTFOUND` during read-only inspection, so current account role rows and legacy values could not be confirmed.
- A trusted `server/scripts/bootstrapAdmin.js` exists. It provisions the dedicated email and removes ADMIN from exactly one other ADMIN account while preserving STUDENT/TUTOR; it aborts on ambiguous multiple non-dedicated admins.

## Scope and Required Changes
- Make `user_roles` the sole runtime role source. Do not grant access by email and do not treat localStorage or JWT role claims as authoritative.
- Harden legacy backfill so it runs only for accounts with no normalized roles, and never promotes a non-dedicated account's legacy ADMIN value into `user_roles`. Preserve the dedicated admin email's ADMIN value when appropriate. Avoid changing existing valid STUDENT/TUTOR assignments.
- Ensure reconciliation synchronizes a non-dedicated stale legacy `users.role = 'ADMIN'` to an existing legitimate role without changing the user's password, profile, application, subjects, or history. Do not remove STUDENT/TUTOR. If a role state is ambiguous, fail safely and report it for review.
- Use the existing trusted bootstrap transaction to remove a stale non-dedicated ADMIN from `user_roles`; do not alter student/tutor/dashboard access logic unless a regression test demonstrates a gap.
- Keep public ADMIN registration blocked and leave university email validation untouched.
- If the current user_roles or legacy values cannot be queried because DB is unavailable, do not invent the user's current roles or apply a blind cleanup. Keep the migration fix in code and report the live repair as pending.

## Tests
- Add regression coverage proving stale legacy ADMIN is not copied over existing normalized STUDENT/TUTOR roles.
- Prove a non-dedicated legacy ADMIN with no normalized roles cannot receive ADMIN through backfill; preserve a safe normal role.
- Verify dedicated ADMIN and approved TUTOR roles remain unchanged.
- Verify login and `/api/auth/me` reflect database role rows, and the login redirect chooses admin/tutor/student as expected.
- Verify logout followed by a new login uses the new user's server-returned roles.
- Verify student/tutor dashboard guards continue redirecting ADMIN-only users to `/dashboard/admin`.
- Run server tests, syntax checks, client lint/build, and read-only live role queries where reachable. Do not create persistent accounts or alter live roles without explicit approval.

## Report
Return current database roles only if read-only queries succeed. Report role source, legacy migration behavior, redirect/state findings, blocked live checks, files changed, and whether any stale ADMIN row was actually removed. Do not claim database cleanup if the database is unreachable.