# Implementation Prompt: Fix Tutor Application Permission Error and Upload Filename Display

## Objective

Fix the tutor application's `Unable to verify account permissions.` error and ensure the
selected filename is plainly visible after choosing a registration or academic-record
file. Keep changes focused; do not change unrelated payment code or loosen authorization.

## Existing findings

- The permission response is emitted by `server/middleware/auth.js` when role resolution
  throws. It calls `getEffectiveRoles` from `server/services/tutorApplications.js`, which
  first runs `ensureTutorApplicationSchema`.
- Role lookup currently logs the caught exception but responds with a generic 500. Check
  that all schema statements/queries used by the initialized application schema match the
  deployed PostgreSQL schema and are safe under startup/concurrent requests. Do not expose
  SQL, database connection details, file paths, or secrets to the browser.
- The applicant form currently displays a native file input beside a separate filename
  preview; the native element can continue to show “No file chosen” even when React holds
  the selected file.
- The actual Render database exception is not available in this workspace. Add enough
  sanitized, server-side diagnostic context to identify the failed role/schema stage in
  Render logs while retaining the generic client-safe response. Do not claim or guess a
  production root cause without logs.

## Required changes

1. Trace authentication role resolution and application-schema initialization. Fix any
   confirmed SQL/schema-ordering/concurrency defect that causes permission checks to fail.
   Preserve the effective-role rules, including approved-TUTOR gating and existing
   STUDENT/ADMIN roles. Do not use JWT-embedded roles as an authorization fallback.
2. Ensure role lookup failures produce safe, useful server diagnostics identifying the
   operation/stage and PostgreSQL error code, without logging credentials, tokens, SQL
   parameters, or document contents. Keep the response body generic and do not hide a
   failed authorization lookup behind a successful response.
3. Add/extend targeted backend tests for authenticated account permission lookup and the
   related schema initialization/role resolution path. Tests should fail if an initialization
   or role query failure is represented as valid authorization.
4. Replace the visible browser-native upload controls on the new-application form with
   accessible custom file-picker controls. Keep the actual file inputs visually hidden but
   programmatically labelled; show the selected filename in a visible, persistent preview
   and make replacement possible by choosing another file. Ensure clearing/resetting the
   native input cannot make the visible preview say “No file chosen” after a valid selection.
   Preserve client/server type and 5 MiB validation and form submission behavior.
5. Apply the same clear chosen-filename behavior to rejected-document replacement if its
   UI presents the native browser file control.
6. Keep the worktree's pre-existing payment edits untouched. Update directly relevant
   documentation only if route or operational behavior changes.

## Validation

- Add and run focused tests for authentication/role lookup and upload-selection behavior
  where the available test setup permits; do not add browser-test dependencies solely for
  this change.
- Run the complete server test suite, ESLint for the changed client page, and client
  production build.
- Report the exact checks performed. State that identifying the original live Render
  database failure may still require the sanitized `Role lookup error` log entry if the
  defect cannot be reproduced from repository code.
