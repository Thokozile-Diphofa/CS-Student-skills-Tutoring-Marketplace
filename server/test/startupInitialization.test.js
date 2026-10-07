const assert = require("node:assert/strict");
const { test } = require("node:test");
const { initializeWithRetry } = require("../services/startupInitialization");

test("startup retries nested transient connection failures and then succeeds", async () => {
  let attempts = 0;
  const delays = [];
  const transientAggregate = new AggregateError([
    Object.assign(new Error("connection timed out"), { code: "ETIMEDOUT" }),
    Object.assign(new Error("network unreachable"), { code: "ENETUNREACH" })
  ]);
  transientAggregate.code = "ETIMEDOUT";

  const result = await initializeWithRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw transientAggregate;
    return "ready";
  }, {
    delay: async (milliseconds) => delays.push(milliseconds)
  });

  assert.equal(result, "ready");
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [250, 500]);
});

test("startup stops after the bounded number of transient connection attempts", async () => {
  let attempts = 0;
  const delays = [];
  const error = Object.assign(new Error("connection timed out"), { code: "ETIMEDOUT" });

  await assert.rejects(initializeWithRetry(async () => {
    attempts += 1;
    throw error;
  }, {
    delay: async (milliseconds) => delays.push(milliseconds)
  }), error);

  assert.equal(attempts, 3);
  assert.deepEqual(delays, [250, 500]);
});

test("startup does not retry a schema or configuration error", async () => {
  let attempts = 0;
  let delayCount = 0;
  const error = Object.assign(new Error("migration failed"), { code: "42P01" });

  await assert.rejects(initializeWithRetry(async () => {
    attempts += 1;
    throw error;
  }, {
    delay: async () => { delayCount += 1; }
  }), error);

  assert.equal(attempts, 1);
  assert.equal(delayCount, 0);
});