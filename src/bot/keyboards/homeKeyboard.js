const { Markup } = require('telegraf');
const { isAdmin } = require('../../utils/helper');

function getHomeKeyboard(ctx) {
  const rows = [
    [
      Markup.button.callback('📂 Browse Services', 'BROWSE_SERVICES'),
    ],
    [
      Markup.button.callback('💰 My Funds', 'MY_FUNDS'),
      Markup.button.callback('➕ Add Funds', 'ADD_FUNDS'),
    ],
    [
      Markup.button.callback('📦 My Orders', 'MY_ORDERS'),
    ],
    [
      Markup.button.callback('❓ Help', 'HELP'),
      Markup.button.callback('👨‍💻 Support', 'SUPPORT'),
    ],
  ];

  if (ctx && isAdmin(ctx.from.id)) {
    rows.push([
      Markup.button.callback('🛠 Admin Panel', 'ADMIN_PANEL'),
    ]);
  }

  return Markup.inlineKeyboard(rows);
}

module.exports = {
  getHomeKeyboard,
};


