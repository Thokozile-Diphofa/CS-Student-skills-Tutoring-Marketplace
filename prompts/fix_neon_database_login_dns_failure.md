# Implementation Prompt: Handle Unresolvable Neon Database During Login

Implement only after approval. Address the reported login failure `getaddrinfo ENOTFOUND` without guessing or changing database credentials, replacing `DATABASE_URL`, or changing existing login/authentication behavior when the database is available.

## Diagnosis

- Login queries PostgreSQL through the shared pool configured by `DATABASE_URL` in `server/db.js`.
- The reported `ENOTFOUND` occurs during DNS resolution, before PostgreSQL can execute the login query. No application code can recover the intended Neon endpoint without the active connection string from the database owner.
- `server/routes/auth.js` currently sends `error.message` back to the browser for login failures, disclosing infrastructure details.
- Startup already uses a bounded retry service for transient connection errors, but this login error originates at request time; retries cannot make an invalid/unresolvable hostname valid.

## Required change

- In the `POST /api/auth/login` catch path, never return the raw exception message or stack trace to the client.
- Recognize PostgreSQL connection/DNS availability errors, including `ENOTFOUND`, `EAI_AGAIN`, `ECONNREFUSED`, `ETIMEDOUT`, `ECONNRESET`, `EHOSTUNREACH`, and `ENETUNREACH`. Return HTTP 503 with a concise actionable message that the database is temporarily unavailable and server database configuration/connectivity should be checked.
- For other login failures, return a generic HTTP 500 login error without exception details.
- Log only safe structured diagnostic fields such as an allowlisted error code and error name. Never log connection strings, passwords, credentials, or raw driver error objects.
- Do not change user/password validation, credentials, JWT/cookie behavior, registration, role handling, pool settings, schema, or `.env` files.

## Tests and validation

- Extend `server/test/authRegistration.test.js` to cover a database `ENOTFOUND` login failure returning safe 503 JSON with no hostname or raw error detail, and an unexpected database failure returning generic safe 500 JSON.
- Confirm normal login and existing invalid-credential behavior remain unchanged.
- Run the focused auth tests, full backend `npm.cmd test`, and `git diff --check`.

## Operational note

This code change improves error handling but cannot restore connectivity to an invalid hostname. After implementation, the operator must copy the current PostgreSQL connection string for the active Neon project into the server's `DATABASE_URL` (including the correct pooled/direct hostname and password) in local server configuration and the API deployment environment, then restart/redeploy the API. Do not send database credentials in chat or commit them.
