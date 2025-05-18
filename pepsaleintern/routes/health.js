const express = require("express");
const mongoose = require("mongoose");
const { getQueueStatus } = require("../services/queueService");
const logger = require("../utils/logger");

const router = express.Router();

// GET /health - Basic health check
router.get("/", async (req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || "1.0.0",
  };

  try {
    // Check database connection
    const dbState = mongoose.connection.readyState;
    health.database = {
      status: dbState === 1 ? "connected" : "disconnected",
      state: dbState,
    };

    // Check queue status
    try {
      const queueStats = await getQueueStatus();
      health.queue = {
        status: "connected",
        ...queueStats,
      };
    } catch (queueError) {
      health.queue = {
        status: "error",
        error: queueError.message,
      };
    }

    // Determine overall health
    const isHealthy =
      health.database.status === "connected" &&
      health.queue.status === "connected";

    const statusCode = isHealthy ? 200 : 503;
    health.status = isHealthy ? "ok" : "degraded";

    res.status(statusCode).json(health);
  } catch (error) {
    logger.error("Health check failed:", error);
    res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// GET /health/detailed - Detailed health check
router.get("/detailed", async (req, res) => {
  try {
    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || "1.0.0",
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    };

    // Database health
    const dbState = mongoose.connection.readyState;
    health.database = {
      status: dbState === 1 ? "connected" : "disconnected",
      state: dbState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    };

    // Queue health
    try {
      const queueStats = await getQueueStatus();
      health.queue = {
        status: "connected",
        ...queueStats,
      };
    } catch (queueError) {
      health.queue = {
        status: "error",
        error: queueError.message,
      };
    }

    // Overall status
    const isHealthy =
      health.database.status === "connected" &&
      health.queue.status === "connected";

    health.status = isHealthy ? "ok" : "degraded";

    res.json(health);
  } catch (error) {
    logger.error("Detailed health check failed:", error);
    res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

module.exports = router;
