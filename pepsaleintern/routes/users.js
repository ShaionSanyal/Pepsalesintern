const express = require("express");
const { param, query, validationResult } = require("express-validator");
const Notification = require("../models/Notification");
const logger = require("../utils/logger");

const router = express.Router();

// Validation middleware
const validateUserId = [
  param("id").notEmpty().withMessage("User ID is required"),
];

const validateQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("status")
    .optional()
    .isIn(["pending", "queued", "processing", "sent", "failed"])
    .withMessage("Invalid status"),
  query("type")
    .optional()
    .isIn(["email", "sms", "in-app"])
    .withMessage("Invalid type"),
];

// GET /users/:id/notifications - Get user notifications
router.get(
  "/:id/notifications",
  validateUserId,
  validateQuery,
  async (req, res) => {
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

      const { id: userId } = req.params;
      const {
        page = 1,
        limit = 10,
        status,
        type,
        unreadOnly = false,
      } = req.query;

      // Build filter query
      const filter = { userId };
      if (status) filter.status = status;
      if (type) filter.type = type;

      // For in-app notifications, filter for unread only if requested
      if (unreadOnly === "true" && type === "in-app") {
        filter.status = { $ne: "sent" };
      }

      // Calculate pagination
      const skip = (page - 1) * limit;
      const totalItems = await Notification.countDocuments(filter);
      const totalPages = Math.ceil(totalItems / limit);

      // Fetch notifications
      const notifications = await Notification.find(filter)
        .select("-jobId") // Don't expose internal job IDs
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      // Get counts by status for summary
      const statusCounts = await Notification.aggregate([
        { $match: { userId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]);

      const summary = {
        total: totalItems,
        byStatus: statusCounts.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
      };

      logger.info(
        `Retrieved ${notifications.length} notifications for user ${userId}`,
        {
          userId,
          page,
          limit,
          total: totalItems,
        }
      );

      res.json({
        success: true,
        data: {
          notifications,
          summary,
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
      logger.error("Error fetching user notifications:", error);
      res.status(500).json({
        success: false,
        error: {
          message: "Failed to fetch user notifications",
        },
      });
    }
  }
);

// PATCH /users/:id/notifications/:notificationId/read - Mark in-app notification as read
router.patch(
  "/:id/notifications/:notificationId/read",
  validateUserId,
  async (req, res) => {
    try {
      const { id: userId, notificationId } = req.params;

      const notification = await Notification.findOne({
        _id: notificationId,
        userId,
        type: "in-app",
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          error: {
            message: "In-app notification not found",
          },
        });
      }

      // Mark as read (sent status for in-app notifications means read)
      await notification.markAsSent();

      logger.info(`In-app notification marked as read: ${notificationId}`, {
        userId,
        notificationId,
      });

      res.json({
        success: true,
        data: {
          message: "Notification marked as read",
          notification,
        },
      });
    } catch (error) {
      logger.error("Error marking notification as read:", error);
      res.status(500).json({
        success: false,
        error: {
          message: "Failed to mark notification as read",
        },
      });
    }
  }
);

// GET /users/:id/notifications/unread-count - Get unread notification count
router.get(
  "/:id/notifications/unread-count",
  validateUserId,
  async (req, res) => {
    try {
      const { id: userId } = req.params;

      const unreadCount = await Notification.countDocuments({
        userId,
        type: "in-app",
        status: { $ne: "sent" },
      });

      res.json({
        success: true,
        data: {
          unreadCount,
        },
      });
    } catch (error) {
      logger.error("Error fetching unread count:", error);
      res.status(500).json({
        success: false,
        error: {
          message: "Failed to fetch unread count",
        },
      });
    }
  }
);

module.exports = router;
