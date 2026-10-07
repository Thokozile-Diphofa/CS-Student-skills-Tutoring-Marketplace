const TRANSIENT_CONNECTION_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EAI_AGAIN"
]);

function isTransientConnectionError(error, visited = new Set()) {
  if (!error || typeof error !== "object" || visited.has(error)) return false;
  visited.add(error);

  if (Array.isArray(error.errors) && error.errors.length > 0) {
    return error.errors.every((nestedError) => isTransientConnectionError(nestedError, visited));
  }
  if (TRANSIENT_CONNECTION_CODES.has(error.code)) return true;
  return error.cause ? isTransientConnectionError(error.cause, visited) : false;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function initializeWithRetry(initialize, {
  maxAttempts = 3,
  retryDelayMs = 250,
  delay = wait
} = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await initialize();
    } catch (error) {
      if (attempt >= maxAttempts || !isTransientConnectionError(error)) throw error;

      const nextAttempt = attempt + 1;
      console.warn(`Transient database connection failure; retrying startup initialization (${nextAttempt}/${maxAttempts}, code ${error.code || "connection error"}).`);
      await delay(retryDelayMs * attempt);
    }
  }
}

module.exports = {
  initializeWithRetry,
  isTransientConnectionError
};