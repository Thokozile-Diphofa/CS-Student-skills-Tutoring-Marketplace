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

### Private tutor application document storage

Tutor application documents are stored in a private Supabase Storage bucket;
PostgreSQL stores only opaque object keys and file metadata. The API uses the Supabase
secret key exclusively on the backend. It creates a five-minute signed download URL only
after verifying that the requester is the applicant or an authorized administrator, then
redirects to that URL. The bucket is never made public, and file contents are not stored
in PostgreSQL or on the Render filesystem.

Create a private Supabase Storage bucket named `tutor-documents` (do not enable public
access). In the Render API service settings, configure:

- `SUPABASE_URL` — the Supabase project URL.
- `SUPABASE_SECRET_KEY` — the project's secret key; keep it server-side and secret.
- `SUPABASE_BUCKET` — `tutor-documents`.

Restart or redeploy the API after setting these values. Never put the Supabase secret key
in frontend environment variables, source code, Git, logs, or client-visible responses.
Without all three values, the API still starts and unrelated features remain available,
but document upload, replacement, downloads, review, and application approval fail with
HTTP 503. Local tests mock Supabase and require no real credentials or uploads. Do not
consider production storage operational until configuration is complete and an authorized
upload and download have been verified end to end.

The PostgreSQL schema initializer applies additive, idempotent changes for application
university snapshots and document verification records. `server/schema.sql` also contains
the corresponding schema for new database installations.

### Frontend/API connection in production

Set the Vercel frontend environment variable `NEXT_PUBLIC_API_URL` to
`https://cs-student-skills-tutoring-marketplace.onrender.com` (the API origin, without an
`/api` path). On the Render API service, set `CLIENT_URL` to the canonical public frontend
origin. This remains the primary allowed CORS origin and is also used for payment links.

For the deployed frontend at
`https://cs-student-skills-tutoring-marketpl.vercel.app`, include that exact origin in
Render's comma-separated `CORS_ALLOWED_ORIGINS` setting. Preserve any existing entries
in that setting. Do not include paths or use `*`; credentialed browser requests require
an explicit origin allowlist. Local development origins are allowed only when
`NODE_ENV` is not `production`. Redeploy the frontend after changing `NEXT_PUBLIC_API_URL`
and restart/redeploy the API after changing its CORS settings. Verify the deployed API's
credentialed `OPTIONS` preflight and `/api/auth/me` response after redeployment.

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
