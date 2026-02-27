const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const broker = require("./messaging/broker");

const app = express();

// Middleware
app.use(express.json());
app.use(morgan("dev"));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
});
app.use(limiter);

// Routes
app.use("/auth", require("./routes/auth"));

// Health check
app.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "auth-service",
    status: "healthy",
    timestamp: new Date(),
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB (auth_db)");

    await broker.connect(process.env.RABBITMQ_URL);

    app.listen(PORT, () => {
      console.log(`Auth Service running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start auth service:", err);
    process.exit(1);
  }
}

start();
