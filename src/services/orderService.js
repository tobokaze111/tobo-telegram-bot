const Order = require('../db/models/Order');
const User = require('../db/models/User');
const { logger } = require('../utils/logger');

async function createOrder({ userId, productId, deliveryData, price }) {
  const order = await Order.create({
    userId,
    productId,
    deliveryData,
    price,
  });

  await User.findByIdAndUpdate(userId, { $push: { orders: order._id } });

  logger.info('Order created', { orderId: order._id, userId, productId, price });
  return order;
}

async function listUserOrders(userId) {
  return Order.find({ userId }).sort({ createdAt: -1 }).populate('productId');
}

async function listAllOrders() {
  return Order.find({}).sort({ createdAt: -1 }).populate('userId productId');
}

module.exports = {
  createOrder,
  listUserOrders,
  listAllOrders,
};


