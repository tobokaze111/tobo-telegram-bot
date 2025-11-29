## Telegram Digital Subscription Vending Bot

Production-grade Telegram bot built with **Node.js + Telegraf + MongoDB (Mongoose)**.

The bot acts as a **Digital Subscription Vending Machine** with:

- **Beautiful premium UI**
- **Wallet system** (Add Funds, Balance, Admin approvals)
- **Inventory & auto-delivery** from stored credentials
- **User order history**
- **Admin panel inside Telegram**
- **Logging and error tracking**

### Folder Structure

```text
/src
  /bot
    main.js
    handlers/
    keyboards/
    middlewares/
    scenes/
  /db
    connect.js
    models/
  /services
    walletService.js
    productService.js
    orderService.js
    adminService.js
  /utils
    logger.js
    helper.js
.env
package.json
```

### Environment Variables

Create an `.env` file in the project root:

```ini
BOT_TOKEN=your_telegram_bot_token_here
MONGODB_URI=mongodb://localhost:27017/telegram_vending_bot
WEBHOOK_URL=https://your-domain.com/telegram/webhook
ADMIN_IDS=123456789,987654321
PORT=3000
```

### Installation

```bash
npm install
```

### Run in Development

```bash
npm run dev
```

### Run in Production

```bash
npm start
```

### Webhook Setup (Telegraf)

1. Make sure your bot is reachable via HTTPS (use a VPS or a tunneling service like `ngrok`).
2. Set the webhook (example using curl):

```bash
curl -F "url=${WEBHOOK_URL}" https://api.telegram.org/bot${BOT_TOKEN}/setWebhook
```

3. Your Express/HTTP server should forward POST requests at `/telegram/webhook` to Telegraf’s `webhookCallback`.

### Features Overview

- **Start / Home Menu**: Browse Services, My Funds, Add Funds, My Orders, Help, Support.
- **Wallet System**: Balance, Add Funds via UPI/QR (admin adjusts balance on approval).
- **Products**: Inventory with credentials; auto-delivery removes used credential and creates order.
- **Admin Panel**: Add product, upload stock, update price, view orders/users, add balance, broadcast.
- **Logging**: Purchases, admin actions, inventory changes, and errors through a centralized logger.

### Notes

- Make sure MongoDB is running and the `MONGODB_URI` is correct.
- Add your Telegram user IDs to `ADMIN_IDS` to access the in-bot admin panel.


