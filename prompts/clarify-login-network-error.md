# Implementation Prompt: Clarify Login Fetch Failure Message

## Objective

Correct the misleading login error shown when the browser rejects the login
`fetch` request, without changing API URL construction, authentication, CORS,
request behavior, or page design.

## Findings

- Login reads `NEXT_PUBLIC_API_URL` and appends `/api/auth/login` once. The local
  value is `http://localhost:5000`; the deployed error names the configured
  Render origin.
- Backend CORS is installed before API routes, allows credentialed requests,
  and handles OPTIONS preflight.
- Live probes from
  `https://cs-student-skills-tutoring-marketplace-ljq2neizb.vercel.app` currently
  receive:
  - `GET /`: HTTP 200 with the matching allow-origin and credentials headers.
  - `GET /api/auth/me`: HTTP 401 with the matching allow-origin and credentials
    headers.
  - `OPTIONS /api/auth/login` for POST/content-type: HTTP 204 with POST and
    content-type allowed and credentials enabled.
  - `POST /api/auth/login` with an empty JSON body: HTTP 400 with CORS headers.
- The login catch block catches a rejected `fetch` and currently labels it as
  the backend being unavailable. It does not catch HTTP errors; those are
  handled from `response.ok`. A rejected browser fetch may also be caused by
  CORS, browser policy, or client/network failure.
- Render logs are not available from this workspace, and the reported failure
  cannot currently be reproduced from the public endpoint.

## Required change

Update only the login fetch-rejection message to state that the browser could not
complete the connection and suggest checking the network, browser/CORS access,
and configured API URL, rather than asserting that Express must be stopped.
Preserve the existing `NEXT_PUBLIC_API_URL` resolution, `/api/auth/login` path,
credentialed fetch, HTTP error handling, and visual structure.

## Validation

- Run ESLint on `client/app/login/page.tsx` and the client production build.
- Report the successful live endpoint/preflight probes separately from the
  unavailable browser-specific reproduction and inaccessible Render logs.
- Do not claim production login is fixed unless an actual browser login is
  performed after any deployment.
