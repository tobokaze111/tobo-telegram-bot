const { getBalance } = require('../../services/walletService');
const { formatCurrency } = require('../../utils/helper');
const { logger } = require('../../utils/logger');
const { Markup } = require('telegraf');
const { getSetting } = require('../../services/settingsService');
const { createPaymentRequest } = require('../../services/paymentService');
const path = require('path');
const fs = require('fs');

function walletBackKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'HOME')]]);
}

// Store payment flow state
const paymentFlows = new Map();

let botInstance = null;

function registerWalletHandlers(bot) {
  botInstance = bot; // Store bot instance for notifications
  bot.action('MY_FUNDS', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = String(ctx.from.id);
      const balance = await getBalance(telegramId);
      const base = await getSetting(
        'wallet_text',
        '💰 **My Wallet**\n\nCurrent Balance: *{{balance}}*\n\nUse **Add Funds** to top up your wallet.'
      );
      const text = base.replace('{{balance}}', formatCurrency(balance));
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...walletBackKeyboard(),
      });
    } catch (error) {
      logger.error('Error in MY_FUNDS', { error });
      await ctx.reply('Unable to fetch wallet balance right now.');
    }
  });

  bot.action('ADD_FUNDS', async (ctx) => {
    await ctx.answerCbQuery();
    
    const UPI_ID = 'jainabbibi395075@rxairtel';
    
    // Try to send QR code image if it exists
    const qrPath = path.join(__dirname, '../../assets/qr-code.png');
    let hasQR = false;
    
    try {
      if (fs.existsSync(qrPath)) {
        await ctx.replyWithPhoto({ source: qrPath }, {
          caption: `📱 **Scan QR to Pay**\n\n💳 UPI ID: \`${UPI_ID}\``,
          parse_mode: 'Markdown',
        });
        hasQR = true;
      }
    } catch (err) {
      logger.warn('QR code not found or error sending', { error: err.message });
    }

    const text = await getSetting(
      'add_funds_text',
      '➕ **Add Funds**\n\n' +
      `💳 **UPI ID:** \`${UPI_ID}\`\n\n` +
      '1. Scan the QR code above (or send money to UPI ID)\n' +
      '2. After payment, tap **Submit Payment** below\n' +
      '3. Send your Transaction ID and payment screenshot\n' +
      '4. Admin will verify and credit your wallet\n\n' +
      '💡 Make sure to include the correct Transaction ID.'
    );

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('💳 Submit Payment', 'SUBMIT_PAYMENT')],
      [Markup.button.callback('⬅️ Back', 'HOME')],
    ]);

    if (hasQR) {
      await ctx.replyWithMarkdown(text, keyboard);
    } else {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    }
  });

  // Submit payment button
  bot.action('SUBMIT_PAYMENT', async (ctx) => {
    await ctx.answerCbQuery();
    const key = String(ctx.from.id);
    paymentFlows.set(key, { step: 'WAIT_AMOUNT' });
    
    await ctx.reply(
      '💳 **Submit Payment**\n\n' +
      'Step 1: Send the payment amount (number only)\n\n' +
      'Example: `199`',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancel', 'CANCEL_PAYMENT')],
        ]),
      }
    );
  });

  // Skip screenshot
  bot.action('SKIP_SCREENSHOT', async (ctx) => {
    await ctx.answerCbQuery();
    const key = String(ctx.from.id);
    const flow = paymentFlows.get(key);
    if (flow && flow.step === 'WAIT_SCREENSHOT') {
      await finalizePayment(ctx, flow.amount, flow.transactionId, '');
      paymentFlows.delete(key);
    }
  });

  // Cancel payment
  bot.action('CANCEL_PAYMENT', async (ctx) => {
    await ctx.answerCbQuery();
    paymentFlows.delete(String(ctx.from.id));
    await ctx.reply('❌ Payment submission cancelled.');
  });

  // Handle payment submission flow
  bot.on('message', async (ctx, next) => {
    const key = String(ctx.from.id);
    const flow = paymentFlows.get(key);
    if (!flow) return next();

    try {
      // Step 1: Get amount
      if (flow.step === 'WAIT_AMOUNT') {
        const amount = Number(ctx.message.text);
        if (isNaN(amount) || amount <= 0) {
          await ctx.reply('❌ Invalid amount. Please send a valid number (e.g., 199)');
          return;
        }
        paymentFlows.set(key, { step: 'WAIT_TRANSACTION_ID', amount });
        await ctx.reply(
          '✅ Amount: ' + formatCurrency(amount) + '\n\n' +
          'Step 2: Send your **Transaction ID** (UPI Transaction ID)\n\n' +
          'Example: `UPI1234567890`',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('❌ Cancel', 'CANCEL_PAYMENT')],
            ]),
          }
        );
        return;
      }

      // Step 2: Get transaction ID
      if (flow.step === 'WAIT_TRANSACTION_ID') {
        const transactionId = ctx.message.text.trim();
        if (!transactionId) {
          await ctx.reply('❌ Transaction ID cannot be empty.');
          return;
        }
        paymentFlows.set(key, { 
          step: 'WAIT_SCREENSHOT', 
          amount: flow.amount, 
          transactionId 
        });
        await ctx.reply(
          '✅ Transaction ID: `' + transactionId + '`\n\n' +
          'Step 3: Send your **payment screenshot** (photo)\n\n' +
          'Or tap "Skip" to continue without screenshot.',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('⏭️ Skip Screenshot', 'SKIP_SCREENSHOT')],
              [Markup.button.callback('❌ Cancel', 'CANCEL_PAYMENT')],
            ]),
          }
        );
        return;
      }

      // Step 3: Get screenshot (handled in photo handler)
      if (flow.step === 'WAIT_SCREENSHOT') {
        // If text message, check if it's "skip" (still support typing for backward compatibility)
        if (ctx.message.text && ctx.message.text.toLowerCase().trim() === 'skip') {
          await finalizePayment(ctx, flow.amount, flow.transactionId, '');
          paymentFlows.delete(key);
        } else {
          await ctx.reply(
            'Please send a photo or tap "Skip" button to continue without screenshot.',
            Markup.inlineKeyboard([
              [Markup.button.callback('⏭️ Skip Screenshot', 'SKIP_SCREENSHOT')],
              [Markup.button.callback('❌ Cancel', 'CANCEL_PAYMENT')],
            ])
          );
        }
        return;
      }

      return next();
    } catch (error) {
      logger.error('Payment flow error', { error, flow });
      await ctx.reply('❌ An error occurred. Please try again.');
      paymentFlows.delete(key);
    }
  });

  // Handle photo for payment screenshot
  bot.on('photo', async (ctx, next) => {
    const key = String(ctx.from.id);
    const flow = paymentFlows.get(key);
    if (!flow || flow.step !== 'WAIT_SCREENSHOT') {
      return next();
    }

    try {
      // Check if photo exists
      if (!ctx.message.photo || ctx.message.photo.length === 0) {
        await ctx.reply('❌ No photo received. Please try again.');
        return;
      }

      // Get largest photo (last in array is usually the largest)
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      if (!photo || !photo.file_id) {
        await ctx.reply('❌ Invalid photo. Please try again.');
        return;
      }

      const fileId = photo.file_id;
      await finalizePayment(ctx, flow.amount, flow.transactionId, fileId);
      paymentFlows.delete(key);
    } catch (error) {
      logger.error('Error processing payment photo', { error, stack: error.stack });
      await ctx.reply(
        '❌ Error processing screenshot: ' + (error.message || 'Unknown error') + '\n\nPlease try again or contact support.',
        Markup.inlineKeyboard([
          [Markup.button.callback('⏭️ Skip Screenshot', 'SKIP_SCREENSHOT')],
          [Markup.button.callback('❌ Cancel', 'CANCEL_PAYMENT')],
        ])
      );
      // Don't delete the flow, let user retry or skip
    }
  });

  async function finalizePayment(ctx, amount, transactionId, screenshot) {
    try {
      const payment = await createPaymentRequest({
        telegramId: String(ctx.from.id),
        amount,
        transactionId,
        screenshot: screenshot || '',
      });

      // Notify all admins about new payment
      const adminIds = (process.env.ADMIN_IDS || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);

      const userName = ctx.from.first_name || 'User';
      const username = ctx.from.username ? `@${ctx.from.username}` : 'No username';
      const userId = ctx.from.id;

      const adminNotification = 
        '⏳ **Payment Confirmation Pending**\n\n' +
        'A new customer sent payment:\n\n' +
        `👤 User: ${userName} (${username})\n` +
        `🆔 ID: \`${userId}\`\n` +
        `💰 Amount: ${formatCurrency(amount)}\n` +
        `📝 Transaction ID: \`${transactionId}\`\n` +
        `📋 Payment ID: \`${payment._id}\`\n` +
        (screenshot ? '📸 Screenshot: Yes\n' : '📸 Screenshot: No\n') +
        `\nStatus: ⏳ Pending verification`;

      for (const adminId of adminIds) {
        try {
          const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('✅ Approve & Credit', `APPROVE_PAYMENT_${payment._id}`)],
            [Markup.button.callback('❌ Reject', `REJECT_PAYMENT_${payment._id}`)],
            [Markup.button.callback('📋 View Details', `PAYMENT_${payment._id}`)],
          ]);

          if (screenshot) {
            await botInstance.telegram.sendPhoto(adminId, screenshot, {
              caption: adminNotification,
              parse_mode: 'Markdown',
              ...keyboard,
            });
          } else {
            await botInstance.telegram.sendMessage(adminId, adminNotification, {
              parse_mode: 'Markdown',
              ...keyboard,
            });
          }
        } catch (err) {
          logger.error('Failed to notify admin of new payment', { adminId, error: err });
        }
      }

      let confirmationText = 
        '✅ **Payment Submitted!**\n\n' +
        `Amount: ${formatCurrency(amount)}\n` +
        `Transaction ID: \`${transactionId}\`\n` +
        `Status: ⏳ Pending\n\n` +
        'An admin will verify your payment and credit your wallet shortly.\n' +
        'You will be notified when the payment is approved.';

      if (screenshot) {
        confirmationText += '\n\n📸 Screenshot received.';
      }

      await ctx.reply(confirmationText, {
        parse_mode: 'Markdown',
        ...walletBackKeyboard(),
      });
    } catch (error) {
      logger.error('Error creating payment request', { error, stack: error.stack });
      const errorMsg = error.message || 'Unknown error';
      await ctx.reply(
        `❌ Failed to submit payment: ${errorMsg}\n\nPlease try again or contact support.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Back to Home', 'HOME')],
        ])
      );
      throw error; // Re-throw so caller knows it failed
    }
  }
}

module.exports = {
  registerWalletHandlers,
};


