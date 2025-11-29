const { Markup } = require('telegraf');
const { isAdmin, formatCurrency } = require('../../utils/helper');
const { logger } = require('../../utils/logger');
const { getAdminMainKeyboard, getEditTextsKeyboard } = require('../keyboards/adminKeyboard');
const { createProduct, addCredentials, updatePrice, listProducts } = require('../../services/productService');
const { listAllOrders } = require('../../services/orderService');
const { listUsers, addBalanceToUser } = require('../../services/adminService');
const { setSetting } = require('../../services/settingsService');
const { getPendingPayments, getPaymentById, approvePayment, rejectPayment } = require('../../services/paymentService');

// In-memory admin flow store keyed by Telegram user id
const adminFlows = new Map();

function requireAdmin(ctx) {
  if (!isAdmin(ctx.from.id)) {
    ctx.answerCbQuery('Admin only', { show_alert: true }).catch(() => {});
    return false;
  }
  return true;
}

function getAdminFlow(ctx) {
  const key = String(ctx.from.id);
  return adminFlows.get(key) || null;
}

function setAdminFlow(ctx, flow) {
  const key = String(ctx.from.id);
  if (flow) {
    adminFlows.set(key, flow);
  } else {
    adminFlows.delete(key);
  }
}

function clearAdminSession(ctx) {
  setAdminFlow(ctx, null);
}

const EDITABLE_TEXTS = {
  ADMIN_EDIT_HOME_TEXT: { key: 'home_text', label: 'Home Screen' },
  ADMIN_EDIT_SERVICES_EMPTY_TEXT: { key: 'services_empty_text', label: 'Services (No Products)' },
  ADMIN_EDIT_WALLET_TEXT: { key: 'wallet_text', label: 'My Wallet' },
  ADMIN_EDIT_ADD_FUNDS_TEXT: { key: 'add_funds_text', label: 'Add Funds' },
  ADMIN_EDIT_ORDERS_EMPTY_TEXT: { key: 'orders_empty_text', label: 'Orders (Empty)' },
  ADMIN_EDIT_HELP_TEXT: { key: 'help_text', label: 'Help' },
  ADMIN_EDIT_SUPPORT_TEXT: { key: 'support_text', label: 'Support' },
};

function registerAdminHandlers(bot) {
  // Open admin panel from button
  bot.action('ADMIN_PANEL', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    clearAdminSession(ctx);
    await ctx.answerCbQuery().catch(() => {});
    const text =
      '🛠 **Admin Panel**\n\n' +
      'Manage products, stock, prices, users, and broadcasts from here.';
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...getAdminMainKeyboard(),
      });
    } catch {
      // Fallback if original message cannot be edited
      await ctx.replyWithMarkdown(text, getAdminMainKeyboard());
    }
  });

  // Also allow /admin command as a fallback
  bot.command('admin', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
      await ctx.reply('❌ Access denied. Admin only.');
      return;
    }
    clearAdminSession(ctx);
    const text =
      '🛠 **Admin Panel**\n\n' +
      'Manage products, stock, prices, users, and broadcasts from here.';
    await ctx.replyWithMarkdown(text, getAdminMainKeyboard());
  });

  // ------- ADD PRODUCT -------
  bot.action('ADMIN_ADD_PRODUCT', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    clearAdminSession(ctx);
    await ctx.answerCbQuery();
    setAdminFlow(ctx, { step: 'ADD_PRODUCT_WAIT', type: 'addProduct' });
    const text =
      '➕ **Add Product**\n\n' +
      'Send product details in this format (one message):\n' +
      '`Name | Price | Description`\n\n' +
      'Example:\n' +
      '`Netflix 1 Month | 199 | 1 Month Premium UHD`';
    await ctx.replyWithMarkdown(text);
  });

  // ------- ADD STOCK -------
  bot.action('ADMIN_ADD_STOCK', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    clearAdminSession(ctx);
    await ctx.answerCbQuery();
    setAdminFlow(ctx, { step: 'ADD_STOCK_WAIT_PRODUCT', type: 'addStock' });
    const text =
      '📥 **Add Stock**\n\n' +
      'First, send the *Product ID* for which you want to add credentials.\n' +
      'You can copy it from the database (MongoDB) or from your product list.';
    await ctx.replyWithMarkdown(text);
  });

  // ------- UPDATE PRICE -------
  bot.action('ADMIN_UPDATE_PRICE', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    clearAdminSession(ctx);
    await ctx.answerCbQuery();
    setAdminFlow(ctx, { step: 'UPDATE_PRICE_WAIT', type: 'updatePrice' });
    const text =
      '💲 **Update Price**\n\n' +
      'Send in this format:\n' +
      '`ProductID | NewPrice`\n\n' +
      'Example:\n' +
      '`64f123abc456... | 249`';
    await ctx.replyWithMarkdown(text);
  });

  // ------- VIEW PRODUCTS -------
  bot.action('ADMIN_VIEW_PRODUCTS', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const products = await listProducts();
    if (!products.length) {
      await ctx.reply('📋 No products yet. Use "Add Product" to create one.');
      return;
    }
    const lines = products.map((p) => {
      return `📋 *${p.name}*\n` +
        `ID: \`${p._id}\`\n` +
        `Price: ${formatCurrency(p.price)} | Stock: ${p.stock}\n`;
    });
    const text = '📋 **All Products**\n\n' + lines.join('\n') + 
      '\n💡 Copy the Product ID to use in "Add Stock" or "Update Price".';
    await ctx.replyWithMarkdown(text);
  });

  // ------- VIEW ORDERS -------
  bot.action('ADMIN_VIEW_ORDERS', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const orders = await listAllOrders();
    if (!orders.length) {
      await ctx.reply('📦 No orders yet.');
      return;
    }
    const lines = orders.slice(0, 20).map((o) => {
      const userTg = o.userId?.telegramId || 'N/A';
      const productName = o.productId?.name || 'Product';
      return `#${o._id} - ${productName} - ${formatCurrency(o.price)} - TG: ${userTg}`;
    });
    await ctx.replyWithMarkdown('📦 **Recent Orders**\n\n' + lines.join('\n'));
  });

  // ------- VIEW USERS -------
  bot.action('ADMIN_VIEW_USERS', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const users = await listUsers();
    if (!users.length) {
      await ctx.reply('👥 No users yet.');
      return;
    }
    const lines = users.slice(0, 30).map((u) => {
      return `TG: ${u.telegramId} | Balance: ${formatCurrency(u.balance)} | Admin: ${u.isAdmin ? '✅' : '❌'}`;
    });
    await ctx.replyWithMarkdown('👥 **Users**\n\n' + lines.join('\n'));
  });

  // ------- VIEW PAYMENTS -------
  bot.action('ADMIN_VIEW_PAYMENTS', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const payments = await getPendingPayments();
    if (!payments.length) {
      await ctx.reply('💳 No pending payments.');
      return;
    }
    
    const lines = payments.slice(0, 10).map((p) => {
      const statusEmoji = p.status === 'pending' ? '⏳' : p.status === 'payment_received' ? '✅' : '❌';
      return `${statusEmoji} TG: ${p.telegramId} | ${formatCurrency(p.amount)} | Txn: ${p.transactionId || 'N/A'}`;
    });
    
    const buttons = payments.slice(0, 10).map((p) => [
      Markup.button.callback(
        `${p.status === 'pending' ? '⏳' : '✅'} ${p.telegramId} - ${formatCurrency(p.amount)}`,
        `PAYMENT_${p._id}`
      )
    ]);
    buttons.push([Markup.button.callback('⬅️ Back to Admin', 'ADMIN_PANEL')]);
    
    const text = '💳 **Pending Payments**\n\n' + lines.join('\n') + 
      '\n\n💡 Tap a payment below to view details and approve/reject.';
    await ctx.replyWithMarkdown(text, Markup.inlineKeyboard(buttons));
  });

  // View payment details and approve/reject
  bot.action(/^PAYMENT_(.+)$/, async (ctx) => {
    if (!requireAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const paymentId = ctx.match[1];
    
    try {
      const payment = await getPaymentById(paymentId);
      if (!payment) {
        await ctx.reply('❌ Payment not found.');
        return;
      }

      const statusText = payment.status === 'pending' ? '⏳ Pending' : 
                        payment.status === 'payment_received' ? '✅ Approved' : '❌ Rejected';
      
      let text = `💳 **Payment Details**\n\n` +
        `ID: \`${payment._id}\`\n` +
        `User: ${payment.telegramId}\n` +
        `Amount: ${formatCurrency(payment.amount)}\n` +
        `Transaction ID: ${payment.transactionId || 'N/A'}\n` +
        `Status: ${statusText}\n` +
        `Date: ${payment.createdAt.toLocaleString()}\n`;

      if (payment.screenshot) {
        text += `\n📸 Screenshot available`;
      }

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Approve & Credit', `APPROVE_PAYMENT_${paymentId}`),
          Markup.button.callback('❌ Reject', `REJECT_PAYMENT_${paymentId}`),
        ],
        [Markup.button.callback('⬅️ Back to Payments', 'ADMIN_VIEW_PAYMENTS')],
      ]);

      if (payment.screenshot) {
        await ctx.replyWithPhoto(payment.screenshot, {
          caption: text,
          parse_mode: 'Markdown',
          ...keyboard,
        });
      } else {
        await ctx.replyWithMarkdown(text, keyboard);
      }
    } catch (error) {
      logger.error('Error viewing payment', { error, paymentId });
      await ctx.reply('❌ Error loading payment details.');
    }
  });

  // Approve payment
  bot.action(/^APPROVE_PAYMENT_(.+)$/, async (ctx) => {
    if (!requireAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const paymentId = ctx.match[1];
    
    try {
      const payment = await approvePayment(paymentId, String(ctx.from.id));
      
      // Notify user
      try {
        await bot.telegram.sendMessage(
          payment.telegramId,
          `✅ **Payment Approved!**\n\n` +
          `Amount: ${formatCurrency(payment.amount)} has been credited to your wallet.\n` +
          `Transaction ID: \`${payment.transactionId}\``,
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        logger.warn('Failed to notify user of payment approval', { telegramId: payment.telegramId });
      }

      await ctx.reply(
        `✅ **Payment Approved**\n\n` +
        `Amount: ${formatCurrency(payment.amount)} credited to user \`${payment.telegramId}\``,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Payments', 'ADMIN_VIEW_PAYMENTS')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error approving payment', { error, paymentId });
      await ctx.reply('❌ Error approving payment. ' + (error.message || ''));
    }
  });

  // Reject payment
  bot.action(/^REJECT_PAYMENT_(.+)$/, async (ctx) => {
    if (!requireAdmin(ctx)) return;
    await ctx.answerCbQuery();
    const paymentId = ctx.match[1];
    
    try {
      const payment = await rejectPayment(paymentId, String(ctx.from.id));
      
      // Notify user
      try {
        await bot.telegram.sendMessage(
          payment.telegramId,
          `❌ **Payment Rejected**\n\n` +
          `Your payment of ${formatCurrency(payment.amount)} was rejected.\n` +
          `Transaction ID: \`${payment.transactionId}\`\n\n` +
          `Please contact support if you believe this is an error.`,
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        logger.warn('Failed to notify user of payment rejection', { telegramId: payment.telegramId });
      }

      await ctx.reply(
        `❌ **Payment Rejected**\n\n` +
        `Payment from user \`${payment.telegramId}\` has been rejected.`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Payments', 'ADMIN_VIEW_PAYMENTS')],
          ]),
        }
      );
    } catch (error) {
      logger.error('Error rejecting payment', { error, paymentId });
      await ctx.reply('❌ Error rejecting payment. ' + (error.message || ''));
    }
  });

  // ------- ADD BALANCE -------
  bot.action('ADMIN_ADD_BALANCE', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    clearAdminSession(ctx);
    await ctx.answerCbQuery();
    setAdminFlow(ctx, { step: 'ADD_BALANCE_WAIT', type: 'addBalance' });
    const text =
      '💰 **Add Balance to User**\n\n' +
      'Send in this format:\n' +
      '`TelegramId | Amount`\n\n' +
      'Example:\n' +
      '`6758031987 | 200`';
    await ctx.replyWithMarkdown(text);
  });

  // ------- BROADCAST -------
  bot.action('ADMIN_BROADCAST', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    clearAdminSession(ctx);
    await ctx.answerCbQuery();
    setAdminFlow(ctx, { step: 'BROADCAST_WAIT', type: 'broadcast' });
    const text =
      '📢 **Broadcast Message**\n\n' +
      'Send the message you want to broadcast to all users.\n' +
      'Use Markdown formatting if needed.';
    await ctx.replyWithMarkdown(text);
  });

  // ------- EDIT TEXTS MAIN MENU -------
  bot.action('ADMIN_EDIT_TEXTS', async (ctx) => {
    if (!requireAdmin(ctx)) return;
    clearAdminSession(ctx);
    await ctx.answerCbQuery();
    const text =
      '📝 **Edit UI Texts**\n\n' +
      'Choose which screen text you want to edit.';
    await ctx.replyWithMarkdown(text, getEditTextsKeyboard());
  });

  // Individual text edit entries
  Object.entries(EDITABLE_TEXTS).forEach(([action, def]) => {
    bot.action(action, async (ctx) => {
      if (!requireAdmin(ctx)) return;
      clearAdminSession(ctx);
      await ctx.answerCbQuery();
      setAdminFlow(ctx, { type: 'editText', step: 'EDIT_TEXT_WAIT', key: def.key, label: def.label });
      const text =
        `📝 **Edit ${def.label} Text**\n\n` +
        'Send the full message you want users to see on that screen.\n' +
        'You can use Markdown formatting.';
      await ctx.replyWithMarkdown(text);
    });
  });

  // ------- TEXT HANDLER FOR ADMIN FLOWS -------
  bot.on('text', async (ctx, next) => {
    const flow = getAdminFlow(ctx);
    if (!flow || !isAdmin(ctx.from.id)) {
      return next();
    }

    try {
      // ADD PRODUCT
      if (flow.type === 'addProduct' && flow.step === 'ADD_PRODUCT_WAIT') {
        const [name, priceStr, description] = ctx.message.text.split('|').map((s) => s.trim());
        const price = Number(priceStr);
        if (!name || isNaN(price)) {
          await ctx.reply('Invalid format. Please use: `Name | Price | Description`');
          return;
        }
        const product = await createProduct({
          name,
          price,
          description: description || '',
        });
        logger.info('Admin created product', { productId: product._id, admin: ctx.from.id });
        await ctx.replyWithMarkdown(
          '✅ **Product Created**\n\n' +
            `ID: \`${product._id}\`\n` +
            `Name: *${product.name}*\n` +
            `Price: *${formatCurrency(product.price)}*`
        );
        clearAdminSession(ctx);
        return;
      }

      // ADD STOCK
      if (flow.type === 'addStock' && flow.step === 'ADD_STOCK_WAIT_PRODUCT') {
        setAdminFlow(ctx, {
          ...flow,
          productId: ctx.message.text.trim(),
          step: 'ADD_STOCK_WAIT_CREDENTIALS',
        });
        const text =
          'Now send credentials in one of these formats:\n\n' +
          '**Option 1 (Recommended):** One line per account with commas:\n' +
          '`user@mail.com,pass123,1 Month,Profile 1`\n\n' +
          '**Option 2:** Multiple lines (4 lines = 1 account):\n' +
          '`user@mail.com`\n`pass123`\n`1 Month`\n`Profile 1`\n\n' +
          'You can add multiple accounts by sending multiple lines.';
        await ctx.replyWithMarkdown(text);
        return;
      }

      if (flow.type === 'addStock' && flow.step === 'ADD_STOCK_WAIT_CREDENTIALS') {
        const productId = flow.productId;
        const text = ctx.message.text.trim();
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        
        let credentialsArray = [];
        
        // Check if it's comma-separated format (one account per line)
        if (lines[0].includes(',')) {
          // Format: email,password,validity,extra (one per line)
          credentialsArray = lines.map((line) => {
            const parts = line.split(',').map((s) => s.trim());
            return {
              email: parts[0] || '',
              password: parts[1] || '',
              validity: parts[2] || '',
              extra: parts[3] || '',
            };
          });
        } else if (lines.length >= 2) {
          // Format: multiple lines (email, password, validity, extra on separate lines)
          // Group every 4 lines as one credential, or use available lines
          for (let i = 0; i < lines.length; i += 4) {
            credentialsArray.push({
              email: lines[i] || '',
              password: lines[i + 1] || '',
              validity: lines[i + 2] || '',
              extra: lines[i + 3] || '',
            });
          }
        } else {
          await ctx.reply(
            '❌ Invalid format.\n\n' +
            '**Option 1 (Recommended):** One line per account with commas:\n' +
            '`user@mail.com,pass123,1 Month,Profile 1`\n\n' +
            '**Option 2:** Multiple lines (4 lines = 1 account):\n' +
            '`user@mail.com`\n`pass123`\n`1 Month`\n`Profile 1`'
          );
          return;
        }
        
        // Validate that we have at least email and password
        const invalid = credentialsArray.filter(c => !c.email || !c.password);
        if (invalid.length > 0) {
          await ctx.reply(
            `❌ Invalid format. Each account must have at least email and password.\n\n` +
            `**Correct format:** \`email,password,validity,extra\`\n\n` +
            `Example: \`user@mail.com,pass123,1 Month,Profile 1\``
          );
          return;
        }
        
        const addedCount = credentialsArray.length;
        const updated = await addCredentials(productId, credentialsArray);
        await ctx.replyWithMarkdown(
          '✅ **Stock Added**\n\n' +
            `Product: *${updated.name}*\n` +
            `Added: *${addedCount}* account(s)\n` +
            `Total Stock: *${updated.stock}*`
        );
        clearAdminSession(ctx);
        return;
      }

      // UPDATE PRICE
      if (flow.type === 'updatePrice' && flow.step === 'UPDATE_PRICE_WAIT') {
        const [productId, priceStr] = ctx.message.text.split('|').map((s) => s.trim());
        const price = Number(priceStr);
        if (!productId || isNaN(price)) {
          await ctx.reply('Invalid format. Use: `ProductID | NewPrice`');
          return;
        }
        const product = await updatePrice(productId, price);
        await ctx.replyWithMarkdown(
          '✅ **Price Updated**\n\n' +
            `Product: *${product.name}*\n` +
            `New Price: *${formatCurrency(product.price)}*`
        );
        clearAdminSession(ctx);
        return;
      }

      // ADD BALANCE
      if (flow.type === 'addBalance' && flow.step === 'ADD_BALANCE_WAIT') {
        const [tgId, amountStr] = ctx.message.text.split('|').map((s) => s.trim());
        const amount = Number(amountStr);
        if (!tgId || isNaN(amount)) {
          await ctx.reply('Invalid format. Use: `TelegramId | Amount`');
          return;
        }
        const user = await addBalanceToUser(tgId, amount);
        await ctx.replyWithMarkdown(
          '✅ **Balance Updated**\n\n' +
            `TG: \`${user.telegramId}\`\n` +
            `New Balance: *${formatCurrency(user.balance)}*`
        );
        clearAdminSession(ctx);
        return;
      }

      // BROADCAST
      if (flow.type === 'broadcast' && flow.step === 'BROADCAST_WAIT') {
        const message = ctx.message.text;
        const users = await listUsers();
        let sent = 0;
        for (const u of users) {
          try {
            await ctx.telegram.sendMessage(u.telegramId, message, {
              parse_mode: 'Markdown',
            });
            sent += 1;
          } catch (e) {
            logger.warn('Broadcast send failed', { to: u.telegramId, error: e.message });
          }
        }
        await ctx.reply(`📢 Broadcast sent to ${sent} users.`);
        clearAdminSession(ctx);
        return;
      }

      // EDIT GENERIC TEXT
      if (flow.type === 'editText' && flow.step === 'EDIT_TEXT_WAIT') {
        const newText = ctx.message.text;
        await setSetting(flow.key, newText);
        await ctx.reply(`✅ ${flow.label} text updated. Users will see the new version immediately.`);
        clearAdminSession(ctx);
        return;
      }

      return next();
    } catch (error) {
      logger.error('Admin flow error', { error, flow });
      await ctx.reply('❌ Something went wrong while processing your admin command.');
      clearAdminSession(ctx);
    }
  });
}

module.exports = {
  registerAdminHandlers,
};


