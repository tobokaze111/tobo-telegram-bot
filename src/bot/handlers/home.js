const { getHomeKeyboard } = require('../keyboards/homeKeyboard');
const { getOrCreateUser } = require('../../services/walletService');
const { logger } = require('../../utils/logger');
const { getSetting } = require('../../services/settingsService');

function registerHomeHandlers(bot) {
  bot.start(async (ctx) => {
    try {
      const telegramId = String(ctx.from.id);
      await getOrCreateUser(telegramId);

      const text = await getSetting(
        'home_text',
        '🎬 **OTT VENDING MACHINE**\n' +
          'Buy premium digital accounts instantly — 24/7.\n\n' +
          '⚡ Instant Delivery\n' +
          '🔒 Secure Transactions\n' +
          '⭐ Premium Accounts\n' +
          '⏳ Always Available'
      );

      await ctx.replyWithMarkdown(text, getHomeKeyboard(ctx));
    } catch (error) {
      logger.error('Error in /start', { error });
      await ctx.reply('Something went wrong while starting the bot. Please try again later.');
    }
  });

  bot.action('HOME', async (ctx) => {
    await ctx.answerCbQuery();
    const text = await getSetting(
      'home_secondary_text',
      '🏠 **Home**\n\nUse the menu below to browse services, manage your funds, and view your orders.'
    );
    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...getHomeKeyboard(ctx),
    });
  });
}

module.exports = {
  registerHomeHandlers,
};


