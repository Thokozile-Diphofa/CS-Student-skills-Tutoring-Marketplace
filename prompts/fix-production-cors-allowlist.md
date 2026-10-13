# Implementation Prompt: Update the Production Vercel Origin

## Objective

Align deployment documentation and the focused CORS regression test with the
corrected production frontend origin supplied by the user:

`https://cs-student-skills-tutoring-marketpl.vercel.app`

Do not change authentication, cookies, database behavior, UI, or unrelated
routes.

## Findings

- The CORS middleware obtains allowed origins from `CLIENT_URL` and the
  comma-separated `CORS_ALLOWED_ORIGINS` setting. Credential support is enabled.
- Localhost origins remain allowed outside production.
- The focused CORS test and README currently refer to the previous Vercel
  hostname, `cs-student-skills-tutoring-marketplace-ljq2neizb.vercel.app`.
- A prior live check of the old hostname is not evidence that this corrected
  hostname is currently allowed or that production login works.

## Required changes

1. Update the README production configuration to use
   `https://cs-student-skills-tutoring-marketpl.vercel.app` as the exact
   frontend origin, without a trailing slash or path.
2. Keep `NEXT_PUBLIC_API_URL` set to the Render API origin:
   `https://cs-student-skills-tutoring-marketplace.onrender.com`
3. Update the focused CORS regression test to verify a credentialed
   `OPTIONS` preflight for `POST /api/auth/login` and the unauthenticated
   `GET /api/auth/me` response for the corrected origin.
4. Do not hardcode this production origin into server runtime behavior; retain
   the configurable allowlist and existing local-development behavior.
5. Do not claim production is fixed without a Render environment update,
   backend restart/redeploy, and verification against the corrected origin.

## Validation

- Run the focused CORS tests and the server test suite.
- Report the exact Render setting:
  `CORS_ALLOWED_ORIGINS=https://cs-student-skills-tutoring-marketpl.vercel.app`
- Preserve existing `CORS_ALLOWED_ORIGINS` entries if any, separated by commas.
- State that Vercel's `NEXT_PUBLIC_API_URL` is the Render API origin above.
- Clearly distinguish repository test results from production browser-login
  verification.
