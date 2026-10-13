# Implementation Prompt: Report a Problem and Admin Report Management

Implement only after approval. Add the report workflow to the existing EasyLearning application without redesigning existing screens or changing unrelated behavior. Preserve existing uncommitted work.

## Inspection findings

- The API is Express with PostgreSQL through `server/db.js`; routes use parameterized `db.query` calls and `authenticateToken` / `requireRole` middleware.
- The effective authenticated roles are available as `req.user.roles`; a user may have both STUDENT and TUTOR roles.
- The server initializes schema at startup in `server/index.js`. Authentication and tutor-application services use idempotent schema initialization; `server/schema.sql` is also the checked-in schema reference. There is no separate migration framework.
- `client/app/components/DashboardShell.tsx` provides the shared responsive dashboard sidebar for STUDENT, TUTOR, and ADMIN.
- `client/app/dashboard/admin/page.tsx` renders the existing admin dashboard and loads data from admin APIs.
- Private file handling already uses Supabase Storage through `server/services/privateDocuments.js`, validates PDF/JPG/JPEG/PNG extensions and file signatures, limits files to 5 MiB, stores opaque UUID keys, and creates short-lived signed URLs.
- Backend tests use `node:test`, an Express test harness, JWTs, and mocked database/storage dependencies. The client has no existing test framework.

## Required changes

### Database and initialization

- Add an idempotent reports table definition to `server/schema.sql` and initialize it before the API begins serving in the existing startup flow.
- Store report ID, reporting user ID with a foreign key, a server-derived snapshot of all effective roles at submission, category, subject, description, optional private attachment metadata/storage key, status, a user-visible administrator response, and created/updated timestamps.
- Use the categories:
  - `Technical issue`
  - `Login or account problem`
  - `Tutor application problem`
  - `Payment problem`
  - `Incorrect or inappropriate content`
  - `Suspicious activity or safety concern`
  - `Other`
- Use `OPEN`, `IN_REVIEW`, `RESOLVED`, and `CLOSED` statuses with a database constraint.
- Do not add internal administrator notes to user-visible report history. Store only a response/resolution message intended to be shown to the reporting user.
- Keep attachment references private; never store a public URL in the database.

### API

Mount a new `/api/reports` router in `server/index.js`. All report operations require authentication; never accept a reporter ID or roles from the request body.

- `POST /api/reports`: allow authenticated STUDENT, TUTOR, or ADMIN users to submit. Validate the exact category allowlist, required subject and description, and reasonable limits (subject up to 160 characters; description up to 5,000). Trim user text and reject malformed values with clear 4xx responses. Derive reporter ID and all effective reporter roles from `req.user`. Initialize status to `OPEN`; ignore/reject unsupported request fields rather than allowing client-supplied identity, role, status, or timestamps.
- `GET /api/reports/mine`: return only the authenticated reporter's reports, newest first, including subject, category, submitted date, current status, and any user-visible response. Do not return reports owned by other users or internal-only fields.
- `GET /api/reports/admin`: require `ADMIN`; allow optional validated status/category filters. Return the queue with category, subject, full description, date, reporter name/email/role snapshot, status, user-visible response, and safe attachment metadata.
- `POST /api/reports/:id/status`: require `ADMIN`; validate a positive integer report ID, allowed status, and bounded optional user-visible response. Update status/response and `updated_at` with parameterized SQL. Return 404 for a valid but missing report and 400 for invalid ID/status/body.
- `GET /api/reports/:id/attachment`: require authentication and authorize only the owning reporter or an ADMIN before creating a short-lived signed URL. Do not disclose whether another user's report or attachment exists to an unauthorized caller.
- Return generic safe server errors; log useful operation context without logging descriptions, attachment content, credentials, or signed URLs.
- Handle attachment upload failure or database insert failure explicitly. If storage succeeded but the report insert failed, attempt to remove the unreferenced object using the existing cleanup helper.

### Attachments

- Support one optional PDF, JPG/JPEG, or PNG attachment, maximum 5 MiB, using the existing private Supabase bucket/configuration and private-document helpers. Validate declared MIME/extension and actual file signature server-side.
- Extend the storage service only as needed to parse a report upload; preserve existing tutor-application validation and behavior.
- Persist only the opaque storage key and safe metadata. Do not make the bucket public. Only create a short-lived signed download URL after the report owner or an ADMIN passes server-side authorization.
- If the existing storage helper cannot safely support report uploads without broadening configuration or weakening document protections, omit attachments and document that limitation instead of adding public or local-disk storage.

### User interface and navigation

- Add unobtrusive `Report a Problem` and `My Reports` links to the shared dashboard navigation so they are available to STUDENT, TUTOR, and ADMIN accounts on desktop and mobile.
- Add a report form page with the required category dropdown, subject, description, optional safe attachment, Submit Report, and Cancel. Validate required fields and lengths in the UI as well as on the server. Disable submission while processing; show clear validation, upload/network/server errors, and a success confirmation. Cancel returns to the user's dashboard.
- Add a My Reports page using `GET /api/reports/mine`. Show loading, error/retry, empty, and populated states; display subject, category, submission date, status, and user-visible response only.
- Integrate a Reports section into the existing Admin Dashboard rather than creating a replacement dashboard. Load the admin queue, support status/category filtering, display responsive report summaries, and let administrators open/read full descriptions and safe attachment links. Provide a status/response form that uses only `POST /api/reports/:id/status`; prevent repeated submissions while processing and show success/error feedback.
- Preserve existing dashboard styles, authentication checks, and responsive behavior. Client visibility is not an authorization control; rely on the API middleware and ownership checks.

### Documentation

- Update the API contracts in the root `AGENTS.md` to list the new report endpoints and their authorization/ownership rules, and note that reports and their attachments are now implemented.
- Keep `server/schema.sql` and startup schema initialization consistent.

## Tests

Add `server/test/reports.test.js` using existing `node:test` and route-test conventions. Cover:

1. Authenticated user can submit a valid report; reporter ID and role snapshot come from the verified authentication context.
2. Missing subject/description, invalid category, oversized values, unsupported body fields, and malformed upload are rejected.
3. Unauthenticated submission is rejected.
4. A user can retrieve only their own reports; another user's reports and attachment are inaccessible.
5. An ADMIN can view/filter the report queue; a non-admin cannot.
6. An ADMIN can update status and user-visible response with POST; non-admin, invalid report IDs/statuses, and missing reports are handled correctly.
7. Database/storage errors return safe appropriate responses and do not expose secrets or stack traces.
8. If attachments are implemented: valid signatures/size, invalid types/signatures/oversize, private object storage, authorized signed-url access, unauthorized access, and cleanup after failed insert.

Run the focused report tests, relevant existing route/storage tests, client lint/build or type checks available in package scripts, and `git diff --check`. Report only checks that were actually executed. Do not introduce a new client test framework solely for this feature.

## Constraints and final report

- Do not add PUT, PATCH, or DELETE routes for reports; all report retrieval is GET and report submission/status changes are POST.
- Do not alter existing endpoints or public role provisioning/authentication behavior.
- Do not add payments, account identity fields in the client form, or public attachment URLs.
- Do not commit, push, or deploy.
- At completion, list changed files, schema/startup migration behavior, endpoints and access controls, attachment/configuration behavior, exact test results, and manual test steps.
