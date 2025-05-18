const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    try {
      this.transporter = nodemailer.createTransporter({
        host: process.env.EMAIL_HOST || "smtp.gmail.com",
        port: process.env.EMAIL_PORT || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      // Verify connection
      this.transporter.verify((error, success) => {
        if (error) {
          logger.error("Email transporter verification failed:", error);
        } else {
          logger.info("Email transporter is ready");
        }
      });
    } catch (error) {
      logger.error("Failed to initialize email transporter:", error);
    }
  }

  async sendEmail(notification) {
    try {
      if (!this.transporter) {
        throw new Error("Email transporter not initialized");
      }

      const { subject, message, recipient, metadata = {} } = notification;

      // Prepare email options
      const mailOptions = {
        from: {
          name: metadata.senderName || "Notification Service",
          address: process.env.EMAIL_USER,
        },
        to: recipient,
        subject: subject,
        text: message,
        html: this.generateHTMLContent(subject, message, metadata),
      };

      // Send email
      const info = await this.transporter.sendMail(mailOptions);

      logger.info("Email sent successfully", {
        notificationId: notification._id,
        messageId: info.messageId,
        recipient,
      });

      return {
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
      };
    } catch (error) {
      logger.error("Failed to send email:", error, {
        notificationId: notification._id,
        recipient: notification.recipient,
      });
      throw error;
    }
  }

  generateHTMLContent(subject, message, metadata = {}) {
    // Simple HTML template - can be enhanced with proper templating engine
    const template = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-radius: 5px;
            margin-bottom: 20px;
          }
          .content {
            padding: 20px 0;
          }
          .footer {
            font-size: 12px;
            color: #666;
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
          }
          .button {
            display: inline-block;
            padding: 10px 20px;
            background-color: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${subject}</h1>
        </div>
        <div class="content">
          ${message.replace(/\n/g, "<br>")}
          ${
            metadata.actionUrl
              ? `<br><br><a href="${metadata.actionUrl}" class="button">${
                  metadata.actionText || "Take Action"
                }</a>`
              : ""
          }
        </div>
        <div class="footer">
          <p>This is an automated message from ${
            metadata.serviceName || "Notification Service"
          }.</p>
          ${
            metadata.unsubscribeUrl
              ? `<p><a href="${metadata.unsubscribeUrl}">Unsubscribe</a></p>`
              : ""
          }
        </div>
      </body>
      </html>
    `;

    return template;
  }

  // Test email configuration
  async testConnection() {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      logger.error("Email connection test failed:", error);
      return false;
    }
  }
}

module.exports = new EmailService();
