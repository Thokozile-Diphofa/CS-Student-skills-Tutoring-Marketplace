# Implementation Prompt: Verified Payment Receipts and Email

Implement only after approval. Add a receipt available to the paying student and an email confirmation after PayFast successfully verifies an ITN. Preserve the existing PayFast integration, session payment eligibility, payment state model, and current auth/role system.

## Inspection findings

- `POST /api/payments/initialize` in `server/routes/payments.js` authenticates STUDENT, locks the existing `session_requests` row, verifies ownership and exact `ACCEPTED` status from the database, and creates/reuses a `PENDING` payment. It does not trust client status.
- `POST /api/payments/payfast/notify` verifies signature, source IP, merchant ID, payment reference, amount, and PayFast server validation before changing `payments.payment_status` to `PAID`. It locks the payment row and returns early when it is already `PAID`, so notification handling is already transactionally idempotent.
- The Student Dashboard displays payment/session data. The return page polls the authenticated payment-status endpoint; neither currently offers a receipt.
- Existing relevant values are available from `payments`, `session_requests`, and `users` joins. `server/schema.sql` does not define `payments` or `session_requests`; do not add a schema migration for receipt fields.
- No server-side mail service or PDF-generation dependency/configuration exists in `server/package.json` or server services.
- The Admin dashboard has no existing payment-list/view feature; do not add one as part of this task.
- Production origins are the existing Vercel client and Render API from the request. `CLIENT_URL` already constructs PayFast return/cancel URLs and must also be used for the emailed receipt link.
- The ITN handler currently validates `req.socket.remoteAddress` against PayFast IP ranges. Render terminates inbound TLS at its load balancer and forwards traffic to the service. Before changing this check, verify the trusted Render client-IP forwarding behavior. If needed, use only Render’s trusted forwarded client address while preserving the same PayFast IP allowlist; do not trust arbitrary user-supplied forwarding headers or weaken signature/amount verification.

## Required implementation

### Eligibility and verified state

- Preserve the existing server-side exact `session_requests.status === 'ACCEPTED'` check in payment initialization. Add no frontend status trust and no new status model.
- Keep payment `PAID` transitions exclusively behind the existing successful ITN verification.
- Re-check the associated session is still `ACCEPTED` inside ITN processing before marking payment PAID, so a session declined after checkout cannot become a confirmed payable session. Do not make a declined/PENDING checkout or mark it PAID.
- Do not create, delete, or migrate schema unless inspection proves an unavoidable storage requirement. Derive stable receipt number from the existing unique `payments.id` (for example `EL-RCPT-${id}`); preserve all payment history.

### Receipt access and presentation

- Add an authenticated student receipt API that loads only a `PAID` payment owned by `req.user.id`, joined to the real student, tutor, subject, session date, amount, currency, paid date, and provider reference. Never trust an email, amount, status, or owner from the browser.
- Return only receipt fields; never merchant keys, passphrases, or other PayFast secrets.
- Add a small printable receipt page and a View/Download-or-Print Receipt affordance in existing Student payment views only when payment status is `PAID`. Use the authenticated API and existing `credentials: "include"` pattern. Provide browser print/save-to-PDF rather than adding a PDF dependency; no PDF library currently exists.
- The receipt link emailed to the student should point to the Vercel `CLIENT_URL` receipt page. Access must still require authentication and verify student ownership server-side.
- Do not change the Admin dashboard or add Admin payment navigation.

### Email delivery

- Use one server-side SMTP transport with Nodemailer; no mailer currently exists. Add only the needed dependency and use environment variables on Render: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. Derive TLS behavior from the configured port or support an optional `SMTP_SECURE`; never hardcode credentials or expose them to Vercel/browser code.
- Read the destination address and student name from the database, not from PayFast callback fields or frontend input.
- Send only after a verified transition from PENDING to PAID and after the DB transaction commits. Include confirmation, student/tutor names, subject, date, amount, receipt number, provider reference when available, and the authenticated receipt link.
- Keep the receipt endpoint available even if email delivery fails. Catch/log email failure without rolling back PAID or returning a failure that encourages creation of a duplicate payment. Use no sensitive values in logs.
- Do not send another receipt email for duplicate ITNs. The existing payment row lock/PAID early return should ensure only the transition winner attempts email. Do not add email-sent schema unless testing proves the existing idempotent transition cannot guarantee one attempt.

### PayFast and production constraints

- Keep Sandbox URL/config, parameter signing, signature validation, amount validation, merchant checks, ITN status validation, and current payment records intact.
- Ensure the notification URL remains the Render endpoint `/api/payments/payfast/notify`; return/cancel and receipt links use `CLIENT_URL`.
- Preserve current Student/Tutor/Admin authorization. No payment API may let another student access a receipt.

## Tests

- Preserve existing accepted-session initialization, pending/declined rejection, ownership, role, signature, amount, and PayFast verification tests.
- Add notification tests proving one verified transition marks PAID, creates a stable receipt number/link from stored DB data, and attempts one email only after commit.
- Duplicate the same valid ITN and verify it does not create another payment, receipt identity, or email attempt.
- Simulate SMTP failure; assert payment remains PAID and receipt remains retrievable, with no duplicate payment.
- Test receipt authentication, non-PAID rejection, owner-only access, and that other users cannot fetch it by changing the ID.
- Test session status changed to DECLINED before ITN processing: do not mark payment PAID or issue a confirmed receipt.
- Keep tests DB-mocked; do not use real Render credentials or perform real charges.

## Validation and reporting

- Run focused payment tests and full `npm.cmd test` from `server/`.
- Run the client production build and changed-file diagnostics/lint where available.
- Report exact new Render-only SMTP variables and note that they require a real SMTP provider/account; do not ask the user to put secrets into source control or Vercel frontend variables.
- State clearly that local mocks do not prove deployed PayFast/SMTP delivery. Provide safe test steps for Render Sandbox after configuration.
- Do not modify `.env`, unrelated APIs, schema, auth, role logic, or unrelated UI.
