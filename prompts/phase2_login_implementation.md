# Implementation Prompt: EasyLearning Phase 2 — Login & Authentication Integration

## Objective
Implement end-to-end backend and frontend authentication for EasyLearning, focusing on Phase 2 requirements:
1. Backend login with PostgreSQL/Neon database integration, password verification via `bcryptjs`, and JWT token generation.
2. Connecting existing Next.js login form (`client/app/login/page.tsx`) to the Express backend.
3. Role-based redirection after login (`STUDENT` -> Student Dashboard, `TUTOR` -> Tutor Dashboard, `ADMIN` -> Admin Dashboard).
4. Protected dashboard routes ensuring users can only access their authorized role dashboard.
5. Secure logout mechanism clearing authentication state and redirecting to `/login`.
6. Preserving existing UI design and existing registration functionality without over-building.

## Architectural Choices & Scope
- **Backend Auth**: Express REST endpoints under `/api/auth` (`register`, `login`, `me`, `logout`).
- **Token Handling**: Signed JWT containing `{ id, email, role }` stored in an `HttpOnly` cookie (`token`) to prevent XSS exposure, with fallback header support for API requests.
- **Database**: PostgreSQL connection via `pg` pool using `process.env.DATABASE_URL`. Non-destructive table initialization (`users` table created with `IF NOT EXISTS`).
- **Dashboard Routes**: Minimal Next.js pages at `/dashboard/student`, `/dashboard/tutor`, `/dashboard/admin` displaying minimal role header, user details, and a functional Logout button.
- **Environment Variables**: Sensitive credentials (`DATABASE_URL`, `JWT_SECRET`) loaded exclusively from environment variables.

## Detailed Plan

### 1. Database Configuration & Schema (`server/db.js`, `server/schema.sql`)
- Implement PostgreSQL `pg.Pool` connection using `process.env.DATABASE_URL`.
- Create `users` table schema if not existing:
  - `id SERIAL PRIMARY KEY`
  - `first_name VARCHAR(100) NOT NULL`
  - `last_name VARCHAR(100) NOT NULL`
  - `university VARCHAR(150) NOT NULL`
  - `email VARCHAR(255) UNIQUE NOT NULL`
  - `password_hash VARCHAR(255) NOT NULL`
  - `role VARCHAR(20) NOT NULL CHECK (role IN ('STUDENT', 'TUTOR', 'ADMIN'))`
  - `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`

### 2. Backend Authentication Routes (`server/routes/auth.js`)
- `POST /api/auth/register`:
  - Validates fields, normalizes email (`trim().toLowerCase()`).
  - Hashes password using `bcrypt.hash(password, 10)`.
  - Inserts new user record. Return 400 for validation/duplicate email errors.
- `POST /api/auth/login`:
  - Validates email and password presence.
  - Normalizes email (`trim().toLowerCase()`).
  - Queries `users` table by email. If not found, returns `401 Unauthorized` ("Invalid email or password").
  - Compares password using `bcrypt.compare(password, user.password_hash)`. If mismatch, returns `401 Unauthorized`.
  - Signs JWT payload `{ id: user.id, email: user.email, role: user.role }` with `process.env.JWT_SECRET`.
  - Sets `token` HttpOnly cookie on response.
  - Returns safe user object `{ id, first_name, last_name, email, university, role }`.
- `GET /api/auth/me`:
  - Middleware verifies JWT from cookie or `Authorization` header.
  - Returns current authenticated user profile or `401 Unauthorized`.
- `POST /api/auth/logout`:
  - Clears `token` cookie and returns success message.

### 3. Middleware (`server/middleware/auth.js`)
- `authenticateToken`: Reads token from `req.cookies.token` or `Authorization: Bearer <token>`, verifies with `JWT_SECRET`, attaches `req.user`.

### 4. Server Integration (`server/index.js`)
- Add `cookie-parser` middleware.
- Configure `cors` with `credentials: true` and origin support.
- Mount auth router at `/api/auth`.

### 5. Frontend Login Page Integration (`client/app/login/page.tsx`)
- Maintain existing UI styling and layout.
- Add form submission state: `email`, `password`, `loading`, `error`.
- On submit: `fetch('http://localhost:5000/api/auth/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })`.
- On success: inspect returned `user.role` and redirect using Next.js `useRouter`:
  - `STUDENT` -> `/dashboard/student`
  - `TUTOR` -> `/dashboard/tutor`
  - `ADMIN` -> `/dashboard/admin`
- On error: display red inline error message without page reload.

### 6. Frontend Registration Page Integration (`client/app/register/page.tsx`)
- Connect submit handler to `POST /api/auth/register` with `credentials: 'include'` so new test users can be registered directly into the PostgreSQL database.

### 7. Minimal Protected Dashboard Routes (`client/app/dashboard/*`)
- `/dashboard/student/page.tsx`
- `/dashboard/tutor/page.tsx`
- `/dashboard/admin/page.tsx`
- Each page calls `/api/auth/me` on mount:
  - If unauthenticated -> redirect to `/login`.
  - If authenticated user role does not match required role -> redirect to their authorized role dashboard.
  - Displays user name, role badge, and a functional "Logout" button that calls `/api/auth/logout` and redirects to `/login`.

## Verification Steps
1. Run backend tests / verification script against PostgreSQL database.
2. Test registration of a `STUDENT` account and a `TUTOR` account.
3. Test login with correct credentials, verifying HttpOnly cookie placement and role redirection.
4. Test login with wrong password and nonexistent email, verifying proper error messages.
5. Test direct navigation to `/dashboard/student`, `/dashboard/tutor`, `/dashboard/admin` when unauthenticated.
6. Test cross-role access (e.g. STUDENT attempting to view `/dashboard/admin`).
7. Test Logout functionality and verify dashboard access is denied post-logout.
