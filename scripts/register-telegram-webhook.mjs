#!/usr/bin/env node
/**
 * Register the Urban Address Telegram webhook.
 *
 * Required environment variables:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_WEBHOOK_SECRET
 *
 * Optional:
 *   TELEGRAM_WEBHOOK_URL (defaults to the production endpoint)
 *
 * Run with Vercel environment variables loaded, for example:
 *   vercel env pull .env.production.local
 *   node --env-file=.env.production.local scripts/register-telegram-webhook.mjs
 *
 * Never pass credentials as command-line arguments or print them to logs.
 */

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const webhookUrl = (process.env.TELEGRAM_WEBHOOK_URL || 'https://www.urbanautoexpress.com/api/telegram/webhook').trim();

function fail(message) {
  console.error(`[telegram-webhook] ${message}`);
  process.exitCode = 1;
}

if (!token) {
  fail('TELEGRAM_BOT_TOKEN is missing. Load it from the Vercel Production environment.');
} else if (!secret || secret.length < 32 || secret.length > 256 || !/^[A-Za-z0-9_-]+$/.test(secret)) {
  fail('TELEGRAM_WEBHOOK_SECRET must be 32–256 characters and contain only letters, numbers, underscores or hyphens.');
} else {
  let parsedUrl;
  try {
    parsedUrl = new URL(webhookUrl);
  } catch {
    fail('TELEGRAM_WEBHOOK_URL is not a valid URL.');
  }

  if (parsedUrl && (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash)) {
    fail('Webhook URL must be HTTPS and must not contain credentials, query parameters or fragments.');
  }

  if (!process.exitCode) {
    const api = `https://api.telegram.org/bot${token}`;
    const request = async (method, body) => {
      const response = await fetch(`${api}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        const description = typeof data?.description === 'string' ? data.description : `HTTP ${response.status}`;
        throw new Error(`${method} failed: ${description}`);
      }
      return data.result;
    };

    try {
      await request('setWebhook', {
        url: webhookUrl,
        secret_token: secret,
        allowed_updates: ['message', 'callback_query'],
        max_connections: 5,
        drop_pending_updates: false,
      });

      await request('setMyCommands', {
        commands: [
          { command: 'start', description: 'Connect to Urban Address operations' },
          { command: 'help', description: 'Show commands available to your role' },
          { command: 'myrole', description: 'View your role and branch access' },
          { command: 'request_refund', description: 'Submit a refund request for approval' },
          { command: 'request_stock_adjustment', description: 'Request an inventory stock change' },
        ],
      });

      const info = await request('getWebhookInfo', {});
      if (info.url !== webhookUrl) {
        throw new Error('Telegram accepted registration but the verified webhook URL does not match.');
      }

      console.log('[telegram-webhook] Registration and command-menu refresh successful.');
      console.log(`[telegram-webhook] URL: ${info.url}`);
      console.log(`[telegram-webhook] Pending updates: ${info.pending_update_count ?? 'unknown'}`);
      if (info.last_error_message) {
        console.warn(`[telegram-webhook] Telegram reports a previous delivery error: ${info.last_error_message}`);
      }
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Unexpected registration failure.');
    }
  }
}
