# Implementation Prompt: Separate Admin Login and Role-Aware Dashboard Sidebar

Implement only after approval. Make only the two requested improvements: a dedicated Admin login entry point using the existing authentication system, and a reusable responsive sidebar for the existing authenticated dashboards. Preserve existing features and styling conventions; do not redesign the application or modify database schema/configuration.

## Inspection findings

- `client/app/login/page.tsx` posts to the existing `POST /api/auth/login`, includes cookies, and routes using server-returned roles. It currently sends ADMIN directly to `/dashboard/admin`.
- Authentication uses the backend-issued HttpOnly cookie. `localStorage` only holds display metadata (`user_roles`, `user_email`, `user_name`), not the authentication token.
- `GET /api/auth/me` returns effective server-resolved roles. Student, Tutor, and Admin dashboard pages use it to gate their UI and redirect users who visit the wrong dashboard URL.
- `server/middleware/auth.js` resolves current roles from the server; `requireRole("ADMIN")` protects `/api/admin/dashboard` and Admin tutor-application list/review APIs. Keep these checks untouched and in force.
- Student and Tutor pages already use `client/app/components/DashboardShell.tsx`, which currently provides a top header and horizontal navigation for those two roles. Student anchors are `#requests` and `#profile`; Tutor anchors are `#requests` and `#profile`.
- `client/app/dashboard/admin/page.tsx` currently has its own `<Navbar />`, authenticates with `/api/auth/me`, and fetches Admin-protected data. Existing dashboard sections are Overview, Tutor Applications, Users, and Approved Tutors; there are no separate Admin pages for payments or reports.
- `client/app/components/Navbar.tsx` already varies public navigation for authenticated roles and provides logout. `client/app/components/Footer.tsx` is the existing public footer, but no Resources/Quick Links section exists. Add the Admin Login link in this Footer rather than creating a second Resources component.
- Registration always submits `role: "STUDENT"`; public Admin registration is not available. Preserve this behavior.
- Client stack is Next.js 16, React 19, Tailwind; no icon component dependency is present in `client/package.json`.

## Required implementation

### Student/Tutor login

- Keep `/login` as the existing Student/Tutor form and use the same `POST /api/auth/login` flow.
- Do not add an Admin selector, checkbox, option, or Admin button to that form.
- If the successful server response includes `ADMIN`, do not route that session into a Student or Tutor dashboard. Direct it to `/admin/login` as the Admin entry point without changing its server role. Do not give an Admin account Student/Tutor access.
- Preserve current safe `next` handling for non-Admin users and existing Tutor/Student routing behavior.

### Dedicated Admin login

- Add `client/app/admin/login/page.tsx` as a simple, professional Admin Login page consistent with EasyLearning.
- Submit email/password to the same `POST /api/auth/login`; do not add an auth system, endpoint, role parameter, or Admin registration.
- Accept access only when the response’s server-provided roles contain `ADMIN`. Route an Admin to `/dashboard/admin`.
- On valid Student/Tutor credentials, do not allow Admin access: clear the cookie through the existing `POST /api/auth/logout`, show “Admin access is restricted to administrator accounts.”, and do not reveal whether a particular email exists. Keep ordinary invalid-credential errors generic.
- If an existing authenticated session visits `/admin/login`, check it with `GET /api/auth/me`: send ADMIN to `/dashboard/admin`; deny Student/Tutor sessions with the same restricted-access message. Do not use `localStorage` roles as the authority.
- Preserve the server-issued HttpOnly cookie and clear any existing display-only localStorage metadata on logout as the current Navbar does.

### Resources / Quick Links

- Add a visible “Admin Login” link to `/admin/login` in the existing `Footer.tsx`, under a concise Quick Links/Resources grouping.
- Do not add it to the normal login form, and do not add a duplicate Navbar or duplicate footer section.
- Keep the existing public Navbar and its current signed-in/signed-out behavior.

### Shared responsive dashboard sidebar

- Extend the existing `DashboardShell.tsx`; do not create three separate shell implementations.
- Support `STUDENT`, `TUTOR`, and `ADMIN`, with navigation selected from the requested dashboard role and never from cached localStorage role data.
- Desktop: fixed-width left sidebar and non-overlapping dashboard content to its right. Mobile/tablet: accessible menu button and dismissible drawer; keep content within viewport width and preserve current page content.
- Keep all existing Student/Tutor dashboard content and dashboard-switch link for accounts with both roles. Make logout work for all three roles using the existing logout API and cookie behavior.
- Student links only to existing functionality: Dashboard, Find Tutors (`/tutors`), My Session Requests (`#requests`), and Profile (`#profile`). Do not create or advertise a standalone payments page; payments are actions within session requests, while payment return/cancel pages are not a dashboard.
- Tutor links only to existing functionality: Dashboard, Tutor Profile (`#profile`, including subjects/rate), and Tutor Requests (`#requests`). Do not add an earnings page or placeholder destinations.
- Admin links only to existing Admin dashboard sections: Dashboard/Overview, Tutor Applications, Users, and Approved Tutors. Use the existing section-heading anchors. Do not add Payments, Reports, or other pages that do not exist.
- Update `client/app/dashboard/admin/page.tsx` to use the shared shell and remove its duplicate top Navbar from this authenticated dashboard. Preserve its existing data loading, filtering, review, users, approved-tutors UI, states, and Admin API calls.
- Add or reuse an overview anchor only as needed to make the Admin Dashboard sidebar destination functional; do not otherwise restructure dashboard content.

### Authorization constraints

- Preserve `authenticateToken`, current role resolution, `requireRole("ADMIN")`, and Admin API guards unchanged.
- All dashboard routes continue checking actual roles through `/api/auth/me`; frontend redirects are usability only, not security boundaries.
- A Student or Tutor must never gain access to the Admin dashboard or Admin APIs by URL manipulation, direct API calls, or localStorage edits.
- Do not change role data, bootstrap behavior, registration, tutor approval, session/payment APIs, database schema, `.env`, or backend authentication architecture.

## Validation

- Run `npm.cmd run build` and `npm.cmd run lint` from `client/`.
- Run `npm.cmd test` from `server/`.
- Check route imports and TypeScript diagnostics.
- Report that frontend route gating is client-side while Admin data/API authorization remains enforced server-side.
- Include concise manual test steps for Student, Tutor, Admin, wrong-role dashboard URLs, Admin API rejection, logout, and mobile sidebar interaction. Use test accounts only; do not expose credentials.

## Scope and final report

Expected files are the existing login page, new Admin login page, existing Footer, existing DashboardShell, and existing Admin dashboard, plus focused tests only if an existing test setup supports them. Do not modify unrelated pages or backend files unless inspection reveals a strict compatibility need; seek approval before broadening scope.

After approval, implement the smallest changes that satisfy the requirements above, run the listed checks, and report exact files changed, behavior preserved, check results, and any limitation.
