const LOCAL_DEVELOPMENT_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function normalizeConfiguredOrigin(value, settingName) {
  let parsedOrigin;
  try {
    parsedOrigin = new URL(value.trim());
  } catch {
    throw new Error(`${settingName} must contain valid HTTP or HTTPS origins.`);
  }

  if (
    (parsedOrigin.protocol !== "http:" && parsedOrigin.protocol !== "https:")
    || parsedOrigin.username
    || parsedOrigin.password
    || parsedOrigin.pathname !== "/"
    || parsedOrigin.search
    || parsedOrigin.hash
  ) {
    throw new Error(`${settingName} must contain valid HTTP or HTTPS origins.`);
  }

  return parsedOrigin.origin;
}

function createCorsOptions(environment = process.env) {
  const configuredOrigins = [
    environment.CLIENT_URL || "http://localhost:3000",
    ...(environment.CORS_ALLOWED_ORIGINS || "").split(",")
  ];
  const allowedOrigins = new Set(
    configuredOrigins
      .map((origin) => origin.trim())
      .filter(Boolean)
      .map((origin) => normalizeConfiguredOrigin(origin, "CLIENT_URL and CORS_ALLOWED_ORIGINS"))
  );
  const isDevelopment = environment.NODE_ENV !== "production";

  return {
    origin(origin, callback) {
      let normalizedRequestOrigin = null;
      if (origin) {
        try {
          normalizedRequestOrigin = normalizeConfiguredOrigin(origin, "Request origin");
        } catch {
          normalizedRequestOrigin = null;
        }
      }
      const isAllowed = !origin
        || allowedOrigins.has(normalizedRequestOrigin)
        || (isDevelopment && LOCAL_DEVELOPMENT_ORIGIN.test(origin));

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error("Origin is not allowed by CORS."));
      }
    },
    credentials: true
  };
}

function handleCorsError(error, req, res, next) {
  if (error && error.message === "Origin is not allowed by CORS.") {
    return res.status(403).json({ error: "Origin is not allowed." });
  }
  next(error);
}

module.exports = { createCorsOptions, handleCorsError };
