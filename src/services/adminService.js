const User = require('../db/models/User');
const { listAllOrders } = require('./orderService');
const { logger } = require('../utils/logger');

async function listUsers() {
  return User.find({}).sort({ createdAt: -1 });
}

async function setUserAdmin(telegramId, isAdmin = true) {
  const user = await User.findOneAndUpdate(
    { telegramId },
    { isAdmin },
    { new: true }
  );
  logger.info('User admin flag updated', { telegramId, isAdmin });
  return user;
}

async function addBalanceToUser(telegramId, amount) {
  const user = await User.findOne({ telegramId });
  if (!user) throw new Error('USER_NOT_FOUND');
  user.balance += amount;
  await user.save();
  logger.info('Admin added balance to user', {
    telegramId,
    amount,
    newBalance: user.balance,
  });
  return user;
}

async function getSystemOverview() {
  const users = await User.countDocuments();
  const orders = await listAllOrders();
  const totalRevenue = orders.reduce((acc, o) => acc + (o.price || 0), 0);
  return {
    users,
    orders: orders.length,
    totalRevenue,
  };
}

module.exports = {
  listUsers,
  setUserAdmin,
  addBalanceToUser,
  getSystemOverview,
};


