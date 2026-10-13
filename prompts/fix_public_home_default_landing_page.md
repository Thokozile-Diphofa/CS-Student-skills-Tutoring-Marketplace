# EasyLearning — Fix the Default Landing Page

## Objective

Ensure the public home page at `/` remains accessible regardless of authentication state while preserving existing role-based dashboard protection and navigation.

## Confirmed cause

`client/app/page.tsx` currently calls `/api/auth/me` in a client effect and uses `getHomeRouteDecision` to redirect authenticated users to a role-specific dashboard. If the auth request fails, the page also shows an error instead of public content. No Next.js middleware or routing-level root redirect was found. `Navbar.tsx` separately points the authenticated brand link to the user's dashboard, so it cannot be used to return to Home while signed in. Dashboard pages have their own authorization checks.

## Required implementation

- Remove the root page's authentication check, redirect, and access-state gate so the existing Home page renders publicly for signed-out and signed-in visitors.
- Make the EasyLearning brand link in `Navbar.tsx` point to `/` for every visitor.
- Remove the now-unused root redirect helper and its TypeScript declaration; update the focused routing tests to retain coverage of role-to-dashboard routing and application-status labels without asserting that Home redirects authenticated users.
- Leave Login, Register, Logout destinations and dashboard authorization checks unchanged.
- Do not change unrelated pages or functionality.

## Verification

- Run the focused client routing test and the client production build or TypeScript validation.
- Run `git diff --check`.
- Confirm `/` no longer calls auth or redirects, while dashboard route authorization code remains unchanged.
