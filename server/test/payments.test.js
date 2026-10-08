const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const cookieParser = require("cookie-parser");
const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db");
const tutorApplicationService = require("../services/tutorApplications");
const payfast = require("../services/payfast");
const receiptEmail = require("../services/receiptEmail");

const originalQuery = db.query;
const originalPool = db.pool;
const originalGetEffectiveRoles = tutorApplicationService.getEffectiveRoles;
const originalFetch = global.fetch;
const originalIsPayfastIp = payfast.isPayfastIp;
const originalSendPaymentReceiptEmail = receiptEmail.sendPaymentReceiptEmail;
const originalEnvironment = Object.fromEntries([
  "PAYFAST_URL",
  "PAYFAST_MERCHANT_ID",
  "PAYFAST_MERCHANT_KEY",
  "PAYFAST_PASSPHRASE",
  "PAYFAST_NOTIFY_URL",
  "CLIENT_URL"
].map((name) => [name, process.env[name]]));
const activeHarnesses = [];

async function createHarness({ sessionStatus = "ACCEPTED", studentId = 7, tutorId = 31, roles = ["STUDENT"], failReceiptEmail = false } = {}) {
  const state = {
    transactionOpen: false,
    session: {
      id: 10,
      student_id: studentId,
      tutor_id: tutorId,
      status: sessionStatus,
      subject: "Mathematics",
      requested_date: "2026-10-09T10:00:00.000Z",
      hourly_rate: "150.00",
      student_first_name: "Student",
      student_last_name: "Example",
      student_email: "student@university.test",
      tutor_first_name: "Tutor",
      tutor_last_name: "Example"
    },
    payment: null
  };
  const counters = { serverValidation: 0, emailAttempts: 0, emailedReceipt: null, payfastAddress: null };

  db.query = async (text, params = []) => {
    const query = text.replace(/\s+/g, " ").trim().toLowerCase();
    if (query.includes("from session_requests sr") && query.includes("p.payment_status")) {
      if (Number(params[0]) !== state.session.id || Number(params[1]) !== state.session.student_id) return { rows: [] };
      return { rows: [{
        id: state.session.id,
        session_status: state.session.status,
        hourly_rate: state.session.hourly_rate,
        payment_amount: state.payment?.amount || null,
        currency: state.payment?.currency || null,
        payment_status: state.payment?.payment_status || null,
        payout_status: state.payment?.payout_status || null,
        paid_at: state.payment?.paid_at || null
      }] };
    }
    if (query.startsWith("select p.id as payment_id") && query.includes("and p.id = $1")) {
      if (Number(params[0]) !== state.payment?.id || state.payment?.payment_status !== "PAID") return { rows: [] };
      return { rows: [{
        payment_id: state.payment.id,
        session_request_id: state.session.id,
        amount: state.payment.amount,
        currency: state.payment.currency,
        paid_at: state.payment.paid_at,
        provider_reference: state.payment.provider_reference,
        subject: state.session.subject,
        session_date: state.session.requested_date,
        student_first_name: state.session.student_first_name,
        student_last_name: state.session.student_last_name,
        student_email: state.session.student_email,
        tutor_first_name: state.session.tutor_first_name,
        tutor_last_name: state.session.tutor_last_name
      }] };
    }
    if (query.startsWith("select p.id as payment_id")) {
      const [sessionRequestId, ownerId] = params;
      if (Number(sessionRequestId) !== state.session.id || Number(ownerId) !== state.session.student_id
        || state.payment?.payment_status !== "PAID") return { rows: [] };
      return { rows: [{

        payment_id: state.payment.id,
        session_request_id: state.session.id,
        amount: state.payment.amount,
        currency: state.payment.currency,
        paid_at: state.payment.paid_at,
        provider_reference: state.payment.provider_reference,
        subject: state.session.subject,
        session_date: state.session.requested_date,
        student_first_name: state.session.student_first_name,
        student_last_name: state.session.student_last_name,
        student_email: state.session.student_email,
        tutor_first_name: state.session.tutor_first_name,
        tutor_last_name: state.session.tutor_last_name
      }] };
    }
    throw new Error(`Unexpected fake database query: ${query}`);
  };

  const client = {
    async query(text, params = []) {
      const query = text.replace(/\s+/g, " ").trim().toLowerCase();
      if (query === "begin") state.transactionOpen = true;
      if (query === "commit" || query === "rollback") state.transactionOpen = false;
      if (["begin", "commit", "rollback"].includes(query)) return { rows: [] };
      if (query.includes("from session_requests sr") && query.includes("for update of sr")) {
        return Number(params[0]) === state.session.id ? { rows: [{ ...state.session }] } : { rows: [] };
      }
      if (query.startsWith("select id, student_id, tutor_id, amount::text as amount, provider, provider_reference, payment_status, payout_status from payments")) {
        return state.payment && Number(params[0]) === state.payment.session_request_id
          ? { rows: [{ ...state.payment }] }
          : { rows: [] };
      }
      if (query.startsWith("insert into payments")) {
        const [sessionRequestId, studentId, tutorId, amount, providerReference] = params;
        state.payment = {
          id: 5,
          session_request_id: sessionRequestId,
          student_id: studentId,
          tutor_id: tutorId,
          amount,
          currency: "ZAR",
          provider: "PAYFAST",
          provider_reference: providerReference,
          payment_status: "PENDING",
          payout_status: "NOT_ELIGIBLE",
          paid_at: null
        };
        return { rows: [{ ...state.payment }] };
      }
      if (query.startsWith("update payments set amount")) {
        const [amount, providerReference, id] = params;
        state.payment = {
          ...state.payment,
          id,
          amount,
          currency: "ZAR",
          provider: "PAYFAST",
          provider_reference: providerReference,
          payment_status: "PENDING",
          payout_status: "NOT_ELIGIBLE",
          paid_at: null
        };
        return { rows: [{ ...state.payment }] };
      }
      if (query.startsWith("select p.id, p.session_request_id, p.amount::text as amount")) {
        return state.payment?.provider_reference === params[0] && state.payment.provider === "PAYFAST"
          ? { rows: [{ ...state.payment, session_status: state.session.status }] }
          : { rows: [] };
      }
      if (query.startsWith("update payments set payment_status = 'paid'")) {
        if (state.payment?.id === params[0] && state.payment.payment_status === "PENDING") {
          state.payment.payment_status = "PAID";
          state.payment.paid_at = new Date().toISOString();
        }
        return { rows: [] };
      }
      if (query.startsWith("update payments set payment_status = 'failed'")) {
        if (state.payment?.id === params[0] && state.payment.payment_status === "PENDING") {
          state.payment.payment_status = "FAILED";
        }
        return { rows: [] };
      }
      throw new Error(`Unexpected fake client query: ${query}`);
    },
    release() {}
  };

  db.pool = { connect: async () => client };
  tutorApplicationService.getEffectiveRoles = async (userId) => Number(userId) === 2 ? ["ADMIN"] : roles;
  payfast.isPayfastIp = (address) => {
    counters.payfastAddress = address;
    return true;
  };
  receiptEmail.sendPaymentReceiptEmail = async (receipt) => {
    assert.equal(state.transactionOpen, false);
    counters.emailAttempts += 1;
    if (failReceiptEmail) throw Object.assign(new Error("SMTP send failed"), { code: "SMTP_TEST_FAILURE" });
    counters.emailedReceipt = receipt;
  };
  process.env.PAYFAST_URL = "https://sandbox.payfast.co.za/eng/process";
  process.env.PAYFAST_MERCHANT_ID = "10000100";
  process.env.PAYFAST_MERCHANT_KEY = "sandbox-only-test-key";
  process.env.PAYFAST_PASSPHRASE = "";
  process.env.PAYFAST_NOTIFY_URL = "https://market.example.test/api/payments/payfast/notify";
  process.env.CLIENT_URL = "https://market.example.test";
  global.fetch = async (url, options) => {
    if (String(url) !== "https://sandbox.payfast.co.za/eng/query/validate") {
      return originalFetch(url, options);
    }
    assert.equal(options.method, "POST");
    counters.serverValidation += 1;
    return { ok: true, text: async () => "VALID" };
  };

  delete require.cache[require.resolve("../middleware/auth")];
  delete require.cache[require.resolve("../routes/payments")];
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/payments", require("../routes/payments"));

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const harness = { server, state, counters, url: `http://127.0.0.1:${address.port}` };
  activeHarnesses.push(harness);
  return harness;
}

function tokenFor(userId) {
  const secret = process.env.JWT_SECRET || "easylearning_default_secret_key_change_in_prod";
  return jwt.sign({ id: userId, email: `${userId}@university.test` }, secret);
}

async function initialize(harness, body = { sessionRequestId: 10 }, userId = 7) {
  const response = await fetch(`${harness.url}/api/payments/initialize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenFor(userId)}`
    },
    body: JSON.stringify(body)
  });
  return { response, data: await response.json() };
}

async function getReceipt(harness, userId = 7, authenticated = true) {
  const headers = authenticated ? { Authorization: `Bearer ${tokenFor(userId)}` } : {};
  const response = await fetch(`${harness.url}/api/payments/receipt/10`, { headers });
  return { response, data: await response.json() };
}

function makeItn(payment, overrides = {}) {
  const fields = {
    m_payment_id: payment.provider_reference,
    pf_payment_id: "sandbox-transaction-1",
    payment_status: "COMPLETE",
    item_name: "EasyLearning Tutoring Session",
    amount_gross: "150.00",
    merchant_id: "10000100",
    ...overrides
  };
  fields.signature = payfast.generatePayfastSignature(fields);
  return fields;
}

async function sendItn(harness, fields) {
  const response = await fetch(`${harness.url}/api/payments/payfast/notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Forwarded-For": "197.97.145.144"
    },
    body: new URLSearchParams(fields).toString()
  });
  return response;
}

afterEach(async () => {
  for (const harness of activeHarnesses.splice(0)) {
    await new Promise((resolve, reject) => harness.server.close((error) => error ? reject(error) : resolve()));
  }
  db.query = originalQuery;
  db.pool = originalPool;
  tutorApplicationService.getEffectiveRoles = originalGetEffectiveRoles;
  payfast.isPayfastIp = originalIsPayfastIp;
  receiptEmail.sendPaymentReceiptEmail = originalSendPaymentReceiptEmail;
  global.fetch = originalFetch;
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  delete require.cache[require.resolve("../middleware/auth")];
  delete require.cache[require.resolve("../routes/payments")];
});

test("accepted owned session creates a server-priced pending sandbox payment", async () => {
  const harness = await createHarness();
  const { response, data } = await initialize(harness, { sessionRequestId: 10, amount: "0.01" });
  assert.equal(response.status, 400);
  assert.equal(harness.state.payment, null);

  const initialized = await initialize(harness);
  assert.equal(initialized.response.status, 200);
  assert.equal(harness.state.payment.amount, "150.00");
  assert.equal(harness.state.payment.payment_status, "PENDING");
  assert.equal(harness.state.payment.payout_status, "NOT_ELIGIBLE");
  assert.equal(initialized.data.paymentUrl, "https://sandbox.payfast.co.za/eng/process");
  assert.equal(initialized.data.fields.amount, "150.00");
  assert.equal(initialized.data.fields.email_address, "student@university.test");
  assert.equal(initialized.data.fields.merchant_key, "sandbox-only-test-key");
  assert.equal(payfast.verifyPayfastSignature(initialized.data.fields), true);
  assert.equal(Object.hasOwn(initialized.data, "PAYFAST_MERCHANT_KEY"), false);
});

test("initialization rejects unaccepted sessions, other students, and wrong roles", async () => {
  const pendingHarness = await createHarness({ sessionStatus: "PENDING" });
  const pending = await initialize(pendingHarness);
  assert.equal(pending.response.status, 409);
  assert.equal(pendingHarness.state.payment, null);

  for (const status of ["DECLINED", "CANCELLED", "COMPLETED"]) {
    const harness = await createHarness({ sessionStatus: status });
    const result = await initialize(harness);
    assert.equal(result.response.status, 409);
    assert.equal(result.data.error, "Only accepted sessions can be paid.");
    assert.equal(result.data.paymentUrl, undefined);
    assert.equal(harness.state.payment, null);
  }

  const ownedHarness = await createHarness({ studentId: 8 });
  const otherStudent = await initialize(ownedHarness, { sessionRequestId: 10 }, 7);
  assert.equal(otherStudent.response.status, 404);
  assert.equal(ownedHarness.state.payment, null);

  const tutorHarness = await createHarness({ roles: ["TUTOR"] });
  const denied = await initialize(tutorHarness);
  assert.equal(denied.response.status, 403);
});

test("changing an accepted session to declined blocks direct checkout and preserves payment history", async () => {
  const harness = await createHarness();
  const initialized = await initialize(harness);
  assert.equal(initialized.response.status, 200);
  const existingPayment = { ...harness.state.payment };

  harness.state.session.status = "DECLINED";
  const declinedRetry = await initialize(harness);

  assert.equal(declinedRetry.response.status, 409);
  assert.equal(declinedRetry.data.error, "Only accepted sessions can be paid.");
  assert.equal(declinedRetry.data.paymentUrl, undefined);
  assert.deepEqual(harness.state.payment, existingPayment);
});

test("payment status is scoped to the session-owning student", async () => {
  const harness = await createHarness();
  const response = await fetch(`${harness.url}/api/payments/session/10`, {
    headers: { Authorization: `Bearer ${tokenFor(7)}` }
  });
  const status = await response.json();
  assert.equal(response.status, 200);
  assert.equal(status.paymentStatus, null);
  assert.equal(status.payoutStatus, "NOT_ELIGIBLE");
  assert.equal(status.amount, "150.00");

  const otherStudent = await fetch(`${harness.url}/api/payments/session/10`, {
    headers: { Authorization: `Bearer ${tokenFor(8)}` }
  });
  assert.equal(otherStudent.status, 404);
});

test("invalid ITN signatures and mismatched gross amounts cannot mark a payment paid", async () => {
  const harness = await createHarness();
  await initialize(harness);
  const invalidSignature = { ...makeItn(harness.state.payment), signature: "0".repeat(32) };
  const invalidResponse = await sendItn(harness, invalidSignature);
  assert.equal(invalidResponse.status, 400);
  assert.equal(harness.state.payment.payment_status, "PENDING");

  const wrongAmount = makeItn(harness.state.payment, { amount_gross: "151.00" });
  const amountResponse = await sendItn(harness, wrongAmount);
  assert.equal(amountResponse.status, 400);
  assert.equal(harness.state.payment.payment_status, "PENDING");
  assert.equal(harness.counters.serverValidation, 0);
});

test("verified ITN marks paid once, emails one receipt, and exposes it only to the owning student", async () => {
  const harness = await createHarness();
  await initialize(harness);
  const validResponse = await sendItn(harness, makeItn(harness.state.payment));
  assert.equal(validResponse.status, 200);
  assert.equal(harness.state.payment.payment_status, "PAID");
  assert.equal(harness.state.payment.payout_status, "NOT_ELIGIBLE");
  assert.equal(harness.counters.serverValidation, 1);
  assert.equal(harness.counters.payfastAddress, "197.97.145.144");
  assert.equal(harness.counters.emailAttempts, 1);
  assert.equal(harness.counters.emailedReceipt.receiptNumber, "EL-RCPT-5");
  assert.equal(harness.counters.emailedReceipt.receiptUrl, "https://market.example.test/payments/receipt?sessionRequestId=10");

  const receipt = await getReceipt(harness);
  assert.equal(receipt.response.status, 200);
  assert.equal(receipt.data.receipt.paymentStatus, "PAID");
  assert.equal(receipt.data.receipt.studentEmail, "student@university.test");
  assert.equal(receipt.data.receipt.subject, "Mathematics");

  const anonymousReceipt = await getReceipt(harness, 7, false);
  assert.equal(anonymousReceipt.response.status, 401);
  const anotherStudentReceipt = await getReceipt(harness, 8);
  assert.equal(anotherStudentReceipt.response.status, 404);

  const duplicateItn = await sendItn(harness, makeItn(harness.state.payment));
  assert.equal(duplicateItn.status, 200);
  assert.equal(harness.state.payment.payout_status, "NOT_ELIGIBLE");
  assert.equal(harness.counters.serverValidation, 2);
  assert.equal(harness.counters.emailAttempts, 1);

  const duplicateCheckout = await initialize(harness);
  assert.equal(duplicateCheckout.response.status, 409);
});

test("receipt is unavailable before a payment is verified", async () => {
  const harness = await createHarness();
  await initialize(harness);
  const receipt = await getReceipt(harness);
  assert.equal(receipt.response.status, 404);
  assert.equal(harness.counters.emailAttempts, 0);
});

test("SMTP failure leaves verified payment PAID and its receipt available", async () => {
  const harness = await createHarness({ failReceiptEmail: true });
  await initialize(harness);
  const response = await sendItn(harness, makeItn(harness.state.payment));
  assert.equal(response.status, 200);
  assert.equal(harness.state.payment.payment_status, "PAID");
  assert.equal(harness.counters.emailAttempts, 1);

  const receipt = await getReceipt(harness);
  assert.equal(receipt.response.status, 200);
  assert.equal(receipt.data.receipt.receiptNumber, "EL-RCPT-5");
});

test("ITN cannot confirm a payment after its session is declined", async () => {
  const harness = await createHarness();
  await initialize(harness);
  harness.state.session.status = "DECLINED";

  const response = await sendItn(harness, makeItn(harness.state.payment));
  assert.equal(response.status, 409);
  assert.equal(harness.state.payment.payment_status, "PENDING");
  assert.equal(harness.counters.serverValidation, 1);
  assert.equal(harness.counters.emailAttempts, 0);
  const receipt = await getReceipt(harness);
  assert.equal(receipt.response.status, 404);
});

test("a signed cancelled notification records failure but never payment success", async () => {
  const harness = await createHarness();
  await initialize(harness);
  const cancelled = makeItn(harness.state.payment, { payment_status: "CANCELLED" });
  const response = await sendItn(harness, cancelled);
  assert.equal(response.status, 200);
  assert.equal(harness.state.payment.payment_status, "FAILED");
  assert.equal(harness.state.payment.payout_status, "NOT_ELIGIBLE");
});

test("admin payment access returns payment records without exposing secrets", async () => {
  const originalDbQuery = db.query;
  const originalRoles = tutorApplicationService.getEffectiveRoles;
  const paymentsRows = [{
    id: 15,
    amount: "150.00",
    currency: "ZAR",
    payment_status: "PAID",
    payout_status: "NOT_ELIGIBLE",
    provider: "PAYFAST",
    provider_reference: "EL-123",
    payment_created_at: "2026-10-01T12:00:00.000Z",
    paid_at: "2026-10-01T12:05:00.000Z",
    session_request_id: 10,
    subject: "Data Structures",
    requested_date: "2026-10-02T10:00:00.000Z",
    session_status: "ACCEPTED",
    student_name: "Student Example",
    tutor_name: "Tutor Example"
  }];

  db.query = async (text) => {
    const query = String(text).replace(/\s+/g, " ").trim().toLowerCase();
    if (query.includes("from payments p")) {
      return { rows: paymentsRows };
    }
    return { rows: [] };
  };

  const tutorApplicationModule = require("../services/tutorApplications");
  tutorApplicationModule.getEffectiveRoles = async (userId) => Number(userId) === 99 ? ["ADMIN"] : ["STUDENT"];
  delete require.cache[require.resolve("../middleware/auth")];
  delete require.cache[require.resolve("../routes/admin")];

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/admin", require("../routes/admin"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  try {
    const token = jwt.sign({ id: 99, email: "admin@example.test" }, process.env.JWT_SECRET || "easylearning_default_secret_key_change_in_prod");
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/payments`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.payments[0].paymentStatus, "PAID");
    assert.equal(data.payments[0].receiptNumber, "EL-RCPT-15");
    assert.equal(data.payments[0].reference, "EL-123");
    assert.equal(data.payments[0].studentName, "Student Example");
    assert.equal(data.payments[0].tutorName, "Tutor Example");
    assert.ok(!Object.prototype.hasOwnProperty.call(data.payments[0], "merchantKey"));
    assert.ok(!Object.prototype.hasOwnProperty.call(data.payments[0], "password"));
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    db.query = originalDbQuery;
    tutorApplicationService.getEffectiveRoles = originalRoles;
    delete require.cache[require.resolve("../middleware/auth")];
    delete require.cache[require.resolve("../routes/admin")];
    if (require.cache[require.resolve("../services/tutorApplications")]) {
      require.cache[require.resolve("../services/tutorApplications")].exports.getEffectiveRoles = originalRoles;
    }
  }
});