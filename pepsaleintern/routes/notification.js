const express = require("express");
const { body, validationResult } = require("express-validator");
const Notification = require("../models/Notification");
const { addToQueue } = require("../services/queueService");
const logger = require("../utils/logger");

const router = express.Router();

// Validation middleware for notification creation
const validateNotification = [
  body("userId").notEmpty().withMessage("User ID is required"),
  body("type")
    .isIn(["email", "sms", "in-app"])
    .withMessage("Type must be email, sms, or in-app"),
  body("message").notEmpty().withMessage("Message is required"),
  body("subject")
    .if(body("type").equals("email"))
    .notEmpty()
    .withMessage("Subject is required for email notifications"),
  body("recipient")
    .if(body("type").isIn(["email", "sms"]))
    .notEmpty()
    .withMessage("Recipient is required for email and SMS notifications"),
  body("priority")
    .optional()
    .isIn(["low", "medium", "high"])
    .withMessage("Priority must be low, medium, or high"),
  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),
];

// POST /notifications - Send a notification
router.post("/", validateNotification, async (req, res) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Validation failed",
          details: errors.array(),
        },
      });
    }

    const {
      userId,
      type,
      subject,
      message,
      recipient,
      priority = "medium",
      metadata = {},
    } = req.body;

    // Create notification in database
    const notification = new Notification({
      userId,
      type,
      subject,
      message,
      recipient,
      priority,
      metadata,
      status: "pending",
    });

    await notification.save();

    // Add to queue for processing
    const job = await addToQueue(notification, priority);

    // Update notification with job ID
    notification.jobId = job.id;
    notification.status = "queued";
    await notification.save();

    logger.info(`Notification created and queued: ${notification._id}`, {
      userId,
      type,
      priority,
      jobId: job.id,
    });

    res.status(201).json({
      success: true,
      data: {
        notificationId: notification._id,
        status: notification.status,
        message: "Notification queued successfully",
        jobId: job.id,
      },
    });
  } catch (error) {
    logger.error("Error creating notification:", error);
    res.status(500).json({
      success: false,
      error: {
        message: "Failed to create notification",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
    });
  }
});

// GET /notifications/:id - Get specific notification
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: {
          message: "Notification not found",
        },
      });
    }

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    logger.error("Error fetching notification:", error);
    res.status(500).json({
      success: false,
      error: {
        message: "Failed to fetch notification",
      },
    });
  }
});

// GET /notifications - Get all notifications with filters
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type, priority, userId } = req.query;

    // Build filter query
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (priority) filter.priority = priority;
    if (userId) filter.userId = userId;

    // Calculate pagination
    const skip = (page - 1) * limit;
    const totalItems = await Notification.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limit);

    // Fetch notifications
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    logger.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      error: {
        message: "Failed to fetch notifications",
      },
    });
  }
});

// DELETE /notifications/:id - Delete a notification (admin only)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndDelete(id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: {
          message: "Notification not found",
        },
      });
    }

    logger.info(`Notification deleted: ${id}`);

    res.json({
      success: true,
      data: {
        message: "Notification deleted successfully",
      },
    });
  } catch (error) {
    logger.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      error: {
        message: "Failed to delete notification",
      },
    });
  }
});

module.exports = router;
