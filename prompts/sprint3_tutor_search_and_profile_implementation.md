# Implementation Prompt: EasyLearning Sprint 3 (Days 18 & 19) — Tutor Search & Tutor Profile

## Objective
Implement database-backed Tutor Search, Tutor Listing, Subject Filtering, Hourly Rate display (Day 18), and Tutor Profile viewing (Day 19) for **EasyLearning**, bringing the application up to date with the Project Tracker through **29 September 2026 ONLY**.

---

## 1. Database Schema & Data Models (`server/schema.sql`, `server/routes/tutors.js`)
- `tutor_profiles` table:
  - `user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE`
  - `headline VARCHAR(255)`
  - `bio TEXT`
  - `hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 180.00`
  - `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`
- `tutor_skills` table:
  - `id SERIAL PRIMARY KEY`
  - `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `skill_name VARCHAR(100) NOT NULL`
  - `UNIQUE(user_id, skill_name)`
- Automatic initialization: When a user registers or upgrades as `TUTOR`, default profile and skills (e.g., "Computer Science", "Mathematics") are provisioned so tutors appear in listings immediately.

---

## 2. Express Backend API Routes (`server/routes/tutors.js`)
- `GET /api/tutors`:
  - Returns list of active tutors (users with `TUTOR` role in `user_roles`).
  - Supports search query parameters: `?search=Calculus`, `?subject=Mathematics`, `?university=TUT`.
  - Returns `[{ id, firstName, lastName, university, email, headline, bio, hourlyRate, subjects, roles }]`.
- `GET /api/tutors/:id`:
  - Returns single tutor details by ID. Returns 404 if user is not a tutor or not found.
- `PUT /api/tutors/profile`:
  - Authenticated endpoint for tutors to update their `headline`, `bio`, `hourlyRate`, and `subjects`.

---

## 3. Frontend Navigation & Pages (`client/app`)
- **Tutor Search & Listing Page** (`client/app/tutors/page.tsx`):
  - Search input & Subject filter pills/select.
  - Dynamically fetches from `GET /api/tutors`.
  - Renders tutor cards displaying Name, University, Verified Peer Tutor badge, Hourly Rate (`R180 / hour`), Subject tags, and a "View Profile" link.
  - Displays Loading, Empty, and Error UI states.
- **Tutor Profile Page** (`client/app/tutors/[id]/page.tsx`):
  - Fetches single tutor from `GET /api/tutors/:id`.
  - Displays Tutor header, Verified badge, University, Hourly Rate, Headline, Bio, and Subjects list.
  - Includes a non-functional placeholder "Request Session (Coming 30 Sept)" button without implementing booking/requests yet.
- **Navbar Integration** (`client/app/components/Navbar.tsx`):
  - Adds "Find Tutors" navigation link pointing to `/tutors`.

---

## 4. Verification & Scope Constraints
- **Strict Boundary**: Do NOT implement Session Request submission (Day 20), Accept/Decline (Day 21), Session Workflow (Day 22), Payments, Messaging, or Calendar integration.
- Verify that only users with the `TUTOR` role appear in search results.
- Verify dual-role users (`STUDENT + TUTOR`) appear in tutor search.
