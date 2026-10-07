# Implementation Prompt: Multi-University Registration and Student Identity

## Objective
Support TUT and UP student emails using one shared university configuration, enforce the selected university/email pair in both the browser and Express API, and preserve the existing server-backed Student Dashboard identity flow.

## Inspection Findings
- Registration currently has a university domain map local to the page, uses a free-text university field, accepts any `.ac.za` domain when a university is unrecognized, allows `tut.ac.za` for TUT, and maps UP to `up.ac.za` instead of `tuks.co.za`.
- The backend registration route currently does not validate the selected university/email pair; it trusts submitted university text.
- Registration stores the submitted `university` value in the existing `users.university` column.
- `/api/auth/me` already returns safe first name, last name, email, university, and roles from the authenticated database user.
- Student Dashboard already sources its welcome, university, and Profile fields from the same authenticated `/api/auth/me` user object. No production `Test` or `Test University` fallback was found in that dashboard; those strings occur in test fixtures. The live database rows inspected currently contain Kedi/Angel and university `TUT`.
- Keep ADMIN registration reserved and existing role approval behavior intact. Admin login does not use the student registration validator.

## Implementation Scope

### 1. Shared University Configuration
- Add one shared, serializable configuration usable by both Next.js and Express, preferably a JSON module under `shared/`.
- Each entry must include canonical full name, short code, accepted domain, student-email regex pattern, and an example email.
- Initial records:
  - `TUT`, full name `Tshwane University of Technology`, domain `tut4life.ac.za`, example `224870809@tut4life.ac.za`; accept a non-empty valid email local part without assuming a fixed student-number length.
  - `UP`, full name `University of Pretoria`, domain `tuks.co.za`, pattern `u` followed by one or more digits, example `u12345678@tuks.co.za`.
- Remove scattered domain validation definitions. Do not add `tut.ac.za` or `up.ac.za` as student domains unless the user expands requirements.

### 2. Registration UI
- Replace free-text university entry with a select populated from the shared configuration.
- Use the selected record's example in the email placeholder/hint, and validate against its configured pattern.
- Reject unsupported/missing university selections and cross-university email domains. Do not accept arbitrary `.ac.za` domains.
- Submit the canonical full university name (and code only if needed for server resolution) to the existing registration API.
- Preserve the existing student/tutor-applicant flow and do not expose ADMIN.

### 3. Backend Registration Validation
- Validate the selected university and submitted email independently on the server before any user insert. Resolve only configured codes/canonical names and match the associated domain/pattern.
- Store the configuration's canonical full university name in the existing `users.university` column; do not add a database table or infer the university later from email.
- Keep every public account starting as STUDENT and preserve tutor application approval rules.
- Keep the dedicated admin email reserved from public registration. This is not a general email-validation exception; the trusted admin bootstrap/login path remains separate.

### 4. Student Dashboard Identity
- Keep the current `/api/auth/me` source and existing field names. Preserve loading and error behavior; do not add hard-coded defaults or mock fallback identities.
- Confirm the same authenticated user object drives welcome first name, university, and Profile. Avoid unrelated dashboard redesign or database rewrites.
- If current UI still shows a value such as `Test`, investigate the actual `/api/auth/me` response and stored account row; do not silently rewrite existing users.

## Verification
- Add focused tests using the shared configuration for valid TUT and UP addresses, TUT/UP cross-domain rejection, unsupported university/domain rejection, and UP local-part pattern rejection.
- Test backend bypass attempts for mismatched university/email and confirm no user is created. Test reserved admin email/role stays blocked.
- Verify registration stores canonical university and only STUDENT role.
- Test Student Dashboard identity rendering/account switching with two distinct mocked `/api/auth/me` users; do not create persistent test accounts in the live database.
- Verify existing admin redirects, approved tutor access, tutor-application flow, and public admin registration behavior remain intact.
- Run server tests, client lint, and production build. Report live database tests separately from mock/unit tests and note if DB access is unavailable.
- Produce the requested final report, distinguishing current database values from test fixture values.