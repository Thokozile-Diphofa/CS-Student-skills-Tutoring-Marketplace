# Project Contract: CS Student Skills Tutoring Marketplace

## 1. Problem Statement
Students who are strong in a subject and students who are struggling in the same subject rarely find each other, even though peer tutoring is often cheaper and more accessible than formal tutoring.

## 2. Project Goal
To build a marketplace platform that facilitates peer-to-peer tutoring among Computer Science students, allowing them to exchange knowledge based on their strengths and weaknesses.

## 3. Project Phases & Sprints

### Phase 1: Core Infrastructure & Identity
*Focus: Establishing the technical foundation and user management.*

- **Sprint 1: Project Initialization**
    - Backend setup (Node/Express/PostgreSQL).
    - Frontend setup (Next.js/Tailwind).
    - Database schema design.
- **Sprint 2: Authentication & Authorization**
    - JWT-based authentication (Sign-up, Login, Logout).
    - User role management (enabling users to be both tutors and tutees).
    - Password hashing and security implementation.
- **Sprint 3: User Profiling**
    - Profile creation and editing.
    - "Skills I Have" (Strengths) and "Skills I Need" (Weaknesses) management.
    - University/Course identification.

### Phase 2: Matching & Discovery
*Focus: Connecting students based on complementary skills.*

- **Sprint 4: Tutor Discovery Engine**
    - Search functionality by skill/subject.
    - Filtering by availability, rating, or academic year.
    - Tutor profile listing pages.
- **Sprint 5: Request & Match System**
    - Requesting a tutoring session from a tutor.
    - Notification system for tutors upon receiving requests.
    - Workflow for accepting or declining tutoring requests.

### Phase 3: Interaction & Coordination
*Focus: Enabling communication and scheduling of sessions.*

- **Sprint 6: Messaging System**
    - Chat interface for matched peers to coordinate.
    - Real-time or asynchronous messaging.
- **Sprint 7: Scheduling & Booking**
    - Time-slot selection system or calendar integration.
    - Booking confirmation and session reminders.

### Phase 4: Trust, Quality & Feedback
*Focus: Ensuring a high-quality peer tutoring experience.*

- **Sprint 8: Feedback Loop**
    - Post-session rating system.
    - Text reviews to build tutor credibility.
- **Sprint 9: Quality Assurance**
    - Reporting system for inappropriate behavior or disputes.
    - Skill validation mechanism (e.g., peer endorsements).

### Phase 5: Finalization & Launch
*Focus: Polishing the UX and deploying to production.*

- **Sprint 10: UX/UI Polish**
    - Responsive design audits for mobile and desktop.
    - Refinement of error handling and empty state UI.
- **Sprint 11: Testing & QA**
    - End-to-end integration testing.
    - User Acceptance Testing (UAT) with actual students.
- **Sprint 12: Deployment & Handover**
    - Production environment setup and deployment.
    - Final project documentation and handover.
