# Implementation Prompt: Fix Navbar Authentication State

## Objective

Correct the EasyLearning public navbar so it renders authenticated navigation only
when the backend confirms a valid session with a recognized effective role.
Preserve the existing visual design, navigation destinations, and server-side
authorization.

## Findings

- `Navbar.tsx` calls `GET /api/auth/me` with `credentials: "include"` and starts
  in a loading state, so it does not initially flash authenticated links.
- The backend `/api/auth/me` is guarded by `authenticateToken`; missing/expired
  cookies return 401, and effective roles are resolved server-side.
- The navbar currently treats any 2xx response as signed in, even when the
  payload has no valid `user` or no recognized role. Its role-selection fallback
  then renders Student Dashboard and Logout, which matches the reported
  logged-out symptom for an unexpected/malformed successful response.
- Non-2xx and network failures currently change visible auth state but do not
  clear stale local user metadata. Navbar logout only changes local UI after a
  successful backend response.
- Login stores role/name/email metadata in localStorage, but navbar auth must
  remain based on `/api/auth/me`, never this cache.

## Required changes

1. Keep initial auth state loading until the backend check resolves; do not show
   signed-in navigation optimistically.
2. Mark the navbar signed in only when `/api/auth/me` returns a valid user object
   with at least one recognized effective role (`STUDENT`, `TUTOR`, or `ADMIN`).
   Preserve role precedence and navigation for approved tutors/admins.
3. On 401 or a successful response without a valid user/recognized role, clear
   the stale local auth metadata used by existing login/dashboard flows and
   render the public navigation. Do not read cached roles to establish a
   session.
4. Keep the existing logout endpoint and credentialed cookie request. On
   successful logout, clear local auth metadata and immediately show public
   navigation. Ensure failed logout does not falsely claim success.
5. Keep changes small and avoid modifying unrelated page styles, routes,
   business logic, or auth permissions.
6. Add focused client tests only if an existing test runner is configured; do
   not add a new test framework just for the navbar. Run lint/build and
   available auth tests.

## Validation/reporting

- Verify the behavior for 401/no session, malformed successful response,
  student/tutor/admin roles, and logout at the logic level where the existing
  test setup allows.
- Report that browser-session and production deployment checks were not
  performed unless they are actually run.
