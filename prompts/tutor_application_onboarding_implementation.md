# Implementation Prompt: EasyLearning Tutor Application Onboarding

## Objective
Replace direct tutor-role activation with an application and review flow in the existing EasyLearning project. Preserve student registration, existing JWT authentication, user accounts, tutor data, and the current EasyLearning design. Do not implement payments or unrelated features.

## Phase 1 Findings
- Registration already creates an authenticated account and uses bcrypt/JWT cookies. It currently accepts `role: "TUTOR"` and immediately inserts both `STUDENT` and `TUTOR` in `user_roles`.
- `POST /api/auth/upgrade-tutor` also grants the `TUTOR` role immediately. Both paths must stop granting unrestricted tutor access.
- `users` stores first/last name, university, email, password hash, and creation time. It has no student number, programme, year of study, or email verification state.
- Tutor data currently lives in `tutor_profiles` and `tutor_skills`; there is no `TutorApplication` table and no canonical Subject table. Subject names are free text in `tutor_skills`.
- Tutor-profile initialization inserts default bio, rate, headline, and Computer Science/Mathematics skills for every current `TUTOR` account. Tutor search returns every account with the `TUTOR` role, regardless of application status.
- `/api/tutors/profile` reads the signed-in tutor's profile; `PUT /api/tutors/profile` changes profile fields and subjects and accepts no role/application status fields.
- Email verification is not implemented. There is no mail transport/provider or verification endpoint; JWT verification is not email verification.
- Existing accounts with `TUTOR` but no application must be retained, but gated from tutor-only access and public search until their application is reviewed and approved. Do not silently grandfather them as approved or delete their accounts/profiles.

## Scope and Requirements
1. Before frontend code edits, read the relevant installed Next.js 16 documentation under `client/node_modules/next/dist/docs/`, as required by `client/AGENTS.md`.
2. Create `/become-a-tutor` using existing EasyLearning components/styles. Its CTA sends unauthenticated users through existing registration with a tutor-application intent; authenticated students continue to `/tutor/application`. Intent is navigation only and must not confer a role.
3. Keep registration and login on the existing auth endpoints. Public registration must create only a `STUDENT` role regardless of submitted role/intent; keep ordinary student registration behavior intact. New tutor applicants should be signed in by the existing registration response and redirected to `/tutor/application`, not given `TUTOR` access. Existing accounts may apply after signing in.
4. Retire or change `/api/auth/upgrade-tutor` so it cannot grant `TUTOR`. Keep it backward-compatible with a clear response directing the signed-in user to apply. Do not rebuild authentication.
5. Add a database-backed `tutor_applications` structure without dropping or recreating tables. It should reference the existing user and store application fields: student number (optional), programme/course, year of study, motivation, experience, knowledge/skills description, preferred method only if supported, proposed hourly rate, status (`PENDING`, `APPROVED`, `REJECTED`), submitted/review timestamps, reviewer, and an email-verification timestamp/state that remains unverified unless a real verification mechanism completes it. Make one application per user enforceable at the database level. Preserve rejection reason only if needed for professional status display/admin review.
6. Backfill existing `TUTOR` users with no application to a review-required `PENDING` application (legacy marker/source allowed; application fields can be incomplete until the user completes/submits). Keep their account and profile rows. Do not treat their old role as approval.
7. Provide a subjects endpoint based on distinct existing `tutor_skills.skill_name` values; do not introduce duplicate subject records or invent subjects. The application form must show loading, empty, and error states if no subjects can be loaded. Validate submitted subject strings against the server's current allowed subject set.
8. Add authenticated application endpoints for the current user's application/status and submission. Validate required fields, email format, positive finite hourly rate, subjects, ownership, and duplicate applications on the backend as well as the frontend. A second active submission must return a conflict and must not create duplicates. The user cannot set status, reviewer, verification state, role, or another user's ID from request data.
9. Add backend-only admin review endpoints if needed to complete the approval transition, guarded by the existing `ADMIN` role middleware; do not create or redesign the Admin Dashboard. On approval, the server sets application status and adds the user's `TUTOR` role; on rejection, do not grant the role. Review transitions must be server-controlled and auditable. Do not allow a tutor to change their own status or role.
10. Gate tutor-only backend operations against current database approval state, not only a possibly stale role claim in a seven-day JWT. Ensure `/api/auth/me` and login/role routing do not expose pending/rejected applicants as active tutors. Keep pending/rejected applicants able to use their `STUDENT` role and view `/tutor/application` status.
11. Update tutor search and public profile lookup to return only approved tutors. Pending and rejected users must not appear. Update tutor-profile provisioning so new applicants do not receive active default tutor profiles/subjects before approval; on approval, create/update a profile using submitted bio, rate, and subjects, without overwriting unrelated existing accounts' data.
12. Build `/tutor/application` and a status view using the existing design. Show the authenticated user's name/email, application fields, loaded subjects, validated hourly rate, pending confirmation, and persistent `PENDING`/`APPROVED`/`REJECTED` status. Pending applicants must not enter the Tutor Dashboard. Approved users retain Student role and gain Tutor role.
13. Do not fake email verification. No verification email should be claimed or sent. Prepare a nullable verification state/timestamp and clearly state in UI/report that an email provider and verified sending domain/credentials are still required. Submission may be recorded as `PENDING`, but it must not be marked email-verified; prevent admin approval until a real verification mechanism has marked the account verified.
14. Keep the existing student dashboard, login, student registration, current profile and search design, and public APIs compatible where possible. No payments, reviews, messaging, video, calendar, matching, or Admin UI.
15. Update `AGENTS.md` API contracts for routes actually implemented and add/update focused tests only where supported.

## Verification
- Student registration still creates a usable student account; a registration request with `role: "TUTOR"` cannot grant Tutor access.
- Existing login works; `/api/auth/me` returns the authenticated profile and current effective roles.
- New account and existing student can open `/become-a-tutor`, continue to `/tutor/application`, submit valid data, and see status persist after refresh.
- Invalid rate, missing fields, invalid/unknown subjects, unauthenticated submission, cross-user access, and duplicate submissions are rejected by the backend.
- Pending/rejected applicants cannot use Tutor Dashboard or tutor-only profile APIs and do not appear in listing/search/profile endpoints.
- Admin-only review endpoints reject logged-out/non-admin callers. Approval changes status and grants tutor access; rejection does not.
- Existing legacy tutor users are retained and gated into the review-required application flow, not silently grandfathered or deleted.
- Verify email remains explicitly unverified; no fake verification is claimed. Document email-provider setup still needed.
- Run client lint/build and backend syntax/tests. Report database-backed checks that could not be performed.

## Completion Report
Report created/modified files, additive database changes, API endpoints, complete onboarding/status flow, tests passed, email-verification limitations and required service/configuration, and anything still to implement. Stop after tutor application onboarding; do not advance another sprint.
