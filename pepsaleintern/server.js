const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const connectDB = require("./config/database");
const notificationRoutes = require("./routes/notifications");
const userRoutes = require("./routes/users");
const healthRoutes = require("./routes/health");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./utils/logger");
const { initQueue } = require("./services/queueService");

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Request parsing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logging middleware
app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// Routes
app.use("/notifications", notificationRoutes);
app.use("/users", userRoutes);
app.use("/health", healthRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Notification Service API",
    version: "1.0.0",
    endpoints: {
      sendNotification: "POST /notifications",
      getUserNotifications: "GET /users/:id/notifications",
      health: "GET /health",
    },
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: "Route not found",
      path: req.originalUrl,
    },
  });
});

// Initialize services and start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();
    logger.info("Connected to MongoDB");

    // Initialize queue
    await initQueue();
    logger.info("Queue initialized");

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });

    // Graceful shutdown
    process.on("SIGTERM", () => {
      logger.info("SIGTERM received. Shutting down gracefully...");
      server.close(() => {
        logger.info("Process terminated");
        process.exit(0);
      });
    });

    process.on("SIGINT", () => {
      logger.info("SIGINT received. Shutting down gracefully...");
      server.close(() => {
        logger.info("Process terminated");
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
