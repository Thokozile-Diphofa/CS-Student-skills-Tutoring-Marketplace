# Implementation Prompt: Bounded Retry for Transient Database Startup Connections

Implement only after approval. Address intermittent PostgreSQL TCP connection failures during backend startup without changing authentication behavior, roles, schema SQL/design, credentials, or any unrelated feature.

## Observed evidence

- `server/db.js` creates the shared `pg.Pool` from `DATABASE_URL` and applies the existing Neon SSL option. Do not change credential loading or print environment values.
- `server/routes/auth.js` `ensureSchema()` obtains a client using `db.pool.connect()` before executing its transaction. The reported `AggregateError [ETIMEDOUT]` occurs at this socket connection step, before schema SQL runs.
- `server/index.js` awaits the authentication initializer and then the existing tutor-application schema initializer before listening.
- A read-only probe explicitly loaded `server/.env` without printing it, then used the application's exact exported pool for both `SELECT NOW()` and `pool.connect()`/`SELECT 1`; both succeeded. Therefore current pool configuration is capable of connecting, and the reported failure is intermittent rather than a reproducible SSL/schema mismatch.
- Earlier error details showed nested TCP connect failures (`ETIMEDOUT` for IPv4 attempts and `ENETUNREACH` for IPv6 attempts), not an SSL negotiation or SQL error.

## Required change

- Add a small, bounded retry around startup schema initialization in `server/index.js` only when the failure is a transient connection-level error (`ETIMEDOUT`, `ECONNRESET`, `EHOSTUNREACH`, `ENETUNREACH`, or equivalent nested errors inside `AggregateError`). Use a small maximum attempt count and short backoff.
- Retry the complete startup initializer only for connection failures. Do not retry SQL/schema/permission/configuration errors.
- Continue to fail startup with the existing safe detailed error logger after retries are exhausted. The server must not begin listening until both existing schema initializers succeed.
- Do not log `DATABASE_URL`, credentials, tokens, passwords, or raw connection strings.
- Do not change `server/db.js` pool options unless a new focused test demonstrates that a pool option is the actual root cause; current same-pool probe succeeded.
- Add focused tests for transient connection failure then successful initialization, persistent transient failure exhausting the bound, and non-connection/schema error failing immediately. Reuse existing test conventions and avoid real database mutations.

## Validation

- Run the focused startup retry tests and the full `npm.cmd test` suite in `server/`.
- Run `node --check index.js` in `server/`.
- Report exact attempts/backoff behavior and all checks. Do not modify `.env`, schema, auth routes, PayFast, client, or workspace task files.
