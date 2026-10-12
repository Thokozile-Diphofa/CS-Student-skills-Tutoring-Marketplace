# Implementation Prompt: Fix Tutor Application API Fetch Failure

## Objective

Resolve the browser `TypeError: Failed to fetch` raised while loading the tutor
application page, without hiding backend or authorization failures or weakening
cross-origin protections.

## Findings

- The page checks for a missing production `NEXT_PUBLIC_API_URL` before issuing
  the request. This error occurs after it reaches the `fetch` call, so the
  configured API URL may be unreachable or the browser may be blocking the
  response.
- The backend currently allows credentialed CORS requests only from one exact
  `CLIENT_URL` origin (plus localhost origins outside production). A deployed
  Vercel origin that does not exactly match the Render `CLIENT_URL` is rejected
  without CORS headers, which appears to the browser as `Failed to fetch`.
- Local environment settings point to localhost and do not establish the
  production deployment's API URL or allowed frontend origin.

## Required changes

1. Trace API URL construction and cross-origin handling for the tutor
   application request. Preserve credentialed cookie authentication and do not
   treat a network failure as an unauthenticated response.
2. Make the backend's credentialed CORS allowlist support explicitly configured
   multiple frontend origins (for example, a dedicated comma-separated
   `CORS_ALLOWED_ORIGINS` setting) while preserving the existing `CLIENT_URL`
   behavior. Match normalized origins exactly; do not allow arbitrary origins
   or use `*` with credentials. Continue allowing localhost only outside
   production.
3. Give the tutor application page a clear, actionable error state when a
   request fails at the network/CORS layer. Keep HTTP error handling distinct
   (401 redirects and existing server error messaging remain intact), and do not
   expose tokens, credentials, or internal exception details.
4. Add focused backend tests for allowed configured origins, rejected origins,
   localhost development behavior, and credentialed CORS headers. Add a focused
   client test only if the existing test setup supports it without introducing
   new dependencies.
5. Update deployment documentation with the required Render/Vercel origin
   configuration. Do not claim the live deployment is fixed unless its
   environment settings are actually confirmed.

## Validation

- Run the focused CORS tests and the complete server test suite.
- Run ESLint on `client/app/tutor/application/page.tsx` and the client production
  build.
- Report the exact checks performed and note any Render/Vercel environment
  setting that the operator must update after deployment.
