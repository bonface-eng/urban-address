# URBAN EXPRESS | Telegram Management Bot

The Telegram Management Bot is a high-fidelity extension of the Urban Express Business OS. it provides the owner and authorized managers with real-time access to the master ledger, inventory telemetry, and financial approval queues directly from Telegram.

## 1. Core Commands

All commands are case-insensitive and require prior Telegram ID authorization.

| Command | Function | Data Node Accessed |
| :--- | :--- | :--- |
| `/start` | Initial Handshake | Authentication verification & available module list. |
| `/dashboard` | Operational Summary | Total sales, active carwash jobs, and low stock count. |
| `/sales` | Revenue Breakdown | Departmental totals (Lounge, Retail, Carwash). |
| `/inventory` | Low Stock Alerts | Critical reorder list (excludes Carwash services). |
| `/expenses` | Treasury Queue | Pending petty cash requests awaiting authorization. |
| `/help` | Command Reference | Displays this list of available neural routines. |

## 2. Security & Authorization

The bot operates on a **Zero-Trust** model. Knowing the bot's username does not grant access to business intelligence.

### 2.1 Authorized ID Whitelist
Access is restricted via the `OWNER_TELEGRAM_IDS` variable in your `.env` file. 
- **Format**: `12345678,87654321` (Comma-separated numeric IDs).
- **Discovery**: To find your numeric ID, message `@userinfobot` on Telegram.

### 2.2 Webhook Integrity
Communication between Telegram and your Business OS is secured via a **Secret Token**.
- Your secret token is defined in your `.env` file as `TELEGRAM_WEBHOOK_SECRET`.
- This token is verified on every incoming request to prevent unauthorized spoofing.

## 3. Activation (How to add the Webhook)

To connect Telegram to your Business OS, you must send a request to Telegram's `setWebhook` API. You can do this by pasting the following URL into your web browser (replace the bracketed values with your actual data):

### 3.1 Browser Method (Easiest)
Copy and paste this into your browser:

`https://api.telegram.org/bot[YOUR_BOT_TOKEN]/setWebhook?url=https://[YOUR_DOMAIN]/api/telegram/webhook&secret_token=[YOUR_WEBHOOK_SECRET]`

**Example for Urban Auto Express:**
`https://api.telegram.org/bot8891377237:AAGCcghBfdf3UkV-nhLc9kbaB7tX1drRkr4/setWebhook?url=https://www.urbanautoexpress.com/api/telegram/webhook&secret_token=yJv_m3r9P4fK7L2zN1sC5vM4jG0dF2tY6pQ8uK3aB5i1`

### 3.2 Verification
After navigating to that URL, you should receive a JSON response from Telegram:
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

## 4. Troubleshooting

- **"Neural Link Failure"**: Check if the `FIREBASE_SERVICE_ACCOUNT_KEY` is correctly populated in your environment.
- **Unauthorized Alert**: Ensure your numeric Telegram ID is present in the `OWNER_TELEGRAM_IDS` list and that the server has been restarted.
- **No Response**: Verify that the webhook URL is correctly registered and using `https`. Telegram will not deliver messages to non-secure `http` endpoints.

---
*Urban Express Engineering | Strategic Intelligence Hub*