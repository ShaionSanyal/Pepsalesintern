const twilio = require("twilio");
const logger = require("../utils/logger");

class SMSService {
  constructor() {
    this.client = null;
    this.initClient();
  }

  initClient() {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken) {
        logger.warn(
          "Twilio credentials not provided. SMS service will not be available."
        );
        return;
      }

      this.client = twilio(accountSid, authToken);
      logger.info("Twilio client initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize Twilio client:", error);
    }
  }

  async sendSMS(notification) {
    try {
      if (!this.client) {
        throw new Error("SMS service not initialized");
      }

      const { message, recipient, metadata = {} } = notification;

      // Validate phone number format (basic validation)
      if (!this.isValidPhoneNumber(recipient)) {
        throw new Error(`Invalid phone number format: ${recipient}`);
      }

      // Prepare SMS options
      const smsOptions = {
        body: this.formatSMSMessage(message, metadata),
        from: process.env.TWILIO_PHONE_NUMBER,
        to: recipient,
      };

      // Add optional parameters
      if (metadata.mediaUrl) {
        smsOptions.mediaUrl = metadata.mediaUrl;
      }

      // Send SMS
      const smsResult = await this.client.messages.create(smsOptions);

      logger.info("SMS sent successfully", {
        notificationId: notification._id,
        messageSid: smsResult.sid,
        recipient,
        status: smsResult.status,
      });

      return {
        messageSid: smsResult.sid,
        status: smsResult.status,
        dateCreated: smsResult.dateCreated,
        dateSent: smsResult.dateSent,
        errorCode: smsResult.errorCode,
        errorMessage: smsResult.errorMessage,
      };
    } catch (error) {
      logger.error("Failed to send SMS:", error, {
        notificationId: notification._id,
        recipient: notification.recipient,
      });
      throw error;
    }
  }

  formatSMSMessage(message, metadata = {}) {
    // Add sender name or service name if provided
    let formattedMessage = message;

    if (metadata.senderName) {
      formattedMessage = `${metadata.senderName}: ${message}`;
    }

    // Add short URL if provided
    if (metadata.shortUrl) {
      formattedMessage += `\n\n${metadata.shortUrl}`;
    }

    // Ensure message doesn't exceed SMS limits
    const maxLength = 1600; // SMS segment limit
    if (formattedMessage.length > maxLength) {
      formattedMessage = formattedMessage.substring(0, maxLength - 3) + "...";
    }

    return formattedMessage;
  }

  isValidPhoneNumber(phoneNumber) {
    // Basic phone number validation (E.164 format)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  // Get SMS delivery status
  async getDeliveryStatus(messageSid) {
    try {
      if (!this.client) {
        throw new Error("SMS service not initialized");
      }

      const message = await this.client.messages(messageSid).fetch();

      return {
        sid: message.sid,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        dateCreated: message.dateCreated,
        dateSent: message.dateSent,
        dateUpdated: message.dateUpdated,
      };
    } catch (error) {
      logger.error("Failed to get SMS delivery status:", error);
      throw error;
    }
  }

  // Test SMS configuration
  async testConnection() {
    try {
      if (!this.client) {
        return false;
      }

      // Validate account by fetching account info
      await this.client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      return true;
    } catch (error) {
      logger.error("SMS connection test failed:", error);
      return false;
    }
  }

  // Get account balance (optional utility)
  async getAccountBalance() {
    try {
      if (!this.client) {
        throw new Error("SMS service not initialized");
      }

      const account = await this.client.api
        .accounts(process.env.TWILIO_ACCOUNT_SID)
        .fetch();
      return {
        accountSid: account.sid,
        friendlyName: account.friendlyName,
        status: account.status,
        type: account.type,
      };
    } catch (error) {
      logger.error("Failed to get account balance:", error);
      throw error;
    }
  }
}

module.exports = new SMSService();
