# Implementation Prompt: University Document Verification for Tutor Applications

## Objective

Extend EasyLearning's existing tutor application workflow so applicants submit proof of
current university registration and an academic record, administrators review each document
individually, and tutor access is granted only after both documents are verified and the
application is approved.

Implement this in the existing Next.js, Express, and PostgreSQL architecture. Keep the
current authentication, UI patterns, application fields, and overall approval process. Do
not rebuild the application, restrict applicants to TUT, introduce academic eligibility
thresholds, or add an external paid storage provider.

## Existing implementation to extend

- The applicant form and status view are in `client/app/tutor/application/page.tsx`.
- Application endpoints and the administrator review/approval transaction are in
  `server/routes/tutorApplications.js`.
- The application schema is initialized by
  `server/services/tutorApplications.js`; the repository currently has no separate
  migrations framework or document-upload/storage layer.
- The admin application list and review UI are in
  `client/app/dashboard/admin/page.tsx`.
- `POST /api/auth/upgrade-tutor` already refuses to grant tutor access without an approved
  application. Keep this protection intact.
- Existing account and application data must be preserved. Existing `programme` and
  `year_of_study` fields already hold qualification/course and study-year information;
  continue to use them unless an additive migration is needed for a clearer qualification
  field. Record the university used for this application as an application snapshot rather
  than silently changing the applicant's account profile.

## Applicant form and status

1. Retain the current motivation, experience, skills description, modules, and proposed
   hourly rate fields.
2. Collect the current university name, qualification/degree/diploma, and current year of
   study. Do not apply a TUT-only validation or invent GPA/mark requirements. University
   recognition and academic suitability are administrator decisions.
3. Add an **Academic Verification Documents** section with required inputs for:
   - Proof of current university registration.
   - Academic record/results.
4. Accept PDF, JPG, JPEG, and PNG. Enforce a maximum of 5 MiB per document in the browser
   and on the server. Show each selected filename, allow replacement before submission,
   and require both files to submit a new application.
5. For an already-submitted application, display each current document's status
   (`PENDING`, `VERIFIED`, or `REJECTED`), upload date, and administrator rejection reason.
   Permit the applicant to replace a rejected document only. Show that a replacement is
   awaiting review; do not let it retain a previous verification.
6. Clearly distinguish application status from the two independent document statuses.
   Pending or rejected documents must explain that the application cannot yet be approved.
   Preserve the existing loading, empty, success, and error states.

## Private, persistent document storage

- Use a private directory on a Render persistent disk, configured through a server-only
  `PRIVATE_UPLOAD_DIR` environment variable. Provide a safe local-development default
  outside any static/publicly served directory. Fail clearly at startup or on upload when
  production storage is not configured; do not silently store production files on Render's
  ephemeral filesystem.
- Document the required Render disk mount and environment setting, and state that a
  persistent Render disk may incur Render charges and must be provisioned by the operator.
  Do not add a third-party paid storage service.
- Never expose the storage directory through `express.static`, return file contents as
  Base64, or store file contents in PostgreSQL. Store only server-generated storage keys,
  sanitized display metadata, content type, byte size, timestamps, and verification data in
  PostgreSQL.
- Generate unpredictable, safe filenames independent of the supplied filename. Validate
  extension, declared MIME type, size, and PDF/JPEG/PNG file signatures. Limit multipart
  fields/files and handle malformed or partial uploads. Remove newly written files if the
  associated database write fails; avoid deleting a previous file until its replacement is
  safely persisted.
- Stream documents only through authenticated, authorized API handlers. Do not trust a
  client-supplied path or storage key. Set safe download headers and avoid exposing
  server-side paths or credentials in responses/logs.

## Database and migration

- Add an incremental, idempotent schema migration following the repository's existing
  schema-initialization conventions; preserve all existing rows and role assignments.
- Store application university name (and qualification if it is not represented by the
  existing `programme` field).
- Add a document record for each type and application, with storage reference, original
  display name, verified content type, byte size, upload timestamp, status, rejection
  reason, and administrator/review timestamp metadata. Constrain document type and status
  in PostgreSQL and ensure at most one current document per application and type.
- Existing applications without documents remain unverified and cannot receive a new
  approval. Do not erase or retroactively corrupt previously approved legacy applications
  or existing data during migration.
- On replacement, update the current document reference, upload timestamp, and status to
  `PENDING`, and clear the old rejection reason. Preserve safe transaction/file-cleanup
  behavior.

## API and authorization

Keep existing routes compatible where practical and document the final implemented
contracts in both `README.md` and the API contract section of `AGENTS.md`. At minimum
support:

- `POST /api/tutor-applications`: authenticated multipart submission, with both required
  documents and existing application fields.
- `GET /api/tutor-applications/me`: authenticated applicant's application and safe
  metadata/status/reasons for their own current documents; never return storage paths.
- `PUT /api/tutor-applications/me/documents/:type`: authenticated owner-only replacement
  of a rejected document (`registration` or `academic-record`); transition that document
  back to `PENDING`.
- `GET /api/tutor-applications/:id/documents/:type`: authenticated private download for
  the owning applicant or an administrator, with ownership checked from the database.
- `PATCH /api/tutor-applications/:id/documents/:type/review`: administrator-only document
  verification/rejection. Require a nonempty bounded rejection reason when rejecting;
  clear it on verification. An applicant must not verify their own documents, including
  any account that also has the administrator role.
- Existing `GET /api/tutor-applications` and
  `PATCH /api/tutor-applications/:id/review`: remain administrator-only. Include document
  summaries for the dashboard. On `APPROVED`, the backend must lock/read the current
  application and both current document records in the database transaction and reject
  approval unless exactly both required document types exist and are `VERIFIED`. Never
  rely on status sent by the client.

Enforce authentication and ownership/role checks on the server for every upload, status,
review, replacement, and download request. The applicant remains a STUDENT until the
existing administrator approval transaction grants TUTOR access. Do not add any applicant
route capable of setting verification or tutor-role values.

## Administrator interface

- Show the application university, qualification, and year of study.
- For each document, show its pending/verified/rejected status, upload timestamp, and
  rejection reason; provide a secure view/download link.
- Allow an administrator to verify or reject each document independently. Ask for a
  reason on rejection and show API errors.
- Keep the overall application motivation, experience, skills/modules, and existing
  approve/reject workflow visible. Disable or explain unavailable application approval
  while either document is missing, pending, or rejected. The backend check remains
  authoritative even if the UI is bypassed.
- Do not change unrelated dashboard sections or styles.

## Tests and validation

Extend the existing Node test suite using its current test conventions. Cover:

- Valid initial multipart submission with both supported documents and persisted metadata.
- Missing documents, unsupported extension/MIME/signature combinations, and files over
  5 MiB are rejected without leaving orphan files or an application falsely submitted.
- Unauthenticated upload/download/review, applicant cross-account access, and
  non-admin verification are denied.
- Administrator verification and rejection (including required rejection reason) work;
  applicants cannot self-verify.
- Replacement is allowed only for the applicant's rejected document and returns it to
  `PENDING` with the prior rejection reason cleared.
- Approval fails for missing, pending, or rejected documents and succeeds only after both
  latest database records are verified; TUTOR role assignment occurs only on successful
  approval.
- Document downloads are private and authorized. Include a storage persistence test using
  a temporary configured storage directory across service restart/reinitialization where
  practical.
- Existing authentication, registration, admin, and application behavior still passes.

Run the server test suite and the relevant client lint/build/type checks available in the
repository. Report only checks actually run and results actually observed. Include exact
manual test steps for applicant upload/replacement and administrator review, and clearly
state that Render persistence requires an operator-provisioned persistent disk and its
configured mount path.

## Scope guardrails

- Do not edit unrelated payment changes or other unrelated files.
- Do not add payments, verification vendors, GPA/minimum-mark rules, or university-only
  restrictions.
- Make focused changes in existing route, service, form, admin, schema, tests, and relevant
  documentation files. Do not commit or log uploaded documents, storage credentials, or
  secrets.
