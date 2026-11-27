import { NextRequest, NextResponse } from 'next/server';
import * as admin from '@/lib/db/admin';
import { getAdminApp, getDbAdmin } from '@/lib/db/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROOT_ADMINS = [
  'urbanautoexpressnakuru@gmail.com',
  'urbanaautoexpressnakuru@gmail.com',
  'samuelkarani044@gmail.com',
  'gmaina424@gmail.com',
  'bonfacewana3072@gmail.com',
];

const COMMANDS = [
  { command: 'start', description: 'Connect to Urban Address operations', roles: 'All authorized users' },
  { command: 'help', description: 'Show commands available to your role', roles: 'All authorized users' },
  { command: 'myrole', description: 'View your configured role and branch access', roles: 'All authorized users' },
  { command: 'request_refund', description: 'Submit a paid-order refund request for approval', roles: 'All authorized users' },
  { command: 'request_stock_adjustment', description: 'Request a stock change with manager approval', roles: 'All authorized users' },
  { command: 'dashboard', description: 'Revenue, paid orders, active carwash jobs and low-stock overview', roles: 'Owner · Manager' },
  { command: 'sales', description: 'Today’s sales totals by Lounge, Store and Carwash', roles: 'Owner · Manager' },
  { command: 'inventory', description: 'Items at or below their restock threshold', roles: 'Owner · Manager' },
  { command: 'expenses', description: 'Review and approve or reject petty-cash requests', roles: 'Owner · Manager' },
  { command: 'refunds', description: 'Review and approve or reject refund requests', roles: 'Owner · Manager' },
  { command: 'stock_adjustments', description: 'Review and approve or reject inventory changes', roles: 'Owner · Manager' },
  { command: 'cashier_sessions', description: 'View active cashier sessions and end a session', roles: 'Owner · Manager' },
  { command: 'end_cashier_session', description: 'Close a register session remotely', roles: 'Owner · Manager' },
  { command: 'reconcile_shift', description: 'Close and reconcile cash for a register session', roles: 'Owner' },
  { command: 'reconciliations', description: 'View recent cash variance reports', roles: 'Owner · Manager' },
  { command: 'lock_station', description: 'Lock a POS station after confirmation', roles: 'Owner' },
  { command: 'unlock_station', description: 'Unlock a POS station after confirmation', roles: 'Owner' },
  { command: 'incidents', description: 'Review, acknowledge and resolve incidents', roles: 'Owner · Manager' },
  { command: 'raise_incident', description: 'Report an operational incident', roles: 'Owner · Manager' },
  { command: 'emergency_alert', description: 'Broadcast a critical emergency alert', roles: 'Owner' },
  { command: 'branches', description: 'View the branch directory', roles: 'Owner · Manager' },
  { command: 'shifts', description: 'View recent register sessions', roles: 'Owner · Manager' },
  { command: 'station_sales', description: 'Sales totals by POS station for the last 15 minutes', roles: 'Owner · Manager' },
  { command: 'cashier_report', description: 'Cashier analytics for the last hour', roles: 'Owner · Manager' },
  { command: 'top_items', description: 'Top 10 items sold in the last 12 hours', roles: 'Owner · Manager' },
  { command: 'summary', description: 'Combined daily operations and sales summary', roles: 'Owner · Manager' },
  { command: 'lock_terminal', description: 'Disable a POS terminal', roles: 'Owner' },
  { command: 'unlock_terminal', description: 'Re-enable a POS terminal', roles: 'Owner' },
  { command: 'emergency_lockdown', description: 'Disable remote Telegram administration', roles: 'Owner' },
  { command: 'unlock_remote_admin', description: 'Restore remote Telegram administration', roles: 'Owner' },
  { command: 'online', description: 'Live customers, staff and administrators', roles: 'Owner' },
  { command: 'jobs', description: 'Active carwash jobs', roles: 'Owner' },
  { command: 'attendants', description: 'Attendant performance', roles: 'Owner' },
  { command: 'payments', description: 'Recent payment status overview', roles: 'Owner' },
  { command: 'alerts', description: 'Security and operations alerts', roles: 'Owner' },
  { command: 'health', description: 'Application and integration health', roles: 'Owner' },
];

async function authorize(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    const decoded = await admin.auth(getAdminApp()).verifyIdToken(token);
    const email = String(decoded.email || '').trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    if (!ROOT_ADMINS.includes(email) || decoded.adminOtpVerifiedDate !== today) return null;
    return { uid: decoded.uid, email };
  } catch { return null; }
}

async function telegram(method: 'getMe' | 'getWebhookInfo') {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error(body?.description || `Telegram API returned HTTP ${response.status}.`);
  return body.result;
}

export async function GET(request: NextRequest) {
  if (!await authorize(request)) return NextResponse.json({ error: 'Verified owner access is required.' }, { status: 403 });

  const tokenConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
  const secretConfigured = Boolean(process.env.TELEGRAM_WEBHOOK_SECRET?.trim() && (process.env.TELEGRAM_WEBHOOK_SECRET?.trim().length || 0) >= 32);
  const access = (() => {
    const parsed: Record<string, {role?: string; enabled?: boolean}> = {};
    try {
      const raw = JSON.parse(process.env.TELEGRAM_USER_ACCESS || '{}') as Record<string, {role?: string}> | null;
      const env = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
      for (const [id, value] of Object.entries(env)) parsed[id] = value;
    } catch { /* legacy environment list is optional */ }
    const ownerIds = String(process.env.OWNER_TELEGRAM_IDS || '').split(/[;,\s]+/).map(id => id.trim()).filter(id => /^\d{1,20}$/.test(id));
    for (const id of ownerIds) parsed[id] = { role: 'OWNER' };
    return parsed;
  })();


  const [botResult, webhookResult, activityResult, auditResult] = await Promise.allSettled([
    tokenConfigured ? telegram('getMe') : Promise.reject(new Error('Bot token is not configured.')),
    tokenConfigured ? telegram('getWebhookInfo') : Promise.reject(new Error('Bot token is not configured.')),
    getDbAdmin().collection('telegram_updates').orderBy('receivedAt', 'desc').limit(8).get(),
    getDbAdmin().collection('system_audit_logs').orderBy('createdAt', 'desc').limit(30).get(),
  ]);

  const dbAccessResult = await getDbAdmin().collection('telegram_user_access').get().catch(() => null);
  if (dbAccessResult) for (const doc of dbAccessResult.docs) {
    const value = doc.data();
    if (value.enabled === false) delete access[doc.id];
    else access[doc.id] = { role: String(value.role || '').toUpperCase() };
  }
  const roles = Object.values(access).map(value => String(value.role || '').toUpperCase());
  const accessCounts = {
    total: roles.filter(role => ['OWNER','MANAGER','STAFF'].includes(role)).length,
    owners: roles.filter(role => role === 'OWNER').length,
    managers: roles.filter(role => role === 'MANAGER').length,
    staff: roles.filter(role => role === 'STAFF').length,
  };

  const bot = botResult.status === 'fulfilled' ? {
    id: Number(botResult.value.id),
    firstName: String(botResult.value.first_name || ''),
    username: String(botResult.value.username || ''),
    canJoinGroups: Boolean(botResult.value.can_join_groups),
  } : null;
  const webhook = webhookResult.status === 'fulfilled' ? {
    url: String(webhookResult.value.url || ''),
    pendingUpdateCount: Number(webhookResult.value.pending_update_count || 0),
    lastErrorDate: webhookResult.value.last_error_date ? Number(webhookResult.value.last_error_date) : null,
    lastErrorMessage: webhookResult.value.last_error_message ? String(webhookResult.value.last_error_message) : null,
    maxConnections: Number(webhookResult.value.max_connections || 0),
  } : null;

  const activity = activityResult.status === 'fulfilled' ? activityResult.value.docs.map(doc => {
    const value = doc.data();
    return {
      id: doc.id,
      status: String(value.status || 'UNKNOWN'),
      receivedAt: Number(value.receivedAt || 0) || undefined,
      completedAt: Number(value.completedAt || 0) || undefined,
      failedAt: Number(value.failedAt || 0) || undefined,
      lastError: value.lastError ? String(value.lastError).slice(0, 240) : undefined,
    };
  }) : [];
  const audit = auditResult.status === 'fulfilled' ? auditResult.value.docs.filter(doc => doc.data().action === 'TELEGRAM_WEBHOOK_REGISTERED').slice(0, 8).map(doc => {
    const value = doc.data();
    return {
      id: doc.id,
      action: String(value.action || 'TELEGRAM_EVENT'),
      createdAt: Number(value.createdAt || 0) || undefined,
      actorEmail: value.actorEmail ? String(value.actorEmail) : undefined,
      webhookUrl: value.webhookUrl ? String(value.webhookUrl) : undefined,
    };
  }) : [];

  const mpesaRequired = ['MPESA_CONSUMER_KEY','MPESA_CONSUMER_SECRET','MPESA_SHORTCODE','MPESA_PASSKEY'];
  const mpesaMissing = mpesaRequired.filter(key => !process.env[key]?.trim());
  if (!process.env.MPESA_CALLBACK_URL?.trim() && !process.env.APP_BASE_URL?.trim() && !process.env.NEXT_PUBLIC_APP_URL?.trim() && !process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()) mpesaMissing.push('MPESA_CALLBACK_URL or APP_BASE_URL');
  const mpesa = {
    configured: mpesaMissing.length === 0,
    environment: process.env.MPESA_ENV === 'production' ? 'production' : process.env.MPESA_ENV === 'sandbox' ? 'sandbox' : 'sandbox (default)',
    missing: mpesaMissing,
  };
  const maps = { configured: true, provider: 'OpenStreetMap tiles + Nominatim geocoding', apiKeyRequired: false };

  return NextResponse.json({
    bot,
    webhook,
    mpesa,
    maps,
    access: accessCounts,
    commands: COMMANDS,
    activity,
    audit,
    configured: { token: tokenConfigured, secret: secretConfigured },
    errors: {
      ...(botResult.status === 'rejected' ? { bot: botResult.reason instanceof Error ? botResult.reason.message : 'Unable to verify bot identity.' } : {}),
      ...(webhookResult.status === 'rejected' ? { webhook: webhookResult.reason instanceof Error ? webhookResult.reason.message : 'Unable to verify webhook.' } : {}),
    },
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
