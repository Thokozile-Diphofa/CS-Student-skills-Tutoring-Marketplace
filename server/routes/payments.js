const crypto = require("node:crypto");
const express = require("express");
const db = require("../db");
const { authenticateToken, requireRole } = require("../middleware/auth");
const payfast = require("../services/payfast");
const paymentReceipts = require("../services/paymentReceipts");
const receiptEmail = require("../services/receiptEmail");

const router = express.Router();

function getPaymentConfig() {
  const paymentUrl = payfast.getSandboxProcessUrl(process.env.PAYFAST_URL);
  const merchantId = process.env.PAYFAST_MERCHANT_ID?.trim();
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY?.trim();
  const notifyUrl = process.env.PAYFAST_NOTIFY_URL?.trim();
  let parsedNotifyUrl;

  try {
    parsedNotifyUrl = new URL(notifyUrl);
  } catch {
    return null;
  }

  if (!paymentUrl || !merchantId || !merchantKey || parsedNotifyUrl.protocol !== "https:"
    || ["localhost", "127.0.0.1", "::1"].includes(parsedNotifyUrl.hostname)) {
    return null;
  }

  return {
    paymentUrl,
    merchantId,
    merchantKey,
    passphrase: process.env.PAYFAST_PASSPHRASE || "",
    notifyUrl: parsedNotifyUrl.toString()
  };
}

function getClientBaseUrl() {
  const configuredClientUrl = process.env.CLIENT_URL?.trim();
  if (!configuredClientUrl && process.env.NODE_ENV === "production") {
    const error = new Error("CLIENT_URL is required for production payment links.");
    error.code = "CLIENT_URL_MISSING";
    throw error;
  }

  let clientUrl;
  try {
    clientUrl = new URL(configuredClientUrl || "http://localhost:3000");
  } catch {
    const error = new Error("CLIENT_URL is invalid.");
    error.code = "CLIENT_URL_INVALID";
    throw error;
  }

  if (process.env.NODE_ENV === "production"
    && (clientUrl.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(clientUrl.hostname))) {
    const error = new Error("CLIENT_URL must be a public HTTPS origin in production.");
    error.code = "CLIENT_URL_INVALID";
    throw error;
  }

  return clientUrl.origin;
}

function getReceiptUrl(sessionRequestId) {
  return new URL(`/payments/receipt?sessionRequestId=${encodeURIComponent(sessionRequestId)}`, getClientBaseUrl()).toString();
}

function buildCheckoutFields(session, payment, config, clientUrl) {
  const fields = {
    merchant_id: config.merchantId,
    merchant_key: config.merchantKey,
    return_url: `${clientUrl}/payments/return?sessionRequestId=${session.id}`,
    cancel_url: `${clientUrl}/payments/cancelled?sessionRequestId=${session.id}`,
    notify_url: config.notifyUrl,
    name_first: session.student_first_name,
    name_last: session.student_last_name,
    email_address: session.student_email,
    m_payment_id: payment.provider_reference,
    amount: payfast.formatZarAmount(payment.amount),
    item_name: "EasyLearning Tutoring Session"
  };
  fields.signature = payfast.generatePayfastSignature(fields, config.passphrase);
  return fields;
}

router.post("/initialize", authenticateToken, requireRole("STUDENT"), async (req, res) => {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  if (Object.keys(body).some((key) => key !== "sessionRequestId")) {
    return res.status(400).json({ error: "Only sessionRequestId may be provided." });
  }
  const sessionRequestId = Number(body.sessionRequestId);
  if (!Number.isInteger(sessionRequestId) || sessionRequestId < 1) {
    return res.status(400).json({ error: "A valid sessionRequestId is required." });
  }

  const config = getPaymentConfig();
  if (!config) return res.status(503).json({ error: "PayFast Sandbox is not configured." });

  let clientUrl;
  try {
    clientUrl = getClientBaseUrl();
  } catch {
    return res.status(503).json({ error: "Payment return URLs are not configured." });
  }

  let client;
  try {
    client = await db.pool.connect();
    await client.query("BEGIN");
    const sessionResult = await client.query(`
      SELECT sr.id, sr.student_id, sr.tutor_id, sr.status,
             tp.hourly_rate::text AS hourly_rate,
             student.first_name AS student_first_name,
             student.last_name AS student_last_name,
             student.email AS student_email
      FROM session_requests sr
      INNER JOIN users student ON student.id = sr.student_id
      INNER JOIN tutor_profiles tp ON tp.user_id = sr.tutor_id
      WHERE sr.id = $1
      FOR UPDATE OF sr
    `, [sessionRequestId]);

    const session = sessionResult.rows[0];
    if (!session || Number(session.student_id) !== Number(req.user.id)) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Session request not found." });
    }
    if (Number(session.student_id) === Number(session.tutor_id)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "A student cannot pay for their own tutoring session." });
    }
    if (session.status !== "ACCEPTED") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Only accepted sessions can be paid." });
    }

    const amount = payfast.formatZarAmount(session.hourly_rate);
    if (!amount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "The tutor's hourly rate is invalid." });
    }

    const paymentResult = await client.query(
      "SELECT id, student_id, tutor_id, amount::text AS amount, provider, provider_reference, payment_status, payout_status FROM payments WHERE session_request_id = $1 FOR UPDATE",
      [sessionRequestId]
    );
    let payment = paymentResult.rows[0];

    if (payment?.payment_status === "PAID") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "This session has already been paid." });
    }
    if (payment && !["PENDING", "FAILED"].includes(payment.payment_status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "This payment cannot be initialized again." });
    }
    if (payment && (Number(payment.student_id) !== Number(session.student_id)
      || Number(payment.tutor_id) !== Number(session.tutor_id))) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Payment ownership does not match this session." });
    }
    if (payment?.payment_status === "PENDING" && payment.provider_reference
      && (payment.provider !== "PAYFAST" || payfast.formatZarAmount(payment.amount) !== amount)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "A payment is already in progress for a different amount or provider." });
    }

    if (payment?.payment_status === "PENDING" && payment.provider === "PAYFAST" && payment.provider_reference) {
      payment = { ...payment, amount };
    } else {
      const providerReference = `EL-${crypto.randomUUID()}`;
      if (payment) {
        const updateResult = await client.query(`
          UPDATE payments
          SET amount = $1, currency = 'ZAR', provider = 'PAYFAST', provider_reference = $2,
              payment_status = 'PENDING', payout_status = 'NOT_ELIGIBLE', paid_at = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
          RETURNING id, student_id, tutor_id, amount::text AS amount,
                    provider, provider_reference, payment_status, payout_status
        `, [amount, providerReference, payment.id]);
        payment = updateResult.rows[0];
      } else {
        const insertResult = await client.query(`
          INSERT INTO payments (
            session_request_id, student_id, tutor_id, amount, currency,
            provider, provider_reference, payment_status, payout_status
          ) VALUES ($1, $2, $3, $4, 'ZAR', 'PAYFAST', $5, 'PENDING', 'NOT_ELIGIBLE')
          RETURNING id, student_id, tutor_id, amount::text AS amount,
                    provider, provider_reference, payment_status, payout_status
        `, [sessionRequestId, session.student_id, session.tutor_id, amount, providerReference]);
        payment = insertResult.rows[0];
      }
    }

    await client.query("COMMIT");
    return res.json({ paymentUrl: config.paymentUrl, fields: buildCheckoutFields(session, payment, config, clientUrl) });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("Payment initialization failed:", error.code || "database/provider error");
    if (error.code === "23505") return res.status(409).json({ error: "A payment already exists for this session." });
    return res.status(500).json({ error: "Unable to initialize this payment." });
  } finally {
    client?.release();
  }
});

router.get("/session/:sessionRequestId", authenticateToken, requireRole("STUDENT"), async (req, res) => {
  const sessionRequestId = Number(req.params.sessionRequestId);
  if (!Number.isInteger(sessionRequestId) || sessionRequestId < 1) {
    return res.status(400).json({ error: "Invalid session request ID." });
  }

  try {
    const result = await db.query(`
      SELECT sr.id, sr.status AS session_status,
             tp.hourly_rate::text AS hourly_rate,
             p.amount::text AS payment_amount, p.currency,
             p.payment_status, p.payout_status, p.paid_at
      FROM session_requests sr
      LEFT JOIN tutor_profiles tp ON tp.user_id = sr.tutor_id
      LEFT JOIN payments p ON p.session_request_id = sr.id
      WHERE sr.id = $1 AND sr.student_id = $2
    `, [sessionRequestId, req.user.id]);

    if (result.rows.length === 0) return res.status(404).json({ error: "Session request not found." });
    const row = result.rows[0];
    return res.json({
      sessionRequestId: row.id,
      sessionStatus: row.session_status,
      paymentStatus: row.payment_status || null,
      payoutStatus: row.payout_status || "NOT_ELIGIBLE",
      amount: row.payment_amount || row.hourly_rate,
      currency: row.currency || "ZAR",
      paidAt: row.paid_at
    });
  } catch (error) {
    console.error("Fetch payment status failed:", error.code || "database error");
    return res.status(500).json({ error: "Unable to load payment status." });
  }
});

router.get("/receipt/:sessionRequestId", authenticateToken, requireRole("STUDENT"), async (req, res) => {
  const sessionRequestId = Number(req.params.sessionRequestId);
  if (!Number.isInteger(sessionRequestId) || sessionRequestId < 1) {
    return res.status(400).json({ error: "Invalid session request ID." });
  }

  try {
    const receipt = await paymentReceipts.getStudentReceiptBySessionRequestId(sessionRequestId, req.user.id);
    if (!receipt) return res.status(404).json({ error: "Paid receipt not found." });
    return res.json({ receipt });
  } catch (error) {
    console.error("Fetch payment receipt failed:", error.code || "database error");
    return res.status(500).json({ error: "Unable to load payment receipt." });
  }
});

router.post("/payfast/notify", express.urlencoded({ extended: false, limit: "32kb" }), async (req, res) => {
  const config = getPaymentConfig();
  if (!config) return res.status(503).send("Sandbox configuration unavailable");

  const notification = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  if (Array.isArray(notification.signature) || !payfast.verifyPayfastSignature(notification, config.passphrase)) {
    return res.status(400).send("Invalid notification signature");
  }
  if (!payfast.isPayfastIp(req.ip)) return res.status(403).send("Untrusted notification source");
  if (notification.merchant_id !== config.merchantId || !notification.m_payment_id
    || !notification.pf_payment_id || !["COMPLETE", "CANCELLED"].includes(notification.payment_status)) {
    return res.status(400).send("Invalid notification details");
  }

  let client;
  let receiptEmailPaymentId = null;
  try {
    client = await db.pool.connect();
    await client.query("BEGIN");
    const paymentResult = await client.query(`
            SELECT p.id, p.session_request_id, p.amount::text AS amount,
              p.payment_status, p.payout_status, sr.status AS session_status
            FROM payments p
            INNER JOIN session_requests sr ON sr.id = p.session_request_id
            WHERE p.provider = 'PAYFAST' AND p.provider_reference = $1
            FOR UPDATE OF p, sr
    `, [notification.m_payment_id]);
    const payment = paymentResult.rows[0];
    const expectedAmount = payfast.formatZarAmount(payment?.amount);
    const receivedAmount = payfast.formatZarAmount(notification.amount_gross);
    if (!payment || !expectedAmount || receivedAmount !== expectedAmount) {
      await client.query("ROLLBACK");
      return res.status(400).send("Payment reference or amount mismatch");
    }

    const validationUrl = payfast.getSandboxValidationUrl(process.env.PAYFAST_URL);
    const validationResponse = await fetch(validationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payfast.buildPayfastParameterString(notification),
      signal: AbortSignal.timeout(10000)
    });
    if (!validationResponse.ok || (await validationResponse.text()).trim() !== "VALID") {
      await client.query("ROLLBACK");
      return res.status(400).send("PayFast server validation failed");
    }

    if (payment.payment_status === "PAID") {
      await client.query("COMMIT");
      return res.status(200).send("Payment already recorded");
    }
    if (payment.payment_status !== "PENDING" || payment.payout_status !== "NOT_ELIGIBLE") {
      await client.query("ROLLBACK");
      return res.status(409).send("Payment is not eligible for this notification");
    }
    if (notification.payment_status === "COMPLETE" && payment.session_status !== "ACCEPTED") {
      await client.query("ROLLBACK");
      return res.status(409).send("Session is not accepted for payment");
    }

    if (notification.payment_status === "COMPLETE") {
      await client.query(`
        UPDATE payments
        SET payment_status = 'PAID', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND payment_status = 'PENDING' AND payout_status = 'NOT_ELIGIBLE'
      `, [payment.id]);
      receiptEmailPaymentId = payment.id;
    } else {
      await client.query(`
        UPDATE payments
        SET payment_status = 'FAILED', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND payment_status = 'PENDING' AND payout_status = 'NOT_ELIGIBLE'
      `, [payment.id]);
    }
    await client.query("COMMIT");

    if (receiptEmailPaymentId !== null) {
      try {
        const receipt = await paymentReceipts.getReceiptByPaymentId(receiptEmailPaymentId);
        if (!receipt) throw new Error("Verified payment receipt could not be loaded.");
        receipt.receiptUrl = getReceiptUrl(receipt.sessionRequestId);
        await receiptEmail.sendPaymentReceiptEmail(receipt);
      } catch (error) {
        console.error("Payment receipt email failed:", error.code || error.name || "email error");
      }
    }

    return res.status(200).send("Notification verified");
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("PayFast notification processing failed:", error.code || "verification error");
    return res.status(500).send("Unable to process notification");
  } finally {
    client?.release();
  }
});

module.exports = router;