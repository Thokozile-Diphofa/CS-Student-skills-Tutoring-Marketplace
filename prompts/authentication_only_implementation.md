# Implementation Prompt: EasyLearning Authentication Only

## Objective
Make the existing Next.js login and registration pages work with the existing Express server and Neon/PostgreSQL database. Implement only registration, login, logout, role-based redirects, and protected access for the Student, Tutor, and Admin dashboards. Do not implement any later-sprint features.

## Repository Findings
- `client/app/login/page.tsx` and `client/app/register/page.tsx` currently render forms without submit handlers or API calls.
- Registration already performs client-side university-email validation for known South African universities and accepts `.ac.za` addresses when no mapping is known. Enforce the corresponding rule on the server as well.
- `server/index.js` currently exposes only `/` and `/api/test`; there are no routes, controllers, middleware, database configuration, or user model/schema in the repository.
- `bcryptjs`, `jsonwebtoken`, `pg`, and `dotenv` are already installed in the server. Reuse them; do not add a second database or auth library.
- The Next.js app currently has no dashboard routes. Add only the minimal role-specific dashboard destinations and access guards needed for the requested auth flows. Preserve the existing login and registration page design.

## Scope and Constraints
- Inspect the actual Neon schema before any database write or schema change. Reuse compatible existing user tables/columns and never drop tables, columns, or data or recreate the database.
- If no compatible user table exists, make only additive, non-destructive changes after inspection; document the exact change. Use environment variables for `DATABASE_URL` and `JWT_SECRET`; do not put secrets in source or logs.
- Registration accepts only `STUDENT` or `TUTOR`, requires first name, last name, university, valid student email, matching password confirmation, and password. Normalize email and enforce uniqueness in the database as well as the API. Hash passwords with `bcryptjs` and never return hashes.
- Login uses a generic invalid-credentials response for nonexistent email and incorrect password. Validate the account role and return the user's ID and role on success.
- Use a signed JWT in a `HttpOnly` cookie, with appropriate `SameSite`, `Path`, and production `Secure` settings. Do not store the token in localStorage or expose the signing secret. Configure credentialed CORS for the configured frontend origin. Logout must clear the cookie.
- Verify dashboard access against the backend-authenticated session and role. Unauthenticated visitors go to `/login`; authenticated users visiting a dashboard for another role are redirected to their own dashboard. Admin users may be provisioned through the existing database, but public registration must not allow `ADMIN`.
- Inspect the installed Next.js 16 documentation required by `client/AGENTS.md` before implementing route protection or other Next.js APIs.
- Avoid visual redesign, unrelated refactoring, and any tutor discovery, requests, messaging, scheduling, payment, review, or other future-sprint features.

## API Contract
- `POST /api/auth/register`: validate and create a student/tutor; return a clear success or validation/conflict error.
- `POST /api/auth/login`: verify credentials, set the HttpOnly auth cookie, and return safe user fields (`id`, `role`, and any required display name).
- `GET /api/auth/me`: validate the cookie and return safe authenticated user fields; return `401` when unauthenticated.
- `POST /api/auth/logout`: clear the auth cookie and return success.

Keep HTTP status codes and JSON errors consistent. Do not return a JWT in browser-readable JSON when using the HttpOnly-cookie design.

## Verification
Run available lint/build checks and exercise these flows against the configured Neon database: register Student, register Tutor, duplicate email, valid login, wrong password, nonexistent account, redirects for Student/Tutor/Admin, unauthenticated dashboard access, wrong-role dashboard access, and logout. Do not claim database-backed flows passed unless they were run with a configured database. Report any unavailable environment setup and provide exact manual test steps.

## Stop Condition
Stop when the requested registration, login, role redirects, dashboard protection, and logout work. Do not continue to another sprint.