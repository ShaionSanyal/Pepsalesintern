const logger = require("../utils/logger");

class InAppService {
  constructor() {
    // In-app notifications are stored in the database
    // This service handles the logic for creating and formatting them
  }

  async createInAppNotification(notification) {
    try {
      const { message, metadata = {} } = notification;

      // Format the notification data
      const formattedNotification = this.formatInAppNotification(
        notification,
        metadata
      );

      // In-app notifications are already stored in database
      // This service just handles the formatting and any additional processing

      // You could add real-time features here like:
      // - WebSocket broadcasting
      // - Push notifications to mobile apps
      // - Integration with messaging platforms

      logger.info("In-app notification created successfully", {
        notificationId: notification._id,
        userId: notification.userId,
      });

      // Simulate real-time notification (you can integrate WebSocket here)
      if (metadata.realTime !== false) {
        await this.broadcastToUser(notification.userId, formattedNotification);
      }

      return {
        notificationId: notification._id,
        status: "delivered",
        formattedData: formattedNotification,
      };
    } catch (error) {
      logger.error("Failed to create in-app notification:", error, {
        notificationId: notification._id,
        userId: notification.userId,
      });
      throw error;
    }
  }

  formatInAppNotification(notification, metadata = {}) {
    const formatted = {
      id: notification._id,
      type: "in-app",
      title: notification.subject || this.generateTitle(notification, metadata),
      message: notification.message,
      timestamp: notification.createdAt,
      priority: notification.priority,
      category: metadata.category || "general",
      actionable: !!metadata.actionUrl,
      data: {
        userId: notification.userId,
        actionUrl: metadata.actionUrl,
        actionText: metadata.actionText,
        icon: metadata.icon || this.getDefaultIcon(metadata.category),
        color: metadata.color || this.getDefaultColor(notification.priority),
        expires: metadata.expires,
        persistent: metadata.persistent !== false,
      },
    };

    return formatted;
  }

  generateTitle(notification, metadata = {}) {
    // Generate a title based on notification type or metadata
    if (metadata.category) {
      const titleMap = {
        system: "System Notification",
        marketing: "Special Offer",
        update: "Update Available",
        reminder: "Reminder",
        alert: "Important Alert",
        social: "Social Activity",
        general: "Notification",
      };
      return titleMap[metadata.category] || "Notification";
    }

    // Extract title from message (first sentence or first N characters)
    const firstSentence = notification.message.split(".")[0];
    if (firstSentence.length <= 50) {
      return firstSentence;
    }

    return notification.message.substring(0, 47) + "...";
  }

  getDefaultIcon(category) {
    const iconMap = {
      system: "settings",
      marketing: "tag",
      update: "download",
      reminder: "clock",
      alert: "alert-triangle",
      social: "users",
      general: "bell",
    };
    return iconMap[category] || "bell";
  }

  getDefaultColor(priority) {
    const colorMap = {
      high: "#dc3545", // Red
      medium: "#ffc107", // Yellow
      low: "#28a745", // Green
    };
    return colorMap[priority] || "#6c757d";
  }

  // Simulate real-time broadcasting (integrate with WebSocket/Socket.IO)
  async broadcastToUser(userId, notificationData) {
    try {
      // This is where you would integrate with WebSocket
      // For now, we'll just log it

      logger.info("Broadcasting real-time notification", {
        userId,
        notificationId: notificationData.id,
      });

      // Example WebSocket integration:
      // if (this.io) {
      //   this.io.to(`user:${userId}`).emit('notification', notificationData);
      // }

      // Example push notification integration:
      // await this.sendPushNotification(userId, notificationData);

      return true;
    } catch (error) {
      logger.error("Failed to broadcast real-time notification:", error);
      // Don't throw error as this is non-critical
      return false;
    }
  }

  // Get formatted notifications for a user (for API responses)
  async getFormattedNotifications(notifications) {
    return notifications.map((notification) => {
      return this.formatInAppNotification(
        notification,
        notification.metadata || {}
      );
    });
  }

  // Mark notifications as read in bulk
  async markNotificationsAsRead(notificationIds, userId) {
    try {
      // This would typically update the database
      // For now, we'll just log it

      logger.info("Marking notifications as read", {
        userId,
        count: notificationIds.length,
        notificationIds,
      });

      return {
        success: true,
        markedAsRead: notificationIds.length,
      };
    } catch (error) {
      logger.error("Failed to mark notifications as read:", error);
      throw error;
    }
  }

  // Get notification statistics
  async getNotificationStats(userId) {
    try {
      // This would typically query the database
      // For now, return mock data

      const stats = {
        total: 0,
        unread: 0,
        byCategory: {},
        byPriority: {
          high: 0,
          medium: 0,
          low: 0,
        },
      };

      logger.info("Retrieved notification stats", {
        userId,
        stats,
      });

      return stats;
    } catch (error) {
      logger.error("Failed to get notification stats:", error);
      throw error;
    }
  }
}

module.exports = new InAppService();
