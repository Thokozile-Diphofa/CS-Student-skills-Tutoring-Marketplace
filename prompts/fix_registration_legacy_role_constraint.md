# Implementation Prompt: Fix Registration Legacy Role Constraint

## Objective
Fix public student registration failing because the live legacy `users.role` column is NOT NULL, while preserving `user_roles` as the single authoritative role system and retaining existing users' role data.

## Findings
- The checked-in `server/schema.sql` defines `users` without a `role` column and defines `user_roles(user_id, role)` with the composite primary key and role check.
- Runtime schema initialization in `server/routes/auth.js` likewise creates `users` without `role` and creates `user_roles` with STUDENT/TUTOR/ADMIN.
- The live database still has a legacy `users.role VARCHAR` column with NOT NULL and a STUDENT/TUTOR/ADMIN check, and no default. Registration omits this column, which causes the reported NULL constraint error.
- Runtime role reads and authorization use `getEffectiveRoles` from `user_roles`; the only `users.role` read is the migration copying legacy values into `user_roles`.
- Public registration accepts only STUDENT/TUTOR intent but intentionally writes only STUDENT to `user_roles`; choosing TUTOR does not grant tutor access.
- Existing data includes an approved TUTOR whose email is unverified, as well as ADMIN and STUDENT roles. Preserve existing role assignments and tutor approval behavior.

## Scope and Required Changes
- Keep `user_roles` authoritative. Do not drop `users.role` or its check constraint, and do not dual-write new registrations into a role field that cannot represent multiple roles.
- Extend the existing idempotent initialization/migration: when the legacy `users.role` column exists, first copy its non-null values to `user_roles` with conflict-safe insertion, then drop only the legacy column's NOT NULL requirement. Preserve existing stored values. New registrations may leave the legacy column NULL; effective roles continue to come from `user_roles`.
- Ensure a migration failure aborts initialization/registration rather than being logged and then ignored. Keep the migration safe to retry.
- Make registration atomic: create the `users` row and its `STUDENT` row in `user_roles` inside one database transaction. Roll back both on failure. Keep the public ADMIN rejection before any insert. Keep TUTOR selection from granting tutor access; only existing application approval grants TUTOR.
- Preserve existing account/password behavior, ADMIN assignments, approved tutor role resolution, login, `/api/auth/me`, and authorization middleware. Do not change dashboard code, add tables, or create accounts.
- Do not apply any schema/database migration to the configured database during implementation without separately approved execution; the code migration should run through the existing initialization path on normal startup.

## Verification
- Add or reuse focused checks for the migration path with and without a legacy `users.role`, including preservation of old roles and repeated initialization.
- Verify failed role insertion rolls back the new user row.
- Run Node syntax checks and available server/client lint/build checks.
- Verify public ADMIN registration remains rejected and TUTOR-intent registration assigns only STUDENT.
- Do not create a persistent test account in the configured database without explicit user approval. If the database environment blocks integration tests, report the limitation and provide exact manual test steps.
- Produce the requested report with root cause, chosen authoritative role system, `users.role` purpose, fix, registration/login/admin/tutor verification, migration details, files changed, and any remaining limitations. Distinguish checked-in code/schema from live database state.