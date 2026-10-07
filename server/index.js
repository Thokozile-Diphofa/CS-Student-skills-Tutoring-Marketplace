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

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "");

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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});