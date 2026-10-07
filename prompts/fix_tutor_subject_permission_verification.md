# Fix Tutor Subject Update Permission Verification

Implement only after approval. Fix the `500 Unable to verify account permissions.` error that occurs when a tutor saves subjects in the tutor dashboard. Preserve server-side authorization and fail-closed behavior.

## Observed behavior and traced path

- The subject editor in `client/app/dashboard/tutor/page.tsx` sends `PUT /api/tutors/profile` with `credentials: "include"`.
- The route in `server/routes/tutors.js` runs `authenticateToken` before `requireRole("TUTOR")` and before updating subjects.
- The exact response text is emitted only from the catch in `server/middleware/auth.js`, around `getEffectiveRoles(decoded.id)`. This points to a role-lookup/database failure, not a normal missing-TUTOR-role response or subject validation failure.
- The middleware logs the underlying exception as `Role lookup error:`. Use that exception to identify the actual cause; do not infer or hide it.

## Required work

1. Reproduce or inspect the backend error for the subject-update request and trace it to the failing query/schema/connection path in `getEffectiveRoles` and `ensureTutorApplicationSchema`.
2. Make the smallest root-cause correction. Keep authorization authoritative on the server; do not fall back to JWT `roles`, grant roles, weaken `requireRole`, or make profile updates public.
3. Keep the client’s cookie-based request behavior unless evidence proves it is defective. If there is a client-side issue, fix it without exposing tokens to browser storage.
4. Add or extend focused tests proving that an authenticated approved tutor can update subjects, a non-tutor is rejected, and a role lookup database failure remains a controlled server error. Include any schema/concurrency regression case implicated by the observed exception.
5. Run the focused server tests and client TypeScript/build checks. Report any live database limitation explicitly.

## Constraints

- Do not alter admin provisioning, account roles, tutor application approval, profile field validation, or unrelated dashboard behavior.
- Do not turn a database failure into an authentication success.
- Do not modify the database schema unless the captured exception demonstrates a schema defect and the correction is necessary.

## Acceptance criteria

- Saving tutor subjects succeeds for an authenticated account whose server-resolved roles include `TUTOR` and whose tutor application is approved.
- Unauthorized users remain unable to update tutor profiles.
- Database/role-resolution failures remain fail-closed and are diagnosable from server-side logs without returning sensitive database details to the browser.
