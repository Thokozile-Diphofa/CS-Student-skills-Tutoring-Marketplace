# Implementation Prompt: Student Session Requests and Tutor Responses

Implement only after approval. Remove the expired date-based tutor-profile placeholder and connect the minimum real request lifecycle using the existing Neon `session_requests` table. Do not redesign tutor cards/profiles or dashboards. Do not change authentication architecture, tutor approval, roles, university validation, payment processing, admin logic, or create/alter session/payment tables.

## Inspection findings

- The stale copy is in `client/app/tutors/[id]/page.tsx`: “Request Session (Coming 30 Sept)” and “Session booking feature is scheduled for Wednesday, 30 September.”
- The checked-in `server/routes/sessionRequests.js` contains only `GET /mine`, authenticated for STUDENT, scoped by `student_id = req.user.id`, and joined to tutor profile and payment status.
- `server/index.js` mounts `/api/session-requests`; no student create route, tutor incoming-request route, or accept/decline route exists.
- The Student Dashboard already consumes `/api/session-requests/mine` and shows `PENDING`, `ACCEPTED`, tutor data, and PayFast only for accepted unpaid requests.
- The Tutor Dashboard currently has placeholder metrics and “Incoming Requests” copy; it has no request actions.
- `/api/tutors/:id` only returns tutor records joined to a TUTOR role and APPROVED tutor application, so it is an appropriate public-profile eligibility baseline.

## Required changes

### Student request

- Replace the expired placeholder entirely. Remove both stale date strings and any related date-scheduled placeholder logic.
- For an authenticated STUDENT viewing an approved tutor, expose an active “Request Session” button. A visitor can click it and is sent to the existing login route with a return path. A current user must not request themselves; hide or disable the action for their own tutor profile.
- Provide a compact form on the tutor profile for subject/module (use actual tutor subjects when appropriate), optional requested date/time, and optional message. Never ask for student ID, tutor ID, hourly rate, or amount.
- Submit only the tutor ID from the selected profile plus subject, requested date, and message. The server must derive student ID from `req.user.id` and set `status = 'PENDING'`. Do not initialize a payment during request creation.
- On success, show exactly “Session request sent successfully.” On validation/network errors, show a clear message.

### Backend routes

- Keep the current student list endpoint `GET /api/session-requests/mine` unchanged except for response additions strictly needed by the UI.
- Add `POST /api/session-requests` with `authenticateToken` and STUDENT role guard. Validate tutor ID, non-empty subject, optional valid date, and bounded message. Reject self-requests. Verify the target has `user_roles.role = 'TUTOR'`, an APPROVED `tutor_applications` row, and a tutor profile. Insert with parameterized SQL, student ID from auth, and explicit `PENDING`; return the created request. Reject unsupported status/IDs from the client and do not accept payment fields.
- Add `GET /api/session-requests/incoming`, authenticated for TUTOR, returning only requests where `tutor_id = req.user.id`, with student name/email, subject/message/date/status and tutor rate/payment state only as needed.
- Add `PATCH /api/session-requests/:id/respond`, authenticated for TUTOR. Accept only `ACCEPTED` or `DECLINED`; load/lock the request, verify the authenticated tutor is its target and its current status is `PENDING`, then update with a parameterized query. Reject other-tutor IDs, students without TUTOR role, invalid statuses, missing requests, and already-handled requests. Preserve normal STUDENT/TUTOR role behavior and do not auto-accept.
- Use the existing `session_requests` table exactly as supplied by the user. Do not create or drop it or `payments`.

### Dashboard

- Keep the Student Dashboard’s current design and real `/mine` data. Newly submitted requests must appear as `PENDING` using the existing fetch path; refresh or update state after request success where useful.
- Replace Tutor Dashboard placeholders with real incoming requests from the new endpoint and add Accept/Decline controls only for `PENDING` requests. Show loading, error, empty, success, and action feedback states.
- On acceptance, the Student Dashboard should show `ACCEPTED` and its existing Pay for Session action. Payment starts only after acceptance. Declined requests never show payment.

## Tests

- Add route-level tests for unauthenticated requests, STUDENT-only create, authenticated student ID derivation, approved tutor validation, self-request rejection, PENDING creation, input validation, incoming request scoping, tutor-only response, other-tutor rejection, status transition, and repeat response rejection.
- Verify the student’s newly created request appears in `/mine` as `PENDING`, and a tutor sees it in `/incoming` and can accept/decline.
- Verify the UI removes all stale wording, redirects visitors to login, does not offer self-request, and shows the success message.
- Run focused route tests, existing auth/role/tutor-application tests, client lint and TypeScript checks. Neon connectivity may block live DB tests; use mocked route tests and report any blocked runtime verification without changing database architecture.

## Final report

List files/routes changed, confirm placeholder removal and no remaining stale copies, describe student/tutor ID derivation and approved-tutor check, explain student/tutor dashboard retrieval, report test results, and confirm no payment is triggered until tutor acceptance and unrelated auth/approval behavior was untouched.