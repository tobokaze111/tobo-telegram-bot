require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const { connectDB } = require('../db/connect');
const { logger } = require('../utils/logger');
const { userMiddleware } = require('./middlewares/userMiddleware');

const { registerHomeHandlers } = require('./handlers/home');
const { registerWalletHandlers } = require('./handlers/wallet');
const { registerProductHandlers } = require('./handlers/products');
const { registerOrderHandlers } = require('./handlers/orders');
const { registerMiscHandlers } = require('./handlers/misc');
const { registerAdminHandlers } = require('./handlers/admin');
const { registerSupportHandlers } = require('./handlers/support');

async function bootstrap() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    throw new Error('BOT_TOKEN is not defined in .env');
  }

  await connectDB();

  const bot = new Telegraf(token);

  // Global middlewares
  bot.use(session());
  bot.use(userMiddleware);

  // Register handlers (order matters - admin flows first, then support)
  registerHomeHandlers(bot);
  registerWalletHandlers(bot);
  registerProductHandlers(bot);
  registerOrderHandlers(bot);
  registerMiscHandlers(bot);
  registerAdminHandlers(bot);
  registerSupportHandlers(bot); // Must be after admin handlers

  // Launch in long-polling mode by default
  await bot.launch();
  logger.info('Bot started successfully');

  // Graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error('Fatal error during bot startup', { error: err });
  process.exit(1);
});


