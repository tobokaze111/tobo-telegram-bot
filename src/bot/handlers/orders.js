const { listUserOrders } = require('../../services/orderService');
const { formatCurrency } = require('../../utils/helper');
const { logger } = require('../../utils/logger');
const { Markup } = require('telegraf');
const { getSetting } = require('../../services/settingsService');

function ordersBackKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'HOME')]]);
}

function registerOrderHandlers(bot) {
  bot.action('MY_ORDERS', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = String(ctx.from.id);
      const orders = await listUserOrders(ctx.state.user?._id || null);

      if (!orders || !orders.length) {
        const emptyText = await getSetting(
          'orders_empty_text',
          '📦 **My Orders**\n\nYou have not purchased anything yet.'
        );
        await ctx.editMessageText(emptyText, {
          parse_mode: 'Markdown',
          ...ordersBackKeyboard(),
        });
        return;
      }

      const lines = orders.slice(0, 10).map((o, idx) => {
        const name = o.productId?.name || 'Product';
        return `${idx + 1}. *${name}* — ${formatCurrency(o.price)} (${o.createdAt.toLocaleString()})`;
      });

      const header = await getSetting('orders_header_text', '📦 **My Orders**');
      const text = `${header}\n\n${lines.join('\n')}`;
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...ordersBackKeyboard(),
      });
    } catch (error) {
      logger.error('Error in MY_ORDERS', { error });
      await ctx.reply('Unable to fetch your orders right now.');
    }
  });
}

module.exports = {
  registerOrderHandlers,
};


