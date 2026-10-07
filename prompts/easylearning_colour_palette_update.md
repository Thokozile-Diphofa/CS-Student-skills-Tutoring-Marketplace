# EasyLearning Website Colour Palette Update Implementation Prompt

## Objective
Update ONLY the colour palette of the existing EasyLearning website across all pages and components without modifying any layout, dimensions, spacing, forms, components, authentication, API calls, routing, dashboards, database logic, or underlying functionality.

## Brand Tone & Requirements
- Fun, Vibrant, Colourful, Youthful, Friendly, Modern.
- Suitable for university students and professional enough for an educational platform.
- Primary brand colour: Purple (`#6C4CF1`).
- NO PLAIN WHITE half on Login page or Register page. BOTH SIDES MUST HAVE VISIBLE COLOUR.

## Palette Specification
- **Primary Purple:** `#6C4CF1`
- **Bright Purple:** `#8B5CF6`
- **Coral:** `#FF6B6B`
- **Warm Orange:** `#FF8A4C`
- **Golden Yellow:** `#FFD166`
- **Soft Lavender:** `#EDE7FF`
- **Soft Peach:** `#FFE8DD`
- **Dark Purple Text:** `#241B3B`
- **Muted Purple Text:** `#625B71`
- **Success Green:** `#22C55E`
- **Error Red:** `#EF4444`
- **Input Border / Lavender Accent Border:** `#CFC4F8`
- **Page Background Gradient:** `linear-gradient(135deg, #F3EEFF 0%, #FFF0E8 100%)` (or Tailwind equivalent `from-[#F3EEFF] to-[#FFF0E8]`)

## Scope of Changes

### 1. `client/app/globals.css`
- Update CSS variables & `@theme` tokens for Tailwind v4:
  - `--background`: `#F3EEFF`
  - `--foreground`: `#241B3B`
  - Custom color tokens for primary-purple, bright-purple, coral, warm-orange, golden-yellow, soft-lavender, soft-peach, dark-purple, muted-purple, success-green, error-red, and lavender-border.

### 2. Login Page (`client/app/login/page.tsx`) & Register Page (`client/app/register/page.tsx`)
- **Outer Wrapper:** Keep split-screen layout unchanged. Outer container background soft gradient (`from-[#F3EEFF] to-[#FFF0E8]`). Card container border `#CFC4F8`.
- **Left Side:**
  - Background: `linear-gradient(135deg, #6C4CF1 0%, #8B5CF6 100%)`.
  - Headings: `text-white`.
  - Supporting text: `#EDE7FF` (soft lavender).
  - EasyLearning logo icon background: `#FFD166` with `#241B3B` text.
  - Accent highlights / badges: `#FFD166` and `#FF6B6B` / `#FF8A4C`.
  - Feature cards (e.g., "Popular subject support"): translucent lighter purple `rgba(255, 255, 255, 0.12)` with light border `rgba(255, 255, 255, 0.2)`.
- **Right Side:**
  - Main background gradient: `linear-gradient(135deg, #FFE8DD 0%, #EDE7FF 100%)` (soft peach to lavender gradient, NO plain white!).
  - Small section label ("LOGIN" / "REGISTER"): `#6C4CF1`.
  - Main heading: `#241B3B`.
  - Form labels: `#241B3B`.
  - Input fields: background `rgba(255, 255, 255, 0.55)`, border `#CFC4F8`, text `#241B3B`, placeholder `#625B71`, focus border `#6C4CF1`, focus ring transparent purple glow `focus:ring-2 focus:ring-[#6C4CF1]/30`.
  - Checkbox & Links: `#6C4CF1` hover `#8B5CF6`.
  - Error messages: soft red background (`bg-[#EF4444]/10`), border `#EF4444`, text `#EF4444`.
  - Success messages: soft green background (`bg-[#22C55E]/10`), border `#22C55E`, text `#22C55E`.
- **Login / Register Action Button:**
  - Gradient: `linear-gradient(90deg, #6C4CF1, #8B5CF6)`.
  - Hover: `linear-gradient(90deg, #5936E8, #7C3AED)`.
  - Text: `white`.

### 3. Navbar (`client/app/components/Navbar.tsx`) & Header (`client/app/components/DashboardShell.tsx`)
- Header background: `#241B3B` with subtle purple bottom border (`border-[#6C4CF1]/30`).
- Brand logo icon: `#FFD166` background with `#241B3B` text.
- Nav links: `#EDE7FF` with hover `#FFD166`. Active links highlighted with `#FFD166` or soft purple tags.
- Action buttons / Logout: styled using the purple/coral/yellow design system.

### 4. Footer (`client/app/components/Footer.tsx`)
- Background: `#241B3B` or soft lavender gradient (`from-[#EDE7FF] to-[#FFE8DD]`), border `#CFC4F8`.
- Text: `#241B3B` (or `#EDE7FF`), links `#6C4CF1` hover `#8B5CF6`.

### 5. Main Landing Page (`client/app/page.tsx`), Dashboards & Other Pages
- **Pages updated:** Home (`/`), Student Dashboard (`/dashboard/student`), Tutor Dashboard (`/dashboard/tutor`), Admin Dashboard (`/dashboard/admin`), Find Tutors (`/tutors`), Tutor Profile (`/tutors/[id]`), Tutor Application (`/tutor/application`), Become a Tutor (`/become-a-tutor`).
- **Page backgrounds:** soft lavender/peach gradient `linear-gradient(135deg, #F3EEFF 0%, #FFF0E8 100%)`.
- **Cards & Containers:** `bg-white/80` or `bg-white` with `#CFC4F8` borders, text `#241B3B` and subtext `#625B71`.
- **Badges / Buttons / Status Tags:**
  - Primary actions: vibrant purple gradient.
  - Secondary accents: Coral (`#FF6B6B`) / Warm Orange (`#FF8A4C`).
  - Highlights / Tags: Golden Yellow (`#FFD166`) / Soft Lavender (`#EDE7FF`).
  - Approved / Success: Green (`#22C55E`).
  - Pending / Warning: Warm Orange (`#FF8A4C`) / Golden Yellow (`#FFD166`).
  - Rejected / Error: Red (`#EF4444`).

## Non-Functional Requirements & Verification
- Zero change to functional handlers, form validation, state management, router logic, API endpoints, or database operations.
- Build test: `npm run build` in `client/` to verify zero TypeScript or syntax errors.
