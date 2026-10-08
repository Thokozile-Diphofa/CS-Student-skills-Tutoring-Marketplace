# Implementation Prompt: Declined Session Payment Availability

Implement only after approval. The goal is to clearly explain that declined tutoring sessions cannot be paid, while preserving the existing accepted-session PayFast flow and server-side enforcement.

## Inspection findings

- The Student Dashboard at `client/app/dashboard/student/page.tsx` renders payment details for each request and only renders the payment button when `request.status === "ACCEPTED" && !paid`.
- Declined requests already have no active payment button, but the UI does not explain that payment is unavailable because the tutor declined.
- `POST /api/payments/initialize` in `server/routes/payments.js` authenticates the caller as STUDENT, loads the session row from the database using `FOR UPDATE`, verifies student ownership, then checks `session.status !== "ACCEPTED"` and returns HTTP 409 before it queries or creates a payment record. It does not accept status from the request body.
- The current error says payment is only for accepted sessions. Preserve the route’s security and response structure; no backend behavior change is necessary for the rule itself.
- Session state is stored/read as `session_requests.status` in existing route queries. `server/schema.sql` does not define `session_requests` or `payments`; use the existing tables and make no schema change.
- Existing `server/test/payments.test.js` verifies ACCEPTED checkout creation, PENDING rejection, other-student rejection, and role rejection, but has no explicit DECLINED or accepted-then-declined regression test.
- Existing payment records may remain as historical records. Do not delete or alter them when a session status is declined.

## Required changes

1. In the Student Dashboard, keep the existing session details and existing `ACCEPTED && unpaid` button condition.
2. For `DECLINED`, display the message: `Payment unavailable because the tutor declined this session.` Do not render or enable a payment control for that status. Preserve existing payment-status history rather than rewriting/deleting it.
3. Extend `server/test/payments.test.js` with focused endpoint tests:
   - A direct authenticated STUDENT `POST /api/payments/initialize` for a `DECLINED` request returns the existing rejection status/message and creates no payment record.
   - At least one other non-accepted state (`PENDING` already covered; optionally cover CANCELLED/COMPLETED) remains rejected.
   - If a payment was initialized while accepted and the stored request status later changes to `DECLINED`, another direct initialize attempt is rejected and the historical payment record is left unchanged.
   - Keep the existing ACCEPTED sandbox checkout test passing.
4. Keep the backend status check as a database-derived exact `ACCEPTED` check. Do not accept client status, weaken ownership/role checks, alter tutor accept/decline behavior, modify ITN verification, or create a new payment status.

## Constraints

- No schema migration or table changes.
- No PayFast configuration, URL, signature, ITN, or provider changes.
- No auth, role, dashboard redesign, or unrelated UI work.
- No new dependencies.

## Validation

- Run the focused payment tests and full `npm.cmd test` from `server/`.
- Run the frontend production build and diagnostics for the changed Student Dashboard.
- Manually verify the button/message presentation for ACCEPTED and DECLINED mock/session data if browser access allows. Direct API test must prove DECLINED is rejected and no new payment is created.
- Report exact files changed and test results.
