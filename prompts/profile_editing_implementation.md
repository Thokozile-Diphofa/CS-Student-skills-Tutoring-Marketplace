# Implementation Prompt: Update Profiles at Any Time

## Objective
Allow authenticated students and tutors to update their profile details any time after registration, without forcing a re-registration flow or hiding the update behind a one-time-only route.

## Findings
- Authenticated users already have a read-only `GET /api/auth/me` route and a tutor-specific `PUT /api/tutors/profile` route.
- Students do not currently have a server-supported profile update route, and the dashboard UI does not expose any editable fields.
- Tutor dashboards display profile data read-only even though tutors need to change subjects, headline, bio, rate, and personal details at any time.

## Requirements
- Add a `PUT /api/auth/me` authenticated route for updating the currently logged-in user’s personal profile information.
- Validate `firstName`, `lastName`, `university`, and `email` with the same rules used during registration.
- Reject reserved admin email changes; reject invalid email or university mismatches; ensure email uniqueness when changed.
- Refresh the JWT cookie after a successful profile update so subsequent requests use the new user data.
- Keep `PUT /api/tutors/profile` for tutor-specific fields (`headline`, `bio`, `hourlyRate`, `subjects`), and expose that form in the tutor dashboard.
- Add editable profile forms to the student and tutor dashboards so users can update their information without leaving the dashboard.
- Preserve role checks, database integrity, and the existing user model.

## Verification
- Run the focused auth test coverage for profile updates.
- Check the dashboards still render and accept the updated user payload.
- Build the client to confirm the new forms compile successfully.
