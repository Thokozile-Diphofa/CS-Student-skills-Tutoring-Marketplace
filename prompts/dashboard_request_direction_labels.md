# Implementation Prompt: Role-Specific Request Labels

## Objective
Clarify that the student request section represents requests the student sent, while the tutor section represents requests students sent to the tutor.

## Scope
- In `client/app/components/DashboardShell.tsx`, label the student navigation item `My Session Requests` and the tutor navigation item `Incoming Requests`.
- In `client/app/dashboard/student/page.tsx`, use the heading `My Session Requests` and state that requests the student sent to tutors belong in this section.
- In `client/app/dashboard/tutor/page.tsx`, use the heading `Incoming Requests` and state that requests students sent to this tutor belong in this section.
- Keep the existing `#requests` anchors and placeholder behavior. No session-request API exists, so do not fabricate request records, statuses, or actions and do not add backend behavior.
- Preserve existing dashboard design and unrelated changes.

## Verification
- Run client ESLint and the production build.
- Confirm the role-specific labels and direction copy render in the student and tutor dashboards.