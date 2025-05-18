const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["email", "sms", "in-app"],
      required: true,
    },
    subject: {
      type: String,
      required: function () {
        return this.type === "email";
      },
    },
    message: {
      type: String,
      required: true,
    },
    recipient: {
      type: String,
      required: function () {
        return this.type !== "in-app";
      },
    },
    status: {
      type: String,
      enum: ["pending", "queued", "processing", "sent", "failed"],
      default: "pending",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    errorMessage: {
      type: String,
    },
    sentAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
    jobId: {
      type: String, // Bull queue job ID
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ status: 1, createdAt: -1 });
notificationSchema.index({ type: 1, status: 1 });

// Virtual for checking if notification is read (for in-app notifications)
notificationSchema.virtual("isRead").get(function () {
  return this.type === "in-app" && this.status === "sent";
});

// Method to mark notification as failed
notificationSchema.methods.markAsFailed = function (errorMessage) {
  this.status = "failed";
  this.failedAt = new Date();
  this.errorMessage = errorMessage;
  return this.save();
};

// Method to mark notification as sent
notificationSchema.methods.markAsSent = function () {
  this.status = "sent";
  this.sentAt = new Date();
  return this.save();
};

// Method to increment attempts
notificationSchema.methods.incrementAttempts = function () {
  this.attempts += 1;
  this.status = "processing";
  return this.save();
};

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
