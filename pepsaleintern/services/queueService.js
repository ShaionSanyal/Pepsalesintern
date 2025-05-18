const Queue = require("bull");
const Redis = require("redis");
const logger = require("../utils/logger");
const { processNotification } = require("./notificationProcessor");

let notificationQueue;
let redisClient;

// Initialize queue
const initQueue = async () => {
  try {
    // Redis connection configuration
    const redisConfig = {
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
    };

    // Create Redis client for general use
    redisClient = Redis.createClient(redisConfig);
    await redisClient.connect();

    // Create Bull queue
    notificationQueue = new Queue("notification processing", {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    });

    // Process jobs
    notificationQueue.process(5, processNotification); // Process up to 5 jobs concurrently

    // Event listeners
    notificationQueue.on("completed", (job, result) => {
      logger.info(`Job completed: ${job.id}`, { jobId: job.id, result });
    });

    notificationQueue.on("failed", (job, err) => {
      logger.error(`Job failed: ${job.id}`, {
        jobId: job.id,
        error: err.message,
      });
    });

    notificationQueue.on("stalled", (job) => {
      logger.warn(`Job stalled: ${job.id}`, { jobId: job.id });
    });

    logger.info("Queue initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize queue:", error);
    throw error;
  }
};

// Add notification to queue
const addToQueue = async (notification, priority = "medium") => {
  try {
    const priorityMap = {
      low: 1,
      medium: 2,
      high: 3,
    };

    const job = await notificationQueue.add(
      "send-notification",
      {
        notificationId: notification._id.toString(),
        userId: notification.userId,
        type: notification.type,
        subject: notification.subject,
        message: notification.message,
        recipient: notification.recipient,
        metadata: notification.metadata,
      },
      {
        priority: priorityMap[priority] || 2,
        delay: 0, // Send immediately, add delay if needed
        attempts: notification.maxAttempts,
      }
    );

    logger.info(`Notification added to queue: ${notification._id}`, {
      jobId: job.id,
      priority,
      type: notification.type,
    });

    return job;
  } catch (error) {
    logger.error("Failed to add notification to queue:", error);
    throw error;
  }
};

// Get queue status and statistics
const getQueueStatus = async () => {
  try {
    const waiting = await notificationQueue.getWaiting();
    const active = await notificationQueue.getActive();
    const completed = await notificationQueue.getCompleted();
    const failed = await notificationQueue.getFailed();
    const delayed = await notificationQueue.getDelayed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: await notificationQueue.isPaused(),
    };
  } catch (error) {
    logger.error("Failed to get queue status:", error);
    throw error;
  }
};

// Retry failed job
const retryFailedJob = async (jobId) => {
  try {
    const job = await notificationQueue.getJob(jobId);
    if (job && job.opts.attempts > job.attemptsMade) {
      await job.retry();
      logger.info(`Job retried: ${jobId}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`Failed to retry job ${jobId}:`, error);
    throw error;
  }
};

// Clean old jobs
const cleanQueue = async (grace = 24 * 60 * 60 * 1000) => {
  try {
    await notificationQueue.clean(grace, "completed");
    await notificationQueue.clean(grace, "failed");
    logger.info("Queue cleaned successfully");
  } catch (error) {
    logger.error("Failed to clean queue:", error);
    throw error;
  }
};

// Pause/Resume queue
const pauseQueue = async () => {
  await notificationQueue.pause();
  logger.info("Queue paused");
};

const resumeQueue = async () => {
  await notificationQueue.resume();
  logger.info("Queue resumed");
};

// Graceful shutdown
const shutdownQueue = async () => {
  try {
    await notificationQueue.close();
    await redisClient.disconnect();
    logger.info("Queue shut down gracefully");
  } catch (error) {
    logger.error("Error during queue shutdown:", error);
  }
};

module.exports = {
  initQueue,
  addToQueue,
  getQueueStatus,
  retryFailedJob,
  cleanQueue,
  pauseQueue,
  resumeQueue,
  shutdownQueue,
  getQueue: () => notificationQueue,
};
