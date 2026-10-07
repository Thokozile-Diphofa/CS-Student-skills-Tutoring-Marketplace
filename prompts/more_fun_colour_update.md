# EasyLearning "More Fun" Colour Palette Enhancement Prompt

## Objective
Enhance the EasyLearning website colour scheme to make it significantly more **fun, vibrant, colorful, youthful, and friendly**, directly addressing user feedback on the login/register and dashboard pages while strictly keeping all layout, dimensions, spacing, forms, components, authentication, API calls, routing, dashboards, database logic, and functionality unchanged.

## Palette Specification
- **Primary Purple:** `#6C4CF1`
- **Bright Purple:** `#8B5CF6`
- **Coral:** `#FF6B6B`
- **Warm Orange:** `#FF8A4C`
- **Golden Yellow:** `#FFD166`
- **Soft Lavender:** `#EDE7FF`
- **Soft Peach:** `#FFE8DD`
- **Light Yellow Tint:** `#FFF3D6`
- **Dark Purple Text:** `#241B3B`
- **Muted Purple Text:** `#625B71`
- **Success Green:** `#22C55E`
- **Error Red:** `#EF4444`
- **Lavender Border:** `#CFC4F8`

## Specific Colour Enhancements

### 1. Login Page (`client/app/login/page.tsx`) & Register Page (`client/app/register/page.tsx`)
- **Right Side Background (Fun Warm Gradient)**:
  - Upgrade background to a multi-stop warm-to-lavender gradient:
    `linear-gradient(135deg, #FFE8DD 0%, #FFF3D6 45%, #EDE7FF 100%)`
  - Add colorful ambient glow highlights behind the form for an energetic, youthful feel.
- **Section Badges ("LOGIN" / "REGISTER")**:
  - Style as a fun pill badge: `bg-[#FFD166] text-[#241B3B] font-extrabold px-3 py-1 rounded-full text-xs uppercase tracking-wider shadow-sm`.
- **Login / Register Action Button (Vibrant Multi-Color Gradient)**:
  - Upgrade button gradient from flat purple to a vibrant purple-to-coral gradient:
    `linear-gradient(90deg, #6C4CF1 0%, #8B5CF6 50%, #FF6B6B 100%)`
  - Add a soft vibrant colored shadow: `shadow-md shadow-[#6C4CF1]/30 hover:shadow-lg hover:shadow-[#FF6B6B]/40 hover:-translate-y-0.5 transition-all`.
- **Form Inputs**:
  - Background `rgba(255, 255, 255, 0.75)`, border `#CFC4F8`, focus border `#6C4CF1` with a fun ring `focus:ring-4 focus:ring-[#8B5CF6]/20`.
- **Left Side**:
  - Gradient `linear-gradient(135deg, #6C4CF1 0%, #8B5CF6 60%, #FF6B6B 100%)`.
  - Feature cards with translucent background `rgba(255, 255, 255, 0.15)` and bright yellow `#FFD166` / coral `#FF6B6B` pill highlights.

### 2. Navbar & Header (`Navbar.tsx`, `DashboardShell.tsx`)
- Navbar logo badge: `#FFD166` with `#241B3B` text and subtle coral accent shadow.
- Nav links: `#EDE7FF` with vibrant `#FFD166` hover and active indicator.
- Role Badges:
  - TUTOR: `#22C55E` green with `#22C55E`/20 background pill.
  - STUDENT: `#FFD166` yellow with `#FFD166`/20 background pill.

### 3. Global Page Backgrounds & Cards (`globals.css`, `page.tsx`, Dashboards)
- Site-wide body background gradient:
  `linear-gradient(135deg, #F3EEFF 0%, #FFE8DD 50%, #FFF3D6 100%)`
- Cards: `bg-white/85` with `#CFC4F8` borders and fun top border color accents (Primary Purple, Coral, Warm Orange, Golden Yellow).

## Non-Functional Requirements & Verification
- Zero change to functional handlers, form validation, state management, router logic, API endpoints, or database operations.
- Run `cmd /c "npm run build"` in `client/` to verify clean compilation.
