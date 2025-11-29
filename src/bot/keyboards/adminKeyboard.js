const { Markup } = require('telegraf');

function getAdminMainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('➕ Add Product', 'ADMIN_ADD_PRODUCT')],
    [Markup.button.callback('📥 Add Stock', 'ADMIN_ADD_STOCK')],
    [Markup.button.callback('💲 Update Price', 'ADMIN_UPDATE_PRICE')],
    [Markup.button.callback('📋 View Products', 'ADMIN_VIEW_PRODUCTS')],
    [
      Markup.button.callback('📦 View Orders', 'ADMIN_VIEW_ORDERS'),
      Markup.button.callback('👥 View Users', 'ADMIN_VIEW_USERS'),
    ],
    [Markup.button.callback('💳 View Payments', 'ADMIN_VIEW_PAYMENTS')],
    [Markup.button.callback('💰 Add Balance to User', 'ADMIN_ADD_BALANCE')],
    [Markup.button.callback('📢 Broadcast Message', 'ADMIN_BROADCAST')],
    [Markup.button.callback('📝 Edit Texts', 'ADMIN_EDIT_TEXTS')],
    [Markup.button.callback('⬅️ Back to Home', 'HOME')],
  ]);
}

function getEditTextsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🏠 Home Screen', 'ADMIN_EDIT_HOME_TEXT')],
    [Markup.button.callback('📂 Services (No Products)', 'ADMIN_EDIT_SERVICES_EMPTY_TEXT')],
    [Markup.button.callback('💰 My Wallet', 'ADMIN_EDIT_WALLET_TEXT')],
    [Markup.button.callback('➕ Add Funds', 'ADMIN_EDIT_ADD_FUNDS_TEXT')],
    [Markup.button.callback('📦 Orders (Empty)', 'ADMIN_EDIT_ORDERS_EMPTY_TEXT')],
    [Markup.button.callback('❓ Help', 'ADMIN_EDIT_HELP_TEXT')],
    [Markup.button.callback('👨‍💻 Support', 'ADMIN_EDIT_SUPPORT_TEXT')],
    [Markup.button.callback('⬅️ Back to Admin', 'ADMIN_PANEL')],
  ]);
}

module.exports = {
  getAdminMainKeyboard,
  getEditTextsKeyboard,
};



