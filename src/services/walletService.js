const User = require('../db/models/User');
const { logger } = require('../utils/logger');

async function getOrCreateUser(telegramId, isAdmin = false) {
  let user = await User.findOne({ telegramId });
  if (!user) {
    user = await User.create({ telegramId, isAdmin });
    logger.info('New user created', { telegramId, isAdmin });
  }
  return user;
}

async function getBalance(telegramId) {
  const user = await getOrCreateUser(telegramId);
  return user.balance || 0;
}

async function addBalance(telegramId, amount) {
  const user = await getOrCreateUser(telegramId);
  user.balance += amount;
  await user.save();
  logger.info('Balance updated', { telegramId, amount, newBalance: user.balance });
  return user.balance;
}

async function deductBalance(telegramId, amount) {
  const user = await getOrCreateUser(telegramId);
  if (user.balance < amount) {
    throw new Error('INSUFFICIENT_BALANCE');
  }
  user.balance -= amount;
  await user.save();
  logger.info('Balance deducted', { telegramId, amount, newBalance: user.balance });
  return user.balance;
}

module.exports = {
  getOrCreateUser,
  getBalance,
  addBalance,
  deductBalance,
};


