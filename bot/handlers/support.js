const { Markup } = require('telegraf');
const { isAdmin } = require('../../utils/helper');
const { logger } = require('../../utils/logger');

// Store active conversations: adminMessageId -> userTelegramId
const conversations = new Map();

// Import admin flow checker (we need to check if admin is in flow)
// We'll use a simple check - if session has adminFlow or replyMode, skip
function registerSupportHandlers(bot) {
  // Handle admin reply text - must run BEFORE user message forwarding
  bot.on('text', async (ctx, next) => {
    // Skip if it's a command
    if (ctx.message.text.startsWith('/')) {
      return next();
    }

    // Only process if admin is in reply mode
    if (isAdmin(ctx.from.id) && ctx.session?.replyMode) {
      try {
        const { targetUserId } = ctx.session.replyMode;

        // Send reply to user
        await bot.telegram.sendMessage(
          targetUserId,
          `💬 **Reply from Support**\n\n${ctx.message.text}`,
          { parse_mode: 'Markdown' }
        );

        // Confirm to admin
        await ctx.reply(
          `✅ Reply sent to user \`${targetUserId}\``,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('💬 Reply Again', `REPLY_${targetUserId}`)],
            ]),
          }
        );

        // Clear reply mode
        delete ctx.session.replyMode;
        return; // Don't call next() - we handled it
      } catch (error) {
        logger.error('Error sending admin reply', { error });
        await ctx.reply('❌ Failed to send reply. User may have blocked the bot.');
        delete ctx.session.replyMode;
        return;
      }
    }

    // For non-admins: redirect to @toboxott for support
    if (!isAdmin(ctx.from.id)) {
      try {
        await ctx.reply(
          '👨‍💻 **Support**\n\n' +
          'For support, please contact:\n' +
          '📱 Telegram: @toboxott\n\n' +
          'Please share your order ID, payment screenshot, and issue details.',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.url('💬 Contact @toboxott', 'https://t.me/toboxott')],
              [Markup.button.callback('⬅️ Back to Home', 'HOME')],
            ]),
          }
        );
        return; // Don't call next() - we handled it
      } catch (error) {
        logger.error('Error in support handler', { error });
        return next();
      }
    }

    // For admins not in reply mode - let other handlers process
    return next();
  });

  // Handle admin reply button
  bot.action(/^REPLY_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
      await ctx.answerCbQuery('Admin only', { show_alert: true });
      return;
    }

    const targetUserId = ctx.match[1];
    const conversationKey = ctx.callbackQuery.message.message_id;
    conversations.set(conversationKey, targetUserId);

    await ctx.answerCbQuery();
    await ctx.reply(
      `💬 **Reply to User**\n\n` +
      `User ID: \`${targetUserId}\`\n\n` +
      `Send your reply message now. It will be delivered to the user.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancel', 'CANCEL_REPLY')],
        ]),
      }
    );

    // Store that admin is in reply mode
    if (!ctx.session) ctx.session = {};
    ctx.session.replyMode = { targetUserId, conversationKey };
  });

  // Cancel reply
  bot.action('CANCEL_REPLY', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    if (ctx.session) {
      delete ctx.session.replyMode;
    }
    await ctx.answerCbQuery();
    await ctx.reply('❌ Reply cancelled.');
  });
}

module.exports = {
  registerSupportHandlers,
};

