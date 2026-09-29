const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const tutorRoutes = require("./routes/tutors");

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// Dynamic CORS configuration for local development and specified client URL
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === CLIENT_URL || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true
  })
);

app.use(express.json());
app.use(cookieParser());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/tutors", tutorRoutes);

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