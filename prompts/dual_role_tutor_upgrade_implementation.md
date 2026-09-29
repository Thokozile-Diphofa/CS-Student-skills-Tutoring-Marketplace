# Implementation Prompt: EasyLearning Dual-Role & Tutor Upgrade System

## Objective
Update the existing EasyLearning authentication and authorization system so that a single user account can hold both `STUDENT` and `TUTOR` roles simultaneously without creating duplicate user records or resetting passwords.

## Core Requirements & Business Rules
1. **One Email = One User Account**:
   - Never create duplicate user records for the same email.
   - Preserve existing bcrypt password hashes, user IDs, and profile data.
2. **Normalized Multi-Role Database Structure**:
   - Migrate single-role storage (`users.role`) to normalized `user_roles` table (`user_id`, `role`, PRIMARY KEY `(user_id, role)`).
   - Safely populate `user_roles` from existing `users` table without data loss.
3. **Registration Rules**:
   - `New Student`: Creates account in `users`, inserts `STUDENT` into `user_roles`.
   - `New Tutor`: Creates account in `users`, inserts `STUDENT` and `TUTOR` into `user_roles`.
   - `Unauthenticated Duplicate Email`: If registration email already exists, reject request with a clear security message: *"An account with this email already exists. Please log in to your account to add the Tutor role."*
4. **Authenticated Tutor Upgrade Endpoint (`POST /api/auth/upgrade-tutor`)**:
   - Requires proof of ownership (authenticated session via `authenticateToken`).
   - If user already has `TUTOR` role, returns *"Your account is already registered as a tutor."*
   - Otherwise, inserts `TUTOR` into `user_roles` for the authenticated user, issues an updated JWT cookie, and returns updated roles `["STUDENT", "TUTOR"]`.
5. **Multi-Role Login & Token Payload**:
   - Returns user object with `roles: ["STUDENT", "TUTOR"]` (or single role array).
   - JWT payload contains `{ id, email, roles: string[] }`.
6. **Role Redirection & Dashboard Access**:
   - Student Dashboard requires `roles.includes("STUDENT")`.
   - Tutor Dashboard requires `roles.includes("TUTOR")`.
   - Admin Dashboard requires `roles.includes("ADMIN")`.
   - Dual-role users (`STUDENT + TUTOR`) can access both Student and Tutor dashboards, with an active switch toggle on the header ("Switch to Tutor Dashboard" / "Switch to Student Dashboard").
   - `ADMIN` role remains strictly isolated and cannot be acquired via public registration or tutor upgrade.

## Verification Steps
1. Test schema migration on PostgreSQL/Neon DB.
2. Test new STUDENT registration (verify `roles: ["STUDENT"]`).
3. Test new TUTOR registration (verify `roles: ["STUDENT", "TUTOR"]`).
4. Test login with existing account (verify roles array returned in response and JWT).
5. Test authenticated upgrade of STUDENT account to TUTOR (verify single DB user record retained, same user ID, password preserved, roles become `["STUDENT", "TUTOR"]`).
6. Test duplicate upgrade attempt (verify *"Your account is already registered as a tutor."* response).
7. Test unauthenticated upgrade attempt via registration page (verify rejection without granting role).
8. Test dashboard access for dual-role user (verify access to `/dashboard/student` and `/dashboard/tutor`, blocked from `/dashboard/admin`).
