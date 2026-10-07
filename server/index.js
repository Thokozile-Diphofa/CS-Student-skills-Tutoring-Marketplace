const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const tutorRoutes = require("./routes/tutors");
const tutorApplicationRoutes = require("./routes/tutorApplications");
const sessionRequestRoutes = require("./routes/sessionRequests");
const paymentRoutes = require("./routes/payments");
const { ensureTutorApplicationSchema } = require("./services/tutorApplications");
const { initializeWithRetry } = require("./services/startupInitialization");

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "");

function redactErrorText(value) {
  return String(value ?? "")
    .replace(/(?:postgres(?:ql)?|https?):\/\/[^\s"'`]+/gi, "[REDACTED_URL]")
    .replace(/\b(database_url|password|passwd|pwd|token|secret|authorization)\s*[:=]\s*["']?[^,\s;)"']+/gi, "$1=[REDACTED]");
}

function getErrorDetails(error, depth = 0) {
  const errorObject = error && typeof error === "object" ? error : {};
  const details = {
    name: typeof errorObject.name === "string" ? errorObject.name : undefined,
    message: redactErrorText(errorObject.message || error),
    code: typeof errorObject.code === "string" ? errorObject.code : undefined,
    stack: typeof errorObject.stack === "string" ? redactErrorText(errorObject.stack) : undefined
  };

  if (depth < 4 && Array.isArray(errorObject.errors)) {
    details.errors = errorObject.errors.map((nestedError) => getErrorDetails(nestedError, depth + 1));
  }
  if (depth < 4 && errorObject.cause) {
    details.cause = getErrorDetails(errorObject.cause, depth + 1);
  }

  return details;
}

// Dynamic CORS configuration for local development and specified client URL
app.use(
  cors({
    origin: (origin, callback) => {
      const isLocalDevelopmentOrigin = process.env.NODE_ENV !== "production"
        && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || "");
      if (!origin || origin === CLIENT_URL || isLocalDevelopmentOrigin) {
        callback(null, true);
      } else {
        callback(new Error("Origin is not allowed by CORS."));
      }
    },
    credentials: true
  })
);

app.use(express.json());
app.use(cookieParser());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/tutor-applications", tutorApplicationRoutes);
app.use("/api/tutors", tutorRoutes);
app.use("/api/session-requests", sessionRequestRoutes);
app.use("/api/payments", paymentRoutes);

// Test routes
app.get("/", (req, res) => {
  res.json({
    message: "EasyLearning Server is running successfully"
  });
});

app.get("/api/test", (req, res) => {
  res.json({
    message: "API is working"
  });
});

// Initialize the authentication schema before accepting requests.
initializeWithRetry(async () => {
  await authRoutes.initializeSchema();
  await ensureTutorApplicationSchema();
})
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((error) => {
    console.error("Failed to initialize authentication schema:", getErrorDetails(error));
    process.exit(1);
  });