# Implementation Prompt: Login Page Error Handling and Responsive Layout

## Objective
Fix the login page's fragile error handling and improve its responsive behavior while preserving the existing EasyLearning design, login API contract, and role-based navigation.

## Scope
- Work only in `client/app/login/page.tsx` unless a focused issue requires a nearby change.
- Keep the existing Next.js Client Component, API endpoint, credentials behavior, and post-login destinations.
- Safely handle unsuccessful or non-JSON API responses so backend errors are not mislabeled as network failures.
- Ensure loading state is restored for all failed submissions and prevent duplicate submissions while loading.
- Make the two-column welcome/form layout comfortable on narrow and short viewports. Avoid forcing a tall minimum height on stacked mobile content, preserve readable spacing, and prevent horizontal overflow.
- Keep labels, error feedback, password visibility, and keyboard-accessible form controls functional.
- Do not add dependencies or expand authentication behavior.

## Verification
- Run the client ESLint check and production build.
- Confirm no TypeScript/editor errors in the changed page.
- Manually inspect the login view at a narrow mobile width (around 375px) and a desktop width; confirm the stacked mobile layout scrolls naturally, the form remains usable, and the desktop split layout is preserved.
- Exercise invalid credentials and an unavailable/non-JSON backend response, confirming useful feedback and that the submit button becomes usable again.