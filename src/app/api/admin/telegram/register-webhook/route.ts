import { NextRequest, NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/db/admin';
import { authorizeAdminRequest } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

// Keep the Telegram webhook on the custom domain already configured by the owner.
const WEBHOOK_URL = 'https://www.urbanautoexpress.com/api/telegram/webhook';
const BOT_MENU_COMMANDS = [
  { command: 'start', description: 'Connect to Urban Address operations' },
  { command: 'help', description: 'Show commands available to your role' },
  { command: 'myrole', description: 'View your role and branch access' },
  { command: 'request_refund', description: 'Submit a refund request for approval' },
  { command: 'request_stock_adjustment', description: 'Request an inventory stock change' },
];

async function authorizeOwner(request: NextRequest) {
  const caller = await authorizeAdminRequest(request);
  return caller ? { uid: caller.uid, email: caller.email } : null;
}

export async function POST(request: NextRequest) {
  const owner = await authorizeOwner(request);
  if (!owner) {
    return NextResponse.json(
      { error: 'Verified owner access is required.' },
      { status: 403 },
    );
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  if (!token || !secret || secret.length < 32 || secret.length > 256 ||
      !/^[A-Za-z0-9_-]+$/.test(secret)) {
    return NextResponse.json(
      { error: 'Telegram bot credentials are not configured correctly in Vercel.' },
      { status: 503 },
    );
  }

  const api = `https://api.telegram.org/bot${token}`;
  const telegramRequest = async (method: 'setWebhook' | 'getWebhookInfo' | 'setMyCommands', body: Record<string, unknown>) => {
    const response = await fetch(`${api}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      throw new Error(typeof data?.description === 'string'
        ? data.description
        : `Telegram API returned HTTP ${response.status}.`);
    }
    return data.result;
  };

  try {
    await telegramRequest('setWebhook', {
      url: WEBHOOK_URL,
      secret_token: secret,
      allowed_updates: ['message', 'callback_query'],
      // Keep delivery concurrency below the serverless webhook's safe processing capacity.
      max_connections: 5,
      drop_pending_updates: false,
    });

    // Keep the default Telegram command menu appropriate for every authorized role.
    // Management-only commands remain available through the role-aware /help response.
    await telegramRequest('setMyCommands', { commands: BOT_MENU_COMMANDS });
    const info = await telegramRequest('getWebhookInfo', {});
    if (info.url !== WEBHOOK_URL) {
      throw new Error('Telegram accepted the request, but the registered webhook URL did not match.');
    }

    const db = getDbAdmin();
    await db.collection('system_audit_logs').add({
      action: 'TELEGRAM_WEBHOOK_REGISTERED',
      actorUid: owner.uid,
      actorEmail: owner.email,
      webhookUrl: WEBHOOK_URL,
      pendingUpdateCount: Number(info.pending_update_count || 0),
      createdAt: Date.now(),
      source: 'vercel-owner-endpoint',
    });

    return NextResponse.json({
      ok: true,
      message: 'Telegram webhook registered, verified and command menu refreshed.',
      commandsRegistered: true,
      webhookUrl: WEBHOOK_URL,
      pendingUpdateCount: Number(info.pending_update_count || 0),
      lastErrorDate: info.last_error_date || null,
      lastErrorMessage: info.last_error_message || null,
    });
  } catch (error) {
    console.error('[TELEGRAM_WEBHOOK_REGISTRATION]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook registration failed.' },
      { status: 502 },
    );
  }
}
