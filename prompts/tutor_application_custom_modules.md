# Implementation Prompt: Free-Entry Tutor Modules

Implement only after approval of this prompt. On the tutor application page, let applicants write the modules they offer instead of selecting predefined options. Do not change authentication, roles, tutor approval policy, dashboards, tutor applications beyond module entry/validation, payments, sessions, or unrelated functionality.

## Existing implementation

- `client/app/tutor/application/page.tsx` loads a subject catalog from `GET /api/tutor-applications/subjects` and renders checkboxes. The form already stores the chosen values as `subjects: string[]`.
- `server/routes/tutorApplications.js` rejects submitted subjects not found in `tutor_skills`, canonicalizes selected names against that catalog, and stores the normalized names in the existing application `subjects` array.
- On approval, the same route copies each saved application subject into `tutor_skills`. This already supports arbitrary strings; keep that review/approval behavior unchanged.
- `server/services/tutorApplications.js` creates the existing `tutor_applications.subjects TEXT[]` column. No schema change is needed.

## Required behavior

- Replace the predefined checkbox options on the application page with an accessible free-entry control for multiple module names. Use a tag/list pattern: type a module, add it with Enter or an Add button, show entered modules, and allow removal before submission. Do not render the catalog choices or require the subjects endpoint for this form.
- Continue submitting `subjects` as a string array so existing stored applications and the current API contract remain compatible. Load already-saved module strings as entered items.
- Keep form styling consistent with the existing page; do not redesign it.
- Keep client-side validation that at least one non-empty module is present. Trim values, prevent duplicates case-insensitively, and communicate invalid entries clearly.
- In the POST route, stop querying the existing tutor skill catalog solely to validate/canonicalize these applicant-entered modules. Independently validate that `subjects` is a non-empty array of strings, trim each item, reject blank values, enforce the `tutor_skills.skill_name` 100-character limit, deduplicate case-insensitively while preserving a submitted spelling, and save the resulting strings in the existing `subjects TEXT[]` column.
- Apply a reasonable bounded maximum number of entries and return a clear HTTP 400 when exceeded. Keep other application field validation, transaction behavior, eligibility checks, review requirements, and the approval process unchanged.
- Keep `GET /api/tutor-applications/subjects` in place for compatibility unless an actual caller requires a separately approved API change; this UI should no longer depend on it.

## Tests and checks

- Add focused server route coverage for custom module strings, trimming, case-insensitive duplicate handling, blank/non-string/overlong entries, maximum entry count, and rejection of an empty list.
- Confirm on approval that custom module names still become the tutor's `tutor_skills` entries.
- Verify the client accepts arbitrary typed module names, adds/removes items, and sends a string array. Verify existing application values render without needing the catalog endpoint.
- Run server tests, client lint, and the client TypeScript check. Do not change tests or behavior unrelated to tutor application module entry.

## Report

Summarize changed files, module-entry UX and validation, server validation, checks run, and confirm that authentication, roles, approval policy, dashboards, payments, and unrelated functionality were not changed.