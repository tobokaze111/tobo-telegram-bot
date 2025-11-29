const { listProducts, getProductById, consumeCredential } = require('../../services/productService');
const { getOrCreateUser, deductBalance, addBalance } = require('../../services/walletService');
const { createOrder } = require('../../services/orderService');
const { formatCurrency } = require('../../utils/helper');
const { logger } = require('../../utils/logger');
const { Markup } = require('telegraf');
const { getSetting } = require('../../services/settingsService');

function productListKeyboard(products) {
  const rows = products.map((p) => [
    Markup.button.callback(`🎟 ${p.name} — ${formatCurrency(p.price)}`, `PRODUCT_${p._id}`),
  ]);
  rows.push([Markup.button.callback('⬅️ Back', 'HOME')]);
  return Markup.inlineKeyboard(rows);
}

function productDetailKeyboard(productId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🛒 Buy Now', `BUY_${productId}`)],
    [Markup.button.callback('⬅️ Back', 'BROWSE_SERVICES')],
  ]);
}

function registerProductHandlers(bot) {
  bot.action('BROWSE_SERVICES', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const products = await listProducts();
      if (!products.length) {
        const emptyText = await getSetting(
          'services_empty_text',
          '📂 **Services**\n\nNo services are available yet. Please check back later.'
        );
        await ctx.editMessageText(emptyText, { parse_mode: 'Markdown' });
        return;
      }
      const text = await getSetting(
        'services_list_text',
        '📂 **Services**\n\nSelect a service to view details and purchase.'
      );
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...productListKeyboard(products),
      });
    } catch (error) {
      logger.error('Error in BROWSE_SERVICES', { error });
      await ctx.reply('Unable to load services right now.');
    }
  });

  bot.action(/^PRODUCT_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const id = ctx.match[1];
      const product = await getProductById(id);
      if (!product) {
        await ctx.reply('This product no longer exists.');
        return;
      }
      const text =
        `🎟 **${product.name}**\n\n` +
        `${product.description || 'Premium digital subscription.'}\n\n` +
        `💵 Price: *${formatCurrency(product.price)}*\n` +
        `📦 Stock: *${product.stock}*`;
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...productDetailKeyboard(product._id),
      });
    } catch (error) {
      logger.error('Error in PRODUCT_', { error });
      await ctx.reply('Unable to fetch product details.');
    }
  });

  bot.action(/^BUY_(.+)$/, async (ctx) => {
    const sessionId = `${ctx.from.id}-${ctx.match[1]}`;
    let balanceDeducted = false;
    try {
      await ctx.answerCbQuery();
      const productId = ctx.match[1];
      const telegramId = String(ctx.from.id);

      const user = await getOrCreateUser(telegramId);
      const product = await getProductById(productId);
      if (!product) {
        await ctx.reply('This product is no longer available.');
        return;
      }

      // Check stock FIRST before deducting balance
      if (!product.credentials || product.credentials.length === 0 || product.stock === 0) {
        await ctx.reply(
          '❌ *Out of Stock*\n\n' +
            'This product is currently out of stock. Please check back later.',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Check balance
      if (user.balance < product.price) {
        await ctx.reply(
          '❌ *Insufficient balance*\n\n' +
            `You need *${formatCurrency(product.price - user.balance)}* more to buy this.\n` +
            'Use **Add Funds** from the main menu.',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Deduct balance first
      await deductBalance(telegramId, product.price);
      balanceDeducted = true;

      // Then consume credential (if this fails, we'll refund)
      let credential;
      try {
        credential = await consumeCredential(productId);
      } catch (error) {
        // If credential consumption fails, refund the balance
        if (error.message === 'OUT_OF_STOCK' || error.message === 'PRODUCT_NOT_FOUND') {
          await addBalance(telegramId, product.price);
          balanceDeducted = false;
          await ctx.reply(
            '❌ *Out of Stock*\n\n' +
              'Sorry, this product went out of stock. Your payment has been refunded to your wallet.',
            { parse_mode: 'Markdown' }
          );
          return;
        }
        throw error; // Re-throw other errors
      }

      const deliveryText =
        '🎉 **Your Subscription is Ready!**\n\n' +
        `📧 Email: \`${credential.email || 'N/A'}\`\n` +
        `🔑 Password: \`${credential.password || 'N/A'}\`\n` +
        `⏳ Validity: \`${credential.validity || 'See description'}\`\n` +
        (credential.extra ? `\n📝 Notes: ${credential.extra}` : '');

      await ctx.replyWithMarkdown(deliveryText, { disable_web_page_preview: true });

      await createOrder({
        userId: user._id,
        productId: product._id,
        deliveryData: credential,
        price: product.price,
      });

      logger.info('Purchase completed', { sessionId, telegramId, productId });
    } catch (error) {
      logger.error('Error in BUY_', { sessionId, error });
      
      // If balance was deducted but order failed, try to refund
      if (balanceDeducted) {
        try {
          const product = await getProductById(ctx.match[1]);
          if (product) {
            await addBalance(String(ctx.from.id), product.price);
            await ctx.reply(
              '❌ *Purchase Failed*\n\n' +
                'An error occurred during purchase. Your payment has been refunded to your wallet.\n\n' +
                'Please contact support if you need assistance.',
              { parse_mode: 'Markdown' }
            );
          }
        } catch (refundError) {
          logger.error('Failed to refund balance', { error: refundError, sessionId });
          await ctx.reply(
            '❌ *Purchase Failed*\n\n' +
              'An error occurred. If funds were deducted, please contact support immediately with your transaction details.',
            { parse_mode: 'Markdown' }
          );
        }
      } else {
        await ctx.reply(
          '❌ *Purchase Failed*\n\n' +
            'An error occurred. Please try again or contact support.',
          { parse_mode: 'Markdown' }
        );
      }
    }
  });
}

module.exports = {
  registerProductHandlers,
};


