# Implementation Prompt: Keep the API Available Without a Private Upload Disk

## Objective

Remove the production startup dependency on a Render persistent disk while
preserving authentication and application/profile functionality. Never save
private tutor documents to ephemeral local storage. Where durable private
storage is not configured, explicitly report document upload, replacement, and
download as unavailable.

## Findings

- Startup calls `ensurePrivateUploadDirectory()` from `server/index.js`. In
  production, `server/services/privateDocuments.js` throws if
  `PRIVATE_UPLOAD_DIR` is unset, preventing the entire API from listening.
- Document submission and replacement use Multer disk storage at
  `PRIVATE_UPLOAD_DIR`; file-signature checks, download paths, and cleanup also
  rely on that directory.
- Tutor-application profile/status endpoints, auth endpoints, and the rest of
  the API do not need the document directory. Application and document
  metadata are stored in PostgreSQL.
- Existing guards already reject upload directories inside public client paths,
  and production directories must be outside the deployed source tree.

## Required changes

1. Make production startup independent of `PRIVATE_UPLOAD_DIR` when it is not
   configured. Do not fall back to the repository, OS temp, or any ephemeral
   writable path in production.
2. Preserve local development behavior using the existing ignored private
   directory, and preserve configured production behavior including existing
   path safety checks and restrictive permissions.
3. When durable private storage is not configured, reject initial uploads,
   rejected-document replacements, and document downloads with a clear
   service-unavailable response (HTTP 503) before accepting or writing document
   bytes. Do not report success or persist document metadata without its
   corresponding private file.
4. Leave authentication, tutor application/profile reads, review/listing, and
   other unrelated API routes available. Do not silently treat existing
   metadata as proof that the referenced file exists.
5. Add focused tests that verify production startup can proceed without
   `PRIVATE_UPLOAD_DIR`, document operations fail explicitly without storage,
   and configured/private local storage upload/download behavior remains
   intact.
6. Update the README's private-document storage section to explain that
   `PRIVATE_UPLOAD_DIR` is optional for API startup but required to enable
   document storage, and identify how operators configure durable private
   storage.

## Validation

- Run focused private-document and startup tests, then the complete server test
  suite.
- Verify syntax and `git diff --check`.
- State explicitly that document verification/upload is unavailable until a
  durable private `PRIVATE_UPLOAD_DIR` is configured. Never claim production
  disk durability can be inferred from a path alone; the operator must mount a
  persistent disk or use a suitable private durable storage provider.
