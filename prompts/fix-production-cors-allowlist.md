# Implementation Prompt: Fix the Production Frontend CORS Allowlist

## Objective

Resolve the confirmed production CORS rejection for the supplied Vercel frontend
without changing authentication, cookies, database, UI, or unrelated routes.

## Confirmed findings

- The production Render backend is reachable.
- Requests to `/`, `/api/auth/me`, and an OPTIONS preflight for
  `POST /api/auth/login` from
  `https://cs-student-skills-tutoring-marketplace-ljq2neizb.vercel.app`
  all currently return `403 {"error":"Origin is not allowed."}` with no
  `Access-Control-Allow-*` headers.
- The existing CORS middleware runs before API routes, permits credentialed
  requests, and the `cors` middleware handles OPTIONS preflight.
- `server/middleware/cors.js` allows the configured `CLIENT_URL` and origins
  listed in `CORS_ALLOWED_ORIGINS`; the deployed allowlist does not include the
  supplied Vercel origin.
- The local `.env` values are localhost-only and do not reveal deployed Vercel
  or Render configuration.
- Login uses `credentials: "include"` and production auth cookies are configured
  with `Secure` and `SameSite=None`; preserve these settings.

## Required changes

1. Add a focused regression test for the exact supplied Vercel origin, including
   a credentialed OPTIONS preflight for `POST /api/auth/login` with
   `Content-Type`.
2. Update deployment documentation to set Render `CORS_ALLOWED_ORIGINS` to
   `https://cs-student-skills-tutoring-marketplace-ljq2neizb.vercel.app`
   (preserving `CLIENT_URL` if it is also used for payment links), and set
   Vercel `NEXT_PUBLIC_API_URL` to
   `https://cs-student-skills-tutoring-marketplace.onrender.com`.
3. Do not hardcode deployment origins into server behavior; keep the explicit
   origin allowlist configurable and retain localhost development behavior.
4. Do not claim production is fixed unless Render's environment is updated,
   the backend is redeployed/restarted, and the live preflight plus auth check
   are verified afterward.

## Validation

- Run the focused CORS tests and full server test suite.
- Report that actual production login requires the Render environment update
  and cannot be verified from the repository workspace alone.
