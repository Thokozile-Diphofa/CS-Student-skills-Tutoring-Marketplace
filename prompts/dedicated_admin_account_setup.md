# Implementation Prompt: Dedicated EasyLearning Administrator

## Objective
Create a trusted, repeatable setup path for the dedicated `admin@universitydomain` account, keep its legacy and normalized roles synchronized, protect it from public registration, and remove only the prior development ADMIN assignment from the existing normal account while preserving its other roles and data.

## Existing Behavior and Constraints
- The current auth route writes `users.role = 'STUDENT'` and inserts `STUDENT` into `user_roles` for every public account. Preserve this synchronization for public registration.
- `user_roles` is the authoritative multi-role system used by `getEffectiveRoles`, JWT issuance, `/api/auth/me`, and role middleware. `users.role` is a legacy single-role compatibility field.
- Public registration already rejects role values other than STUDENT/TUTOR. It must additionally reject the reserved dedicated admin email regardless of requested public role, case-insensitively.
- Do not add ADMIN to the registration UI, weaken student university-email validation, or change login's role-based authorization into an email-based bypass.
- Login already routes ADMIN before TUTOR/STUDENT; the navbar already renders only Home, Admin Dashboard, Logout when ADMIN is present.
- Student and tutor dashboard guards currently allow access if their role is present, even when ADMIN is also present. Check ADMIN first and redirect to `/dashboard/admin` so admin access is denied to those dashboards even for a mixed-role account.
- The live database could not be reached during inspection, so current target-email existence and current other ADMIN assignments must be queried again by the trusted setup process at execution time. A prior development account was observed with STUDENT/TUTOR/ADMIN; preserve the database's actual state, not stale assumptions.

## Implementation Scope

### 1. Reserve the Dedicated Email
- Add one server-only shared constant for `admin@universitydomain` and use it in the registration route and trusted setup script.
- Normalize the request email before comparison. Reject this exact reserved email through public registration even when a request asks for STUDENT or omits `role`; also keep rejecting `role: ADMIN`.
- Do not add any email exception to public registration or the student university-email validation UI. The bootstrap process bypasses registration entirely.

### 2. Trusted Bootstrap (`server/scripts/bootstrapAdmin.js`)
- Add an idempotent, server-side setup script using the existing `db`, `bcryptjs`, schema, and `user_roles` architecture. Add an `npm run admin:bootstrap` command.
- Require `ADMIN_PASSWORD` from the server process environment. Do not use `NEXT_PUBLIC_` variables, print/log the value, embed it in source, or write it to a file. Hash it with the existing bcryptjs dependency.
- Use the exact reserved email. Inside one transaction, create or provision the dedicated account with required existing `users` fields, set `users.role = 'ADMIN'`, and ensure `user_roles` contains exactly `ADMIN` for that account. Preserve any existing user row and related profile/application/history data; do not delete the user or linked data.
- Inspect live schema in the script and fail safely if required tables/columns are missing. The current live schema includes `users.role`; keep it synchronized to ADMIN. Do not create role tables.
- For non-target accounts with ADMIN, remove only the ADMIN row from `user_roles`. Preserve STUDENT/TUTOR rows and all user/application/profile/history records. Update the legacy single-role value to a surviving legitimate role (prefer STUDENT, otherwise an existing TUTOR); do not manufacture roles.
- Revoke the development ADMIN from the non-target account only when it can be identified unambiguously. If multiple non-target ADMIN accounts or an inconsistent role state makes that unsafe, roll back and report the accounts requiring explicit review instead of revoking them all.
- Make reruns safe: do not duplicate users or roles; reset only the dedicated account password from the supplied environment value; do not alter unrelated account passwords.
- On success, log only non-secret outcomes such as account email/role changes. Never log passwords or hashes.

### 3. Route Guards and Existing Authentication
- Keep backend role authorization database-backed. The dedicated account must authenticate through existing login, and `/api/auth/me` must return roles derived from `user_roles`; its dedicated account should return only `ADMIN`.
- In both student and tutor dashboard role checks, route any ADMIN user to `/dashboard/admin` before accepting STUDENT/TUTOR dashboard access.
- Do not add a second authentication system or email-equality authorization rule. ADMIN permission still requires the role in the database.
- Leave the existing admin login redirect and admin navbar design intact unless tests show they do not meet the requested behavior.

### 4. Tests and Required Report
- Add regression tests for reserved-email registration rejection for both STUDENT and ADMIN payloads, STUDENT public registration synchronization, and existing TUTOR/ADMIN role preservation in the trusted setup logic where practical.
- Test that ADMIN-only users are redirected away from both student and tutor dashboards, and that login prioritizes `/dashboard/admin`.
- Run server tests, server syntax checks, client lint, and production build.
- Execute the bootstrap against the configured database only if `ADMIN_PASSWORD` is already configured server-side and the DB is reachable. Never request or print the password. Do not create a persistent account with a placeholder/generated password. If either prerequisite is missing, leave the script ready and report that account creation is pending secure environment setup.
- Produce the requested status report covering admin email, creation method, role set, legacy value, login, redirects, registration blocking, prior account ADMIN removal, files changed, and any blocked checks. Distinguish code/mock tests from live account verification.