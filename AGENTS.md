# AGENTS.md

You are a principal-level engineer building the CS Student Skills Tutoring Marketplace, a
peer-to-peer platform where Computer Science students trade tutoring based on complementary
strengths and weaknesses — any student can be both a tutor and a tutee.

Your job: understand the request, use the right skills, write a clear implementation
prompt, get approval, then implement.

## 1. Workflow

1. Read AGENTS.md.
2. Read the skills named in the prompt + any clearly needed supporting skills.
3. Inspect relevant code.
4. Ask a focused question only if there's real ambiguity.
5. Write a detailed prompt file in prompts/.
6. Ask: "I prepared the implementation prompt at prompts/<name>.md. Good to execute?"
7. Implement only after approval.
8. Run available checks.
9. Share exact test steps.

## 2. Product

Students list their "Skills I Have" (strengths) and "Skills I Need" (weaknesses), discover
tutors by skill/subject, request and confirm tutoring sessions, message to coordinate, and
rate/review afterward.

In scope, by phase: auth + dual tutor/tutee role support + profiling (Phase 1); skill-based
tutor search/filter + request-and-match workflow with tutor notifications (Phase 2);
messaging + scheduling/booking (Phase 3); post-session ratings/reviews + abuse reporting +
peer skill-endorsement (Phase 4); responsive polish, E2E testing/UAT, deployment (Phase 5).

Out of scope unless the contract is revised: this project contract doesn't name any explicit
exclusions yet — treat anything not listed in a phase above (e.g. payments for sessions,
video calling, formal-tutor verification/credentialing) as out of scope until a sprint
explicitly adds it, rather than assuming it's implied.

Do not overbuild. Build phases in order — matching and discovery (Phase 2) depend on
profiling (Sprint 3) already existing; messaging and scheduling (Phase 3) depend on a
confirmed match (Phase 2) existing; feedback (Phase 4) depends on a completed, bookable
session (Phase 3) existing.

## 3. Architecture

- A single user account can hold both the tutor and tutee role simultaneously — never model
  these as separate account types or force a one-or-the-other choice.
- Business logic (matching, request accept/decline, booking confirmation, rating aggregation)
  lives in the backend, not in frontend components.
- UI displays server-backed data only; secrets and privileged operations (password hashing,
  JWT issuance, role checks) stay server-side.
- Messaging and scheduling are separate concerns from the request/match workflow — a request
  being accepted is what unlocks messaging and booking for that pair, not a standalone
  feature either side can reach without a match.

## 4. Tech stack

Use:
- Node.js, Express, PostgreSQL — backend (per Sprint 1).
- Next.js, Tailwind CSS — frontend (per Sprint 1).
- JWT — authentication (per Sprint 2).

The contract does not name specific auth libraries, a real-time messaging technology
(WebSockets vs. polling), or a calendar-integration provider — these are open decisions.
Resolve and record them here explicitly in Sprint 2 (auth) and Sprint 6/7 (messaging/
scheduling) respectively, rather than picking one ad hoc mid-feature.

Do not use: a second backend framework, a second ORM/query approach, or a second frontend
styling system once Sprint 1's choices are made — keep the stack consistent across sprints.

## 5. Data model

Not fully pinned yet — "Database schema design" is itself a Sprint 1 deliverable. At minimum
the schema needs to support:
- **User**: profile fields, university/course identification, password hash (never returned
  to the client), and the ability to hold both tutor and tutee roles at once.
- **Skill**: a shared skill/subject vocabulary that both "Skills I Have" and "Skills I Need"
  reference, so search/filter and matching work against the same taxonomy.
- **Tutoring request**: requester, target tutor, subject/skill, status
  (pending/accepted/declined), timestamps.
- **Session/booking**: linked to an accepted request, time slot, confirmation/reminder state.
- **Review**: linked to a completed session, rating + text, author and subject.
- **Report**: reporter, target user/session, reason, status.

Required before saving: a tutoring request must reference an existing skill and a real tutor
account; a review must reference a session that actually happened (accepted + completed), not
an arbitrary user pair.

## 6. API contracts

Implemented authentication routes:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` (authenticated)
- `POST /api/auth/upgrade-tutor` (authenticated)
- `POST /api/auth/logout`

Implemented tutor profile and discovery routes:
- `GET /api/tutors` (public search/list)
- `GET /api/tutors/:id` (public tutor profile)
- `GET /api/tutors/profile` (authenticated; requires `TUTOR`)
- `PUT /api/tutors/profile` (authenticated; requires `TUTOR`)

Implemented tutor application routes:
- `GET /api/tutor-applications/subjects` (authenticated)
- `GET /api/tutor-applications/me` (authenticated)
- `POST /api/tutor-applications` (authenticated)
- `GET /api/tutor-applications` (authenticated; requires `ADMIN`)
- `PATCH /api/tutor-applications/:id/review` (authenticated; requires `ADMIN`)

Implemented admin dashboard route:
- `GET /api/admin/dashboard` (authenticated; requires `ADMIN`; returns overview counts, safe user records, and approved tutor profiles)

Implemented session-request routes:
- `POST /api/session-requests` (authenticated; requires `STUDENT`; creates a PENDING request for an approved tutor using the authenticated student ID)
- `GET /api/session-requests/mine` (authenticated; requires `STUDENT`; returns only the current student's requests)
- `GET /api/session-requests/incoming` (authenticated; requires `TUTOR`; returns only requests addressed to the current tutor)
- `PATCH /api/session-requests/:id/respond` (authenticated; requires `TUTOR`; accepts or declines a PENDING request addressed to the current tutor)

Email verification, notification, messaging, booking, review, and reporting routes
are not implemented yet. Keep this section in sync as future endpoints are added.

## 7. Security

Never expose to the browser: password hashes, JWT signing secret, database credentials.

Never run from the browser: password hashing, JWT verification, role checks (a user's ability
to accept/decline a request as the target tutor must be checked server-side), report
handling.

Provision the dedicated `admin@universitydomain` account only with the trusted server command
`npm run admin:bootstrap` in `server/`, using a server-only `ADMIN_PASSWORD` environment
variable. Never provision ADMIN through public registration or commit/log the password.

## 8. Code standards

Small functions. Explicit types. No unrelated refactors. No over-engineering. Every
API-backed view needs loading, empty, success, and error states — Sprint 10 explicitly calls
out refining error handling and empty-state UI, so don't defer these to "later" from the
start.

## 9. When in doubt

Keep it small. Use the relevant skill. Ask a focused question. If a decision the contract
doesn't specify (real-time vs. async messaging, calendar integration vs. simple time-slot
picker, skill-endorsement mechanics) comes up, resolve it explicitly in the relevant sprint's
prompt and record the choice here rather than guessing silently.

Save a prompt. Get approval. Implement. Run checks. Share test steps.
