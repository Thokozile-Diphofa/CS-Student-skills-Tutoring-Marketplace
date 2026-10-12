# CS-Student-skills-Tutoring-Marketplace
The problem: Students who are strong in a subject and students who are struggling in the same subject rarely  find each other, even though peer tutoring is often cheaper and more accessible than formal tutoring. 

## Tutor application document verification

Tutor applications require proof of current university registration and an academic record.
The applicant may submit a PDF, JPG, JPEG, or PNG for each document (maximum 5 MiB each).
Administrators review each document separately; the application cannot be approved until
both current documents have `VERIFIED` status. Applicants can replace a rejected document,
which returns to `PENDING`.

### API

- `POST /api/tutor-applications` — authenticated `STUDENT`, multipart form submission
  with fields `registration` and `academicRecord`.
- `GET /api/tutor-applications/me` — authenticated applicant's application and safe
  document status/metadata.
- `PUT /api/tutor-applications/me/documents/:type` — authenticated `STUDENT` replaces
  their own rejected document by sending one multipart `document` field; `:type` is
  `registration` or `academicRecord`.
- `GET /api/tutor-applications/:id/documents/:type` — authenticated download, authorized
  for the owner or an administrator.
- `GET /api/tutor-applications` — administrator-only application list including document
  review metadata.
- `PATCH /api/tutor-applications/:id/documents/:type/review` — administrator-only
  document decision with `{"status":"VERIFIED"}` or
  `{"status":"REJECTED","rejectionReason":"..."}`.
- `PATCH /api/tutor-applications/:id/review` — administrator-only overall application
  decision; approval requires both required documents to be currently verified.

### Private document storage on Render

Uploaded documents are stored as private files; PostgreSQL stores only file references and
metadata. No upload directory is served as static content. For production, provision a
Render persistent disk for the Express service and set `PRIVATE_UPLOAD_DIR` to its absolute
mount path (for example, `/var/data/private-documents`). The disk must be provisioned and
may incur Render charges; without it, production startup fails rather than storing
documents on ephemeral service storage. For local development, the backend uses
`server/private-documents/`, which is git-ignored.

The PostgreSQL schema initializer applies additive, idempotent changes for application
university snapshots and document verification records. `server/schema.sql` also contains
the corresponding schema for new database installations.

### Manual verification steps

1. Sign in as a student and open `/tutor/application`.
2. Submit the application with both required document files and confirm that the page shows
   both documents as `PENDING`.
3. As an administrator, open the application, download both documents, and verify or reject
   each independently. Confirm an approval attempt is blocked until both are verified.
4. Reject one document with a reason. As that applicant, confirm the reason is shown and
   replace the rejected file; verify the new upload returns to `PENDING`.
5. Restart/redeploy the API with the same configured persistent disk and confirm the
   administrator can still download the submitted documents.
6. Confirm the applicant remains a `STUDENT` until an administrator approves the application
   after both documents are verified.
