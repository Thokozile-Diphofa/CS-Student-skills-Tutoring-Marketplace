const assert = require("node:assert/strict");
const { test } = require("node:test");
const crypto = require("node:crypto");
const {
  buildPayfastParameterString,
  formatZarAmount,
  generatePayfastSignature,
  getSandboxProcessUrl,
  getSandboxValidationUrl,
  isPayfastIp,
  verifyPayfastSignature
} = require("../services/payfast");

test("PayFast parameter encoding preserves field order and form encoding", () => {
  const fields = {
    merchant_id: "10000100",
    item_name: "CS & Data (Intro)",
    blank: "",
    signature: "ignored"
  };

  assert.equal(
    buildPayfastParameterString(fields),
    "merchant_id=10000100&item_name=CS+%26+Data+%28Intro%29"
  );
});

test("PayFast signature includes a non-empty passphrase and skips an empty one", () => {
  const fields = { merchant_id: "10000100", amount: "150.00" };
  const withoutPassphrase = crypto.createHash("md5").update("merchant_id=10000100&amount=150.00").digest("hex");
  const withPassphrase = crypto.createHash("md5").update("merchant_id=10000100&amount=150.00&passphrase=my+salt").digest("hex");

  assert.equal(generatePayfastSignature(fields), withoutPassphrase);
  assert.equal(generatePayfastSignature(fields, "my salt"), withPassphrase);
  assert.equal(verifyPayfastSignature({ ...fields, signature: withPassphrase }, "my salt"), true);
  assert.equal(verifyPayfastSignature({ ...fields, amount: "1.00", signature: withPassphrase }, "my salt"), false);
});

test("PayFast accepts only Sandbox process URLs and derives Sandbox validation URL", () => {
  assert.equal(getSandboxProcessUrl("https://sandbox.payfast.co.za/eng/process"), "https://sandbox.payfast.co.za/eng/process");
  assert.equal(getSandboxProcessUrl("https://www.payfast.co.za/eng/process"), null);
  assert.equal(getSandboxProcessUrl("http://sandbox.payfast.co.za/eng/process"), null);
  assert.equal(getSandboxValidationUrl("https://sandbox.payfast.co.za/eng/process"), "https://sandbox.payfast.co.za/eng/query/validate");
});

test("PayFast source IP checks match documented Sandbox ranges", () => {
  assert.equal(isPayfastIp("197.97.145.144"), true);
  assert.equal(isPayfastIp("::ffff:41.74.179.223"), true);
  assert.equal(isPayfastIp("197.97.145.160"), false);
  assert.equal(isPayfastIp("127.0.0.1"), false);
  assert.equal(isPayfastIp("2001:db8::1"), false);
});

test("ZAR amount formatting preserves database decimals and rejects invalid values", () => {
  assert.equal(formatZarAmount("150.00"), "150.00");
  assert.equal(formatZarAmount("001.5"), "1.50");
  assert.equal(formatZarAmount(12.5), "12.50");
  assert.equal(formatZarAmount("0.00"), null);
  assert.equal(formatZarAmount("-1.00"), null);
  assert.equal(formatZarAmount("1.005"), null);
});