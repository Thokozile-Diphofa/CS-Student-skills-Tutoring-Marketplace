# Implementation Prompt: Change 11 — Admin Dashboard

## Objective
Complete the EasyLearning Admin Dashboard by integrating with the existing users, roles, tutor applications, tutor profiles, subjects, and PostgreSQL database. Preserve the current authentication architecture and the established `/dashboard/admin` route.

## Existing Architecture and Constraints
- Continue using the existing `users` and `user_roles` tables, JWT cookie authentication, `authenticateToken`, and `requireRole("ADMIN")` middleware.
- Continue using `tutor_applications`, `tutor_profiles`, and `tutor_skills`; do not create parallel user, tutor, or application tables.
- Public registration already allows only STUDENT/TUTOR intent and creates STUDENT access. Preserve/enforce the server-side rejection of ADMIN registration; never grant ADMIN from public input.
- Existing tutor application GET and review routes are ADMIN-protected. Review transitions already lock the application row and allow only PENDING applications to be reviewed. Preserve that server-side transition safety.
- Tutor approval must not depend on email verification. Do not set `email_verified_at` or claim the address is verified. Approved application status must be the source of tutor eligibility across effective-role lookup, tutor dashboards/profiles, and public tutor discovery.
- Do not change unrelated in-progress edits or introduce unrelated features.

## Implementation Scope

### 1. Admin Dashboard UI (`client/app/dashboard/admin/page.tsx`)
- Keep this route inaccessible to non-admin users: verify the current session with `/api/auth/me`, redirect unauthenticated users to login, and redirect authenticated non-admin users to their existing student/tutor destination.
- Replace the placeholder account/isolation cards with a responsive EasyLearning dashboard containing:
  - Database-backed overview totals: users, students, approved tutors, pending tutor applications.
  - Tutor Applications with All/Pending/Approved/Rejected filters. Make pending applications easy to identify.
  - An individual application detail view showing applicant name/email, institution, programme, year, subjects, experience, motivation, proposed hourly rate, submitted date, status, and rejection reason where present.
  - Approve and Reject actions only for PENDING applications. Require a short rejection reason if using the existing API contract, show server errors, and refresh the affected data after success.
  - A read-only Users list with name, email, roles, and creation date.
  - An Approved Tutors list using existing profile/skill data, including name/email, subjects, hourly rate, and approval status.
- Include loading, empty, success, and error states for API-backed dashboard data. Keep tables usable on small screens and consistent with the existing EasyLearning styling.
- Do not add destructive user management, payments, moderation, analytics, notifications, or module approval.

### 2. Admin Dashboard API
- Add a narrowly scoped admin dashboard endpoint, mounted under `/api`, protected by `authenticateToken` followed by `requireRole("ADMIN")`.
- Return server-backed overview counts, a safe read-only user list, and approved tutor/profile/skill data from the existing tables. Never select or serialize `password_hash` or other secrets.
- Keep the existing `/api/tutor-applications` and `PATCH /api/tutor-applications/:id/review` contracts for application listing and state changes; do not duplicate review logic in the new endpoint.
- Preserve 401 for missing/invalid authentication and 403 for authenticated non-admin users on every admin endpoint. Update the documented API route list after adding the endpoint.
- Counts must be SQL/database-derived. Because a person can hold STUDENT and TUTOR simultaneously, count users distinctly and define student/tutor totals by their respective roles rather than assuming categories are mutually exclusive.

### 3. Approval Eligibility and Messaging
- Remove the email-verification prerequisite from the existing admin approval transition without marking email as verified.
- Update effective tutor-role resolution and tutor discovery/profile provisioning queries so an application with status APPROVED grants tutor access regardless of `email_verified_at`; rejected and pending applicants remain ineligible.
- Keep rejection server-validated and do not grant tutor role/profile eligibility for REJECTED applications.
- Update the applicant-facing pending status copy so it does not falsely state that email verification blocks approval. Email verification remains unimplemented and must not be simulated.

### 4. Role-Aware Shared Navigation (`client/app/components/Navbar.tsx`)
- Make navigation session-aware using the existing `/api/auth/me` endpoint and application status where needed; do not trust localStorage for authorization.
- For ADMIN, show only `Home | Admin Dashboard | Logout` and never show public/student/tutor navigation or calls to action.
- For STUDENT, PENDING applicant, and approved TUTOR, follow the exact role-specific navigation in the feature request. Show the admin link only when `/api/auth/me` returns ADMIN.
- Add the shared navbar to the Admin Dashboard and use the existing logout API/cookie flow. Clear only the app's known local-storage keys, refresh role-aware navigation after logout, and ensure the admin page redirects after the cookie is cleared.
- Keep public navigation intact for signed-out visitors and avoid exposing an admin link while session status is unknown.

### 5. Public Registration Safety
- Verify that both the registration UI and API refuse ADMIN registration. The backend remains authoritative; preserve the current server allowlist even if the frontend is changed.
- Do not add an admin creation route or other way to self-assign ADMIN.

## Verification and Required Report
- Run client lint and production build; run Node syntax checks for changed server files.
- Exercise admin, student, tutor, pending applicant, and signed-out navigation/access states.
- Verify the admin dashboard endpoint returns 401 without authentication and 403 for authenticated non-admin users; verify ADMIN can load it.
- Verify a public registration request asking for ADMIN is rejected by the backend.
- Verify pending applications appear, approval changes status and enables tutor access/search/profile without changing email verification, rejection changes status without granting tutor access, and repeated review returns a conflict.
- Check responsive dashboard behavior and inspect that API responses contain no password hashes.
- No implementation report currently exists in the repository. Create `ADMIN_DASHBOARD_IMPLEMENTATION_REPORT.md` with the requested checklist, using verified `WORKING` / `NOT WORKING` results for: dashboard, role protection, public admin registration block, pending visibility, approval, rejection, approved tutor access, user list, tutor list, logout, and API authorization. Also list files changed, database changes, and remaining issues. Do not claim unverified behavior as working; identify any test blocked by missing database/environment.
- Stop after this feature and report exact test steps and results.