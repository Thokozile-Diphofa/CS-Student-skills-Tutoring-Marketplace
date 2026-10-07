# Implementation Prompt: PayFast Sandbox Session Payments

Implement the approved Sandbox-only feature. Do not rebuild or redesign the application; do not alter authentication architecture, roles, tutor applications, university validation, admin behavior, or existing session-request behavior. Do not add duplicate tables or implement payouts, refunds, subscriptions, commissions, or card storage.

## Repository inspection findings

- The checked-in `server/schema.sql` defines users, roles, tutor profiles, tutor skills, and tutor applications only. It contains neither `session_requests` nor `payments`.
- The Express app in `server/index.js` mounts auth, admin, tutor, and tutor-application routes only; no session-request or payment route exists in this checkout.
- `client/app/dashboard/student/page.tsx` currently displays session-request metrics as unavailable and does not load session rows or a session API.
- The local read-only query of `information_schema.columns` failed with `ENOTFOUND`; the user supplied the verified Neon table definitions below as the implementation source of truth. Do not modify these tables or run destructive DDL.
- No app code or `.env` values were changed/read for this inspection.

## Existing Neon schemas (user-verified)

`session_requests`: `id SERIAL PRIMARY KEY`; `student_id INTEGER NOT NULL REFERENCES users(id)`; `tutor_id INTEGER NOT NULL REFERENCES users(id)`; `subject VARCHAR NOT NULL`; nullable `message TEXT`; nullable `requested_date TIMESTAMPTZ`; `status VARCHAR NOT NULL DEFAULT 'PENDING'`; `created_at` and `updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`.

`payments`: `id SERIAL PRIMARY KEY`; `session_request_id INTEGER NOT NULL UNIQUE REFERENCES session_requests(id) ON DELETE CASCADE`; `student_id` and `tutor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`; `amount NUMERIC(10,2) NOT NULL CHECK (amount > 0)`; `currency VARCHAR(3) NOT NULL DEFAULT 'ZAR'`; nullable `provider VARCHAR(50)` and unique nullable `provider_reference VARCHAR(255)`; `payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING'` constrained to `PENDING`, `PAID`, `FAILED`, `DISPUTED`, `REFUNDED`; `payout_status VARCHAR(30) NOT NULL DEFAULT 'NOT_ELIGIBLE'` constrained to `NOT_ELIGIBLE`, `WAITING_PERIOD`, `PAYOUT_ELIGIBLE`, `PAID_OUT`, `BLOCKED`; nullable `paid_at`, `session_completed_at`, `payout_eligible_at` timestamps; `created_at` and `updated_at` timestamps; and a constraint preventing equal student/tutor IDs.

Never create/drop either table, run destructive migrations, or invent schema changes. Use parameterized SQL and the given columns.

## PayFast documentation and Sandbox key handling

Use current official documentation: [PayFast Developer Documentation](https://developers.payfast.co.za/docs), specifically Custom Payment Integration (hosted form/signature and ITN confirmation), Testing and tools (Sandbox), and Ports and IP addresses. For this Sandbox demo the user explicitly permits returning the required `merchant_key` only as part of PayFast's hosted-form fields. Keep it in `server/.env`, never hard-code it, add a `NEXT_PUBLIC_` variable, persist it, log it, or return unrelated secrets. The frontend may only use the returned fields to POST directly to the configured Sandbox hosted checkout. Do not use live credentials/URLs.

## Intended integration, after gates pass

- Derive the payable amount from the actual accepted session, authenticated student's ownership, and actual tutor profile/session pricing data. The browser sends only a session request ID; ignore/reject any amount field. Require the session's status to be `ACCEPTED`.
- Reuse the actual `payments` table columns. Create or load a pending PAYFAST payment with a unique reference, `payment_status = 'PENDING'`, `payout_status = 'NOT_ELIGIBLE'`; use a transaction/locking or unique constraint consistent with the actual schema to prevent duplicate successful payments.
- Use the official hosted-payment field order and signature procedure from PayFast docs. Correct URL encoding and passphrase handling according to the current guide. Keep sandbox URL configurable from environment; do not hard-code credentials.
- Add authenticated initialization and session-payment-status endpoints with ownership checks. Add an unauthenticated ITN endpoint because PayFast has no student JWT.
- Verify ITN signature, merchant/reference, successful payment status, gross amount against the stored payment, and PayFast's current source/ITN checks. Send the documented server confirmation request to the Sandbox validation endpoint before marking PAID. Only verified ITN may set `payment_status = 'PAID'` and `paid_at`; payout status stays `NOT_ELIGIBLE`.
- Browser return/cancel URLs are informational only. A return URL must never mark payment PAID. Success UI polls/requests server-backed payment status; cancel UI states that payment was not completed.
- Add a student-owned session-request endpoint that selects only rows with `session_requests.student_id = req.user.id`, joined to tutor `users` and `tutor_profiles.hourly_rate` plus the existing `payments` record. The repository currently has no session-request route; add only this minimum GET integration and mount it without changing request creation/acceptance behavior. Render tutor, subject, requested date, status, hourly rate, and payment state in the existing Student Dashboard. Offer Pay only for `ACCEPTED` and unpaid sessions; show Paid when successful, and never offer payment for pending/declined/cancelled/completed requests.
- Add return/success and cancel views. The return view says payment is being verified and polls the authenticated status endpoint; neither browser route updates payment state.
- Derive the payable amount from the tutor profile's actual hourly rate and session row, not request data. On init lock/check the owned accepted session and its unique payment row. Reuse pending/failed payment state as appropriate, reject already paid/blocked states, and preserve one payment row per session request. Always set provider `PAYFAST`, payment `PENDING`, payout `NOT_ELIGIBLE` before checkout.
- The ITN callback URL must come from a configurable public HTTPS environment variable `PAYFAST_NOTIFY_URL`; never default to localhost. Do not install/configure a tunnel without separate approval. Other URLs use existing configured frontend base (`CLIENT_URL`) and `PAYFAST_URL` for Sandbox checkout.
- The ITN callback URL must come from a configurable public HTTPS environment variable such as `PAYFAST_NOTIFY_URL`; never default to a public integration URL that points at localhost. Do not install or configure a tunnel without the user's separate approval.

## Tests and acceptance criteria

Use the existing project test style with mocked database/provider calls; Neon runtime tests may remain blocked by local `ENOTFOUND`, and sandbox checkout requires an interactive account plus a reachable public HTTPS ITN URL. Cover student-only session retrieval/ownership, accepted vs non-accepted requests, ignored/rejected client amount, pending creation, duplicate paid payment rejection, safe status authorization, manual return/cancel not changing status, invalid signature, wrong merchant/reference/status, invalid PayFast source, amount mismatch, server-confirmation failure, verified successful ITN, and payout remaining `NOT_ELIGIBLE`. Also run existing auth/role/tutor-application tests and client lint/type checks. Do not report a sandbox transaction as verified unless it actually ran.

## Final report

Report changed files and routes, server-derived amount calculation, duplicate-payment protection, official signature and ITN verification steps, return/cancel/notify URLs, required environment variables, sandbox testing steps, localhost/HTTPS ITN limitation, tests/results including any `ENOTFOUND`-blocked checks, and confirmation that unrelated authentication/roles/admin/tutor-application logic was untouched.