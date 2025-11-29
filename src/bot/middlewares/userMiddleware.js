const { getOrCreateUser } = require('../../services/walletService');
const { isAdmin } = require('../../utils/helper');

async function userMiddleware(ctx, next) {
  if (!ctx.from) return next();
  const telegramId = String(ctx.from.id);
  const user = await getOrCreateUser(telegramId, isAdmin(ctx.from.id));
  ctx.state.user = user;
  return next();
}

module.exports = {
  userMiddleware,
};


