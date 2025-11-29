const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    telegramId: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'payment_received', 'rejected'],
      default: 'pending',
    },
    transactionId: {
      type: String,
      default: '',
    },
    screenshot: {
      type: String, // File ID from Telegram
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    verifiedBy: {
      type: String, // Admin Telegram ID
      default: '',
    },
    verifiedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Payment', paymentSchema);

