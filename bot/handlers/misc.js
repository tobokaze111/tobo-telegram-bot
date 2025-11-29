const { logger } = require('../../utils/logger');
const { Markup } = require('telegraf');
const { getSetting } = require('../../services/settingsService');

function miscBackKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'HOME')]]);
}

function registerMiscHandlers(bot) {
  bot.action('HELP', async (ctx) => {
    await ctx.answerCbQuery();
    const text = await getSetting(
      'help_text',
      '❓ **Help**\n\n1. Use *Browse Services* to see available subscriptions.\n2. Top up your wallet with *Add Funds*.\n3. Purchase instantly and receive auto-delivered credentials.\n\nFor any issue, use the **Support** button.'
    );
    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...miscBackKeyboard(),
    });
  });

  bot.action('SUPPORT', async (ctx) => {
    await ctx.answerCbQuery();
    const dynamicText = await getSetting(
      'support_text',
      '👨‍💻 **Support**\n\n' +
        'For support, please contact:\n' +
        '📱 Telegram: @toboxott\n\n' +
        'Please share your order ID, payment screenshot, and issue details.'
    );
    await ctx.editMessageText(dynamicText, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url('💬 Contact @toboxott', 'https://t.me/toboxott')],
        [Markup.button.callback('⬅️ Back', 'HOME')],
      ]),
    });
  });

  bot.catch((err, ctx) => {
    logger.error('Telegraf error', { error: err, update: ctx.update });
  });
}

module.exports = {
  registerMiscHandlers,
};


