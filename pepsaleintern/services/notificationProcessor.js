const Notification = require("../models/Notification");
const emailService = require("./emailService");
const smsService = require("./smsService");
const inAppService = require("./inAppService");
const logger = require("../utils/logger");

// Process notification job
const processNotification = async (job) => {
  const { notificationId, type } = job.data;

  try {
    logger.info(`Processing notification: ${notificationId}`, {
      jobId: job.id,
      type,
      attempts: job.attemptsMade + 1,
    });

    // Get notification from database
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      throw new Error(`Notification not found: ${notificationId}`);
    }

    // Check if already processed
    if (notification.status === "sent") {
      logger.info(`Notification already sent: ${notificationId}`);
      return { status: "already_sent" };
    }

    // Update attempts
    await notification.incrementAttempts();

    // Process based on type
    let result;
    switch (type) {
      case "email":
        result = await emailService.sendEmail(notification);
        break;
      case "sms":
        result = await smsService.sendSMS(notification);
        break;
      case "in-app":
        result = await inAppService.createInAppNotification(notification);
        break;
      default:
        throw new Error(`Unknown notification type: ${type}`);
    }

    // Mark as sent
    await notification.markAsSent();

    logger.info(`Notification sent successfully: ${notificationId}`, {
      jobId: job.id,
      type,
      result,
    });

    return {
      status: "sent",
      notificationId,
      result,
    };
  } catch (error) {
    logger.error(`Failed to process notification ${notificationId}:`, error, {
      jobId: job.id,
      attempts: job.attemptsMade + 1,
    });

    // Update notification with error
    try {
      const notification = await Notification.findById(notificationId);
      if (notification && job.attemptsMade + 1 >= job.opts.attempts) {
        // Final attempt failed
        await notification.markAsFailed(error.message);
      }
    } catch (updateError) {
      logger.error(
        `Failed to update notification ${notificationId} status:`,
        updateError
      );
    }

    throw error;
  }
};

module.exports = {
  processNotification,
};
