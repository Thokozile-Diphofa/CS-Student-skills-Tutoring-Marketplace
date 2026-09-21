# Implementation Prompt: EasyLearning CS Student Skills Tutoring Marketplace

## Objective
Build the full peer-to-peer CS Student Skills Tutoring Marketplace application based on the 5 provided design mockups ("EasyLearning"). The implementation includes backend Express REST API services and a dynamic, responsive Next.js + Tailwind CSS frontend interface matching all 4 core views (Find Tutors, Tutor Profile & Request Session, Tutor Dashboard, and Admin Overview).

---

## 1. Visual Design & Theme Guidelines
- **Header & Navigation**:
  - Dark slate/navy background (`#0F172A` / `#1E293B`).
  - Active navigation indicator (gold underline `#EAB308`).
  - Brand Logo: Square icon ("E" in yellow for Student/Tutor views, "A" in red for Admin view) + "EasyLearning" text.
  - Role View Selector: Switch easily between Student ("Find Tutors" / "Request Session"), Tutor ("Tutor Dashboard"), and Admin ("System Overview").
  - User identity badge on top right with avatar photo.
- **Card & Color Palette**:
  - Background: Soft off-white canvas (`#F8FAFC`).
  - Content Cards: White background with rounded corners (`rounded-2xl` / `rounded-xl`), subtle border (`border border-slate-200/80`), and light shadows.
  - Primary Action Buttons: Golden yellow (`bg-amber-500` / `#EAB308` hover `#D97706`), Emerald green (`bg-emerald-500` hover `#059669`) for accept actions, Red outline for decline actions.
  - Badges: Light green pill (`bg-emerald-100 text-emerald-700`) for "VERIFIED PEER TUTOR".

---

## 2. Views & Component Structure

### A. Navigation Bar (`client/app/components/Navbar.tsx`)
- Logo with toggle icon (Student/Tutor yellow "E", Admin red "A").
- Navigation tabs:
  - Student: `Dashboard`, `Find Tutors`, `My Sessions`, `Community`.
  - Admin: `Overview`, `User Directory`, `System Status`.
- Current User Profile Display + View Mode Switcher dropdown (Student, Tutor, Admin).

### B. Find Tutors Page (`client/app/tutors/page.tsx` & Home Page `/`)
- **Filters Sidebar**:
  - University checkboxes (Wits University, UCT, Stellenbosch, University of Pretoria).
  - Primary Subjects checkboxes (Mathematics, Statistics, Computer Science, Accounting, Physics).
  - Hourly Rate Range checkboxes (R100 - R150, R150 - R220, R220 - R300, R300+).
  - "Reset All Filters" button.
- **Search & Filter Tags Bar**:
  - Search input box (e.g. "Calculus").
  - Active filter tags with removable `✕` badges (e.g., `Wits ✕`, `UCT ✕`, `R150 - R220 ✕`, `Mathematics ✕`).
- **Tutor Cards Grid**:
  - Tutor card displaying profile image, name, university, degree & academic year.
  - Subject tag badge (e.g., `Calculus 101`) & rating score (`⭐ 4.9`).
  - Hourly rate (e.g., `R180 / hour`).
  - `Request` button navigating to tutor profile page (`/tutors/[id]`).

### C. Tutor Profile & Request Session Page (`client/app/tutors/[id]/page.tsx`)
- **Left Column**:
  - Profile Header Card: Avatar photo, "VERIFIED PEER TUTOR" badge, Name, University, Degree, Star Rating, Review count, Hourly rate.
  - "About Me" Card: Bio and teaching background.
  - "Student Reviews" Card: List of reviews with author name, course year, relative date, and testimonial text.
- **Right Column ("Request a Session" Card)**:
  - Subject / Course selector dropdown.
  - Session Duration selector dropdown (e.g., 1 Hour, 1.5 Hours, 2 Hours).
  - Message / Goals textarea ("Tell Thabo what you are struggling with...").
  - Live Pricing Breakdown Box:
    - Hourly Rate calculation.
    - Duration display.
    - Total Price calculation (Rate × Duration).
  - "Send Session Request" button with submission feedback modal/toast.

### D. Tutor Dashboard (`client/app/dashboard/page.tsx`)
- **Tutor Summary (Left Column)**:
  - Dark Navy Card: Monthly Earnings (`R4,200 ZAR`), updated live counter, total hours taught.
  - Active Requests Card: Pending count with amber alert highlight.
  - Average Rating Card: Star rating (`4.9 Stars`), total reviews count.
- **Incoming Tutoring Requests (Right Column)**:
  - Request cards with requester profile image, name, university, course year, session duration, and total payment.
  - Request details & student message box.
  - Interactive "Accept Request" (emerald green) and "Decline" (red outline) action buttons with instant UI state updates.

### E. Admin Overview Dashboard (`client/app/admin/page.tsx`)
- **System Overview Cards**:
  - Total Students (`2,450`, ↑ 12% growth).
  - Verified Tutors (`320`, ↑ 4% growth).
  - Completed Sessions (`12,840`, ↑ 18% growth).
- **Monthly Session Trends Chart**:
  - Visual monthly session bar chart matching the mockup (Mar, Apr, May, Jun, Jul, Aug, Sep).
- **System Activity Feed**:
  - Feed list of real-time administrative logs (New tutor verified, Flagged review, Session payout processed, Tutor status suspended).

---

## 3. Backend Express API (`server/index.js` & Routes)
- `GET /api/tutors`: Filterable endpoint returning list of peer tutors by search query, university, subject, and price range.
- `GET /api/tutors/:id`: Single tutor profile endpoint returning tutor info and reviews.
- `POST /api/requests`: Create a session request between student and tutor.
- `GET /api/requests`: Retrieve incoming requests for the tutor dashboard.
- `PATCH /api/requests/:id`: Accept or decline a tutoring request.
- `GET /api/admin/stats`: Metrics, monthly trends, and activity feed for administrative overview.

---

## 4. Verification Plan
- Launch Node/Express backend (`server`) and verify API endpoints respond with structured JSON.
- Launch Next.js frontend (`client`) and verify layout rendering, filter state changes, request form calculations, tab navigation, and responsiveness.
- Run `npm run build` in client to ensure error-free TypeScript compilation.
