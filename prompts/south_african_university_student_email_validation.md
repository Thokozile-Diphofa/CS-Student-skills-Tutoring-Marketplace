# Implementation Prompt: South African University Student Email Validation

Implement the user's requested registration update only after approval of this prompt. Do not redesign the registration page or alter authentication architecture, roles, dashboards, tutor applications, session requests, payments, API routes, or unrelated functionality.

## Existing implementation

- `client/config/universities.json` is already imported by `client/app/register/page.tsx` and `server/universities.js`; preserve it as the single shared source of university codes and email rules.
- The JSON currently contains only TUT and UP. Both currently have regex patterns, but these rules must be re-verified against current official student/ICT documentation before being treated as verified.
- `server/routes/auth.js` independently calls `validateStudentEmail` before inserting a public registration. Keep validation server-side and return HTTP 400 for invalid or unconfigured choices.
- `server/test/authRegistration.test.js` covers existing registration/login/role behavior. Extend it without weakening existing checks.
- The registration page already has a university dropdown, immediate email validation, and helper text. Keep its current layout and styles; make only the requested behavior changes.

## University list

Add exactly these 26 public universities, alphabetically by full name, retaining `Select your university` as the disabled default:

1. Cape Peninsula University of Technology (CPUT)
2. Central University of Technology (CUT)
3. Durban University of Technology (DUT)
4. Mangosuthu University of Technology (MUT)
5. Nelson Mandela University (NMU)
6. North-West University (NWU)
7. Rhodes University (RU)
8. Sefako Makgatho Health Sciences University (SMU)
9. Sol Plaatje University (SPU)
10. Stellenbosch University (SU)
11. Tshwane University of Technology (TUT)
12. University of Cape Town (UCT)
13. University of Fort Hare (UFH)
14. University of Johannesburg (UJ)
15. University of KwaZulu-Natal (UKZN)
16. University of Limpopo (UL)
17. University of Mpumalanga (UMP)
18. University of Pretoria (UP)
19. University of South Africa (UNISA)
20. University of the Free State (UFS)
21. University of the Western Cape (UWC)
22. University of the Witwatersrand (Wits)
23. University of Venda (UNIVEN)
24. University of Zululand (UNIZULU)
25. Vaal University of Technology (VUT)
26. Walter Sisulu University (WSU)

## Official verification required

For each university, research its current student email domain and format using an official university ICT, student portal, or student support source. Record the source URL and what it establishes. Do not infer a student email domain from the university's public website domain; do not treat search-engine summaries, third-party pages, or undated hearsay as verification. Distinguish current and legacy domains, and only include a legacy domain if an official source confirms it remains valid for current students.

The user specifically identifies these examples as expected patterns to verify: UCT `studentnumber@myuct.ac.za`, Wits `studentnumber@students.wits.ac.za`, and CPUT `studentnumber@mycput.ac.za`. The existing TUT and UP rules also require official-source verification. Do not assume any of them is current solely because it appears in existing code or this prompt.

Keep every domain or format that cannot be confirmed in a manual-verification state with no accepted domains and `emailVerificationConfigured: false`. Do not permit public registration for such a university until configured; show a clear message and do not fall back to personal email. For confirmed universities, include the evidence URL, the accepted domains, and a regex reflecting the officially documented format. Do not make the regex more permissive than the source supports. Examples must be fictional student identifiers.

The shared JSON should contain, at minimum, `code`, `name`, `studentEmailDomains`, `studentEmailRegex` (or an equivalently named format pattern), `example`, `emailVerificationConfigured`, and source/verification metadata. Keep frontend and backend behavior derived from this shared configuration; do not create parallel hand-maintained university rule lists.

## Registration behavior

- On university selection, update the email helper text to the selected university's example. Show no example before selection.
- Keep an immediate friendly frontend validation error. A wrong domain should distinguish an email that does not match the selected university from a malformed email. For an unconfigured university, explain that its official email format is not yet configured; never accept Gmail or another university's address.
- The Express registration endpoint must independently validate supported university, syntactically valid email, matching configured domain, and the documented student identifier format. Ignore browser claims and use only server-loaded configuration. Return HTTP 400 with a clear message on failure.
- Keep `users.university` and `users.email`; make no schema changes and do not alter existing users.
- Public registration must continue creating STUDENT only. Do not add ADMIN registration or automatic TUTOR role assignment. Preserve the existing application/admin approval path, login, role redirects, and dedicated-admin bootstrap behavior. The dedicated admin account is not a student signup and must not be subjected to student email validation.

## Required tests

Add/adjust focused tests to cover:

1. Exactly 26 options appear in alphabetical order, with the disabled default option.
2. Each email rule is tested as configured only when officially verified; every unverified entry rejects signup.
3. Matching valid university email is accepted; malformed email, Gmail, and another university's address are rejected with 400.
4. UCT `@myuct.ac.za`, Wits `@students.wits.ac.za`, and CPUT `@mycput.ac.za` are accepted only with their valid documented local-part formats and matching selection.
5. Changing the selected university changes the helper example, and no example is shown before selection.
6. Direct API registration attempts cannot bypass frontend validation.
7. Existing login and STUDENT/TUTOR/ADMIN routing and dedicated-admin bootstrap tests still pass; public ADMIN creation remains rejected and public registrations remain STUDENT-only.

Run the server test suite and the relevant client lint/type checks available in the repository. Do not modify unrelated failing tests.

## Final report

Provide a table with one row per university and columns: University, Abbreviation, Verified student email domain, Expected format, Example, Verification source, Status. Separate rows into VERIFIED and NEEDS MANUAL VERIFICATION. Also report changed files, the shared configuration location, frontend/backend validation behavior, tests performed, and confirmation that roles/authentication were not changed. Explicitly list any universities still requiring manual verification.