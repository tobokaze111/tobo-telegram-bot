const Payment = require('../db/models/Payment');
const User = require('../db/models/User');
const { logger } = require('../utils/logger');
const { addBalance } = require('./walletService');

async function createPaymentRequest({ telegramId, amount, transactionId = '', screenshot = '', notes = '' }) {
  const user = await User.findOne({ telegramId });
  if (!user) throw new Error('USER_NOT_FOUND');

  const payment = await Payment.create({
    userId: user._id,
    telegramId,
    amount,
    transactionId,
    screenshot,
    notes,
    status: 'pending',
  });

  logger.info('Payment request created', { paymentId: payment._id, telegramId, amount });
  return payment;
}

async function getPendingPayments() {
  return Payment.find({ status: 'pending' })
    .populate('userId', 'telegramId')
    .sort({ createdAt: -1 });
}

async function getPaymentById(paymentId) {
  return Payment.findById(paymentId).populate('userId', 'telegramId');
}

async function approvePayment(paymentId, adminTelegramId) {
  const payment = await Payment.findById(paymentId).populate('userId', 'telegramId');
  if (!payment) throw new Error('PAYMENT_NOT_FOUND');
  if (payment.status !== 'pending') throw new Error('PAYMENT_ALREADY_PROCESSED');

  // Update payment status
  payment.status = 'payment_received';
  payment.verifiedBy = adminTelegramId;
  payment.verifiedAt = new Date();
  await payment.save();

  // Add balance to user
  await addBalance(payment.telegramId, payment.amount);

  logger.info('Payment approved', { paymentId, telegramId: payment.telegramId, amount: payment.amount });
  return payment;
}

async function rejectPayment(paymentId, adminTelegramId) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new Error('PAYMENT_NOT_FOUND');
  if (payment.status !== 'pending') throw new Error('PAYMENT_ALREADY_PROCESSED');

  payment.status = 'rejected';
  payment.verifiedBy = adminTelegramId;
  payment.verifiedAt = new Date();
  await payment.save();

  logger.info('Payment rejected', { paymentId });
  return payment;
}

async function getUserPayments(telegramId) {
  return Payment.find({ telegramId }).sort({ createdAt: -1 }).limit(10);
}

module.exports = {
  createPaymentRequest,
  getPendingPayments,
  getPaymentById,
  approvePayment,
  rejectPayment,
  getUserPayments,
};

