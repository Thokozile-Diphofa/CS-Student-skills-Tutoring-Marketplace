# Implementation Prompt: Student and Tutor Dashboards

## Objective
Complete the existing EasyLearning Student Dashboard and Tutor Dashboard, connecting them to the existing authentication and tutor APIs. Continue in this repository; do not scaffold a new project or redesign unrelated pages.

## Findings From Inspection
- Authentication uses an HttpOnly `token` JWT cookie. `GET /api/auth/me` validates the cookie and returns `id`, `firstName`, `lastName`, `university`, `email`, and `roles` from the database.
- Users may hold both `STUDENT` and `TUTOR`; public tutor registration and tutor upgrade assign both roles. Preserve this model. A user with both roles may use both dashboards. A student-only user must not enter the Tutor Dashboard, and a tutor-only user must not enter the Student Dashboard.
- Login currently sends `ADMIN` to `/dashboard/admin`, otherwise `TUTOR` to `/dashboard/tutor`, otherwise to `/dashboard/student`. Preserve this routing and do not build or redesign Admin.
- Both dashboard pages already fetch `/api/auth/me` and redirect based on returned roles. The existing `/api/auth/logout` clears the cookie; dashboards also clear browser local storage.
- Existing tutor endpoints are `GET /api/tutors` (search/filter/list), `GET /api/tutors/:id` (profile), and `PUT /api/tutors/profile` (authenticated tutor profile update). Tutor data uses `users`, `user_roles`, `tutor_profiles`, and `tutor_skills`; the schema already has profile defaults and tutor provisioning. Avoid schema changes unless a demonstrated requirement cannot be met otherwise.
- No session-request, notification, session, or booking endpoints/tables were found. Do not implement these in this task and do not imply an empty database result when the feature/API does not exist.

## Scope
1. Inspect relevant Next.js 16 documentation in the installed `client/node_modules/next/dist/docs/` before making frontend code changes, as required by `client/AGENTS.md`.
2. Keep the existing EasyLearning colors, Navbar, Footer, Tailwind conventions, and current authentication implementation. Reuse existing tutor listing/profile pages and dashboard routes.
3. Improve the Student Dashboard with a live greeting and account details from `/api/auth/me`, responsive navigation to Dashboard, Find Tutors, Profile, and Logout, and useful available information only. Link to the existing tutor search/profile pages and preserve their real backend search/filter behavior. Do not create duplicate navigation components or fake tutor listings.
4. Improve the Tutor Dashboard with a live greeting and account details from `/api/auth/me`, consistent navigation to Dashboard, My Profile, Session Requests, and Logout, and actual tutoring profile data from existing tutor endpoints. Display name, email, subjects, hourly rate, and bio/headline when returned by the API. Do not invent profile values in the frontend.
5. Keep each dashboard's server-backed `/api/auth/me` role check. A student-only user is denied the tutor dashboard; a tutor-only user is denied the student dashboard; dual-role accounts are allowed both per the product contract. Do not trust a URL, local storage, or user-submitted role as authorization. Preserve ADMIN routing and existing server-side JWT/role middleware. Add a narrowly scoped server-side role-protected read endpoint only if needed to retrieve the current tutor's own profile; do not rebuild authentication.
6. Use actual available tutor results for the available-tutors count if included. Do not show invented pending requests, accepted sessions, tutor requests, or request counts. Because request/session APIs do not exist, present those dashboard areas as explicitly unavailable/not implemented yet rather than claiming there are no records. Do not add request actions or a new request architecture.
7. Keep logout on the existing `POST /api/auth/logout` flow, clear auth-related client state, redirect to `/login`, and ensure a subsequent dashboard visit requires authentication.
8. Preserve existing database tables and profile columns. Do not add migrations or alter existing defaults merely to build dashboards. Note existing backend-generated tutor profile defaults if they affect whether displayed profile details represent user-entered values.
9. Add or update only focused tests/checks supported by the repository. Do not add payment, scheduling, messaging, reviews, matching, admin, or other future-sprint functionality.

## Verification
- Check login routing remains Admin -> existing Admin route, Tutor -> Tutor Dashboard, Student -> Student Dashboard.
- Check `/api/auth/me` supplies the logged-in user's id, name, email, and role array; no password hash or token is exposed to the page.
- Exercise dashboard role handling for unauthenticated, student-only, tutor-only, and dual-role users. Verify that manually entering the other role's URL does not grant an unauthorized role access.
- Verify tutor search, subject filtering, listing, and profile use the existing database-backed tutor endpoints and empty/error/loading states.
- Verify tutor profile display comes from returned profile data; no request/session counts are fabricated.
- Verify logout clears the existing auth cookie/client auth state and protected dashboard navigation returns to login.
- Run the available client lint/build checks and any focused backend checks. Report any unavailable integration tests or database-backed tests honestly.

## Completion Report
Summarize files created/modified, API endpoints and database tables used, student/tutor features completed, request/session placeholders and missing backend capabilities, any remaining required database fields, authentication/authorization tests performed, and outstanding errors. Stop after this dashboard task; do not proceed to another sprint.