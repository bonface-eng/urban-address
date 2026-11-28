import { NextRequest, NextResponse } from 'next/server';
import * as admin from '@/lib/db/admin';
import crypto from 'crypto';
import { getAdminApp, getDbAdmin } from '@/lib/db/admin';
import { bot } from '@/lib/telegram/bot';
import { Markup } from 'telegraf';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES = ['SIGNUP','SIGNIN','FAILED_SIGNIN','CARWASH_NEW','CARWASH_STATUS','CARWASH_ASSIGNED','CARWASH_COMPLETED','STOCK_ADJUSTMENT','STOCK_LOW','EMPLOYEE_CREATED','EMPLOYEE_ROLE_CHANGED','PAYMENT_FAILED','PAYMENT_RECONCILIATION','REFUND','EXPENSE_CREATED','EXPENSE_DECIDED','ADMIN_CRUD','ACCESS_CHANGE','SUSPICIOUS_ACTIVITY'] as const;
type EventType = typeof TYPES[number];
type Recipient = { role: string; branchIds: string[] };
const clean = (value: unknown, max = 100) => String(value ?? '').replace(/[<>\r\n]/g, ' ').trim().slice(0, max);
const money = (value: unknown) => Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 });

async function sendToManagement(message: string, eventId: string, branchId?: string, replyMarkup?: any) {
  const db = getDbAdmin();
  const access = new Map<string, Recipient>();
  try {
    const env = JSON.parse(process.env.TELEGRAM_USER_ACCESS || '{}') as Record<string, {role?: string; branchIds?: string[]}>;
    for (const [id, value] of Object.entries(env)) {
      const role = String(value.role || '').toUpperCase();
      if (/^\d{1,20}$/.test(id) && ['OWNER','MANAGER'].includes(role)) access.set(id, { role, branchIds: Array.isArray(value.branchIds) ? value.branchIds.filter(x => typeof x === 'string') : [] });
    }
  } catch { logger.error('Invalid Telegram access configuration'); }
  String(process.env.OWNER_TELEGRAM_IDS || '').split(/[;,\s]+/).filter(id => /^\d{1,20}$/.test(id)).forEach(id => access.set(id, { role: 'OWNER', branchIds: [] }));
  const dbUsers = await db.collection('telegram_user_access').get();
  for (const doc of dbUsers.docs) {
    const data = doc.data();
    if (data.enabled === false) { access.delete(doc.id); continue; }
    const role = String(data.role || '').toUpperCase();
    if (['OWNER','MANAGER'].includes(role)) access.set(doc.id, { role, branchIds: Array.isArray(data.branchIds) ? data.branchIds.filter((v: unknown) => typeof v === 'string') : [] });
  }
  const targets = [...access.entries()]
    .filter(([, value]) => value.role === 'OWNER' || (!!branchId && (value.branchIds.length === 0 || value.branchIds.includes(branchId))))
    .map(([id]) => id);
  if (!targets.length || !process.env.TELEGRAM_BOT_TOKEN) {
    logger.warn('Telegram event skipped: bot token or management recipients not configured.', { eventId });
    return;
  }
  const marker = db.collection('telegram_event_deliveries').doc(eventId);
  const claimed = await db.runTransaction(async tx => {
    const snap = await tx.get(marker);
    if (snap.exists && snap.data()?.status === 'SENT') return false;
    const state = snap.data() || {};
    if (state.status === 'PROCESSING' && Number(state.leaseUntil || 0) > Date.now()) return false;
    tx.set(marker, { status: 'PROCESSING', leaseUntil: Date.now() + 45_000, attempts: Number(state.attempts || 0) + 1, createdAt: Number(state.createdAt || Date.now()) }, { merge: true });
    return true;
  });
  if (!claimed) return;
  const results = await Promise.allSettled(targets.map(id => bot.telegram.sendMessage(id, message, replyMarkup ? { reply_markup: replyMarkup } : undefined)));
  const failed = results.filter(result => result.status === 'rejected').length;
  await marker.set({ status: failed ? 'PARTIAL' : 'SENT', sent: results.length - failed, failed, leaseUntil: null, updatedAt: Date.now() }, { merge: true });
  if (failed) logger.warn('Telegram event alert partially delivered', { eventId, failed });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const type = String(body?.type || '') as EventType;
    if (!TYPES.includes(type)) return NextResponse.json({ error: 'Unsupported event.' }, { status: 400 });
    const db = getDbAdmin();
    let uid = '';
    let actor = 'Unknown account';
    if (type === 'FAILED_SIGNIN') {
      const email = clean(body.email, 254).toLowerCase();
      if (!email || !email.includes('@')) return NextResponse.json({ ok: true });
      const digest = crypto.createHash('sha256').update(email).digest('hex');
      await sendToManagement(
        `SECURITY ALERT | Failed sign-in\nUnsuccessful authentication attempt.`,
        `failed-login-${digest}-${Date.now()}`
      );
      return NextResponse.json({ ok: true });
    }
    const header = request.headers.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const decoded = await admin.auth(getAdminApp()).verifyIdToken(token);
    uid = decoded.uid;
    const profile = await db.collection('users').doc(uid).get();
    const profileData = profile.data() || {};
    actor = clean(profileData.displayName || decoded.name || decoded.email || uid, 80);
    const sensitiveTypes: EventType[] = ['PAYMENT_FAILED','PAYMENT_RECONCILIATION','REFUND','EXPENSE_DECIDED','ADMIN_CRUD','ACCESS_CHANGE','EMPLOYEE_CREATED','EMPLOYEE_ROLE_CHANGED','SUSPICIOUS_ACTIVITY'];
    if (sensitiveTypes.includes(type)) {
      const email = String(decoded.email || '').toLowerCase().trim();
      const adminRecord = email ? await db.collection('admins').doc(email).get() : null;
      const role = String(profileData.role || '').toUpperCase();
      const rootAdmins = ['gackstoneb@gmail.com','bonfacewana3072@gmail.com','urbanautoexpressnakuru@gmail.com','urbanaautoexpressnakuru@gmail.com','samuelkarani044@gmail.com','gmaina424@gmail.com'];
      const privileged = ['ADMIN','OWNER','SUPER_ADMIN','MANAGER'].includes(role) || !!adminRecord?.exists || rootAdmins.includes(email);
      if (!privileged) return NextResponse.json({ error: 'Administrator authorization required for this event.' }, { status: 403 });
    }
    if (type === 'EXPENSE_CREATED') {
      const role = String(profileData.role || '').toUpperCase();
      if (!['ADMIN','MANAGER','SUPERVISOR','CASHIER','STOREKEEPER','ATTENDANT'].includes(role)) return NextResponse.json({ error: 'Active staff access is required to submit an expense alert.' }, { status: 403 });
      const requestId = clean(body.reference, 40);
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(requestId)) return NextResponse.json({ error: 'Invalid expense reference.' }, { status: 400 });
      const expense = requestId ? await db.collection('petty_cash').doc(requestId).get() : null;
      if (!expense?.exists || expense.data()?.requesterId !== uid || expense.data()?.status !== 'PENDING') return NextResponse.json({ error: 'The pending expense request could not be verified.' }, { status: 409 });
      const verifiedExpense = expense.data()!;
      body.amount = Number(verifiedExpense.amount || 0);
      body.reason = String(verifiedExpense.reason || '');
      body.branchId = String(verifiedExpense.branchId || '');
    }
    const eventId = crypto.createHash('sha256').update(JSON.stringify({ uid, type, body, minute: Math.floor(Date.now()/60000) })).digest('hex');
    const timestamp = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
    let message = '';
    let replyMarkup: any = undefined;
    switch (type) {
      case 'SIGNUP': message = `🆕 NEW ACCOUNT SIGNUP\nName: ${clean(body.name || actor)}\nAccount: ${clean(decoded.email || 'Email unavailable')}\nTime: ${timestamp}`; break;
      case 'SIGNIN': message = `🔐 SUCCESSFUL SIGN-IN\nName: ${actor}\nAccount: ${clean(decoded.email || 'Email unavailable')}\nMethod: ${clean(body.method || 'Unknown')}\nTime: ${timestamp}`; break;
      case 'CARWASH_NEW': message = `🚘 NEW CARWASH JOB\nJob: ${clean(body.jobId)}\nVehicle: ${clean(body.plate || 'Not recorded')}\nService: ${clean(body.service || 'Not recorded')}\nAttendant: ${clean(body.attendant || 'Unassigned')}\nAmount: KES ${money(body.amount)}\nCreated by: ${actor}`; break;
      case 'CARWASH_STATUS': message = `🔄 CARWASH JOB STATUS UPDATE\nJob: ${clean(body.jobId)}\nVehicle: ${clean(body.plate || 'Not recorded')}\nStatus: ${clean(body.status)}\nAttendant: ${clean(body.attendant || 'Not recorded')}\nUpdated by: ${actor}`; break;
      case 'CARWASH_ASSIGNED': message = `👷 ATTENDANT ASSIGNED\nJob: ${clean(body.jobId)}\nVehicle: ${clean(body.plate)}\nAttendant: ${clean(body.attendant)}\nAssigned by: ${actor}`; break;
      case 'CARWASH_COMPLETED': message = `✅ CARWASH JOB COMPLETED\nJob: ${clean(body.jobId)}\nVehicle: ${clean(body.plate)}\nAttendant: ${clean(body.attendant)}\nAmount: KES ${money(body.amount)}\nCompleted by: ${actor}`; break;
      case 'STOCK_ADJUSTMENT': message = `📦 INVENTORY STOCK ADJUSTMENT\nItem: ${clean(body.item)}\nStock: ${Number(body.before) || 0} → ${Number(body.after) || 0}\nMinimum: ${Number(body.minimum) || 0}\nUnit: ${clean(body.unit)}\nBy: ${actor}`; break;
      case 'STOCK_LOW': message = `⚠️ LOW STOCK ALERT\nItem: ${clean(body.item)}\nAvailable: ${clean(body.quantity)}\nReorder level: ${clean(body.minimum)}\nBranch: ${clean(body.branchId)}`; break;
      case 'EMPLOYEE_CREATED': message = `👤 NEW STAFF ACCOUNT\nName: ${clean(body.name)}\nRole: ${clean(body.role)}\nCreated by: ${actor}`; break;
      case 'EMPLOYEE_ROLE_CHANGED': message = `🛡 STAFF PERMISSION CHANGE\nName: ${clean(body.name)}\nPrevious role: ${clean(body.previousRole || 'Unknown')}\nNew role: ${clean(body.role)}\nChanged by: ${actor}`; break;
      case 'PAYMENT_FAILED': message = `❌ PAYMENT FAILURE\nReference: ${clean(body.reference)}\nAmount: KES ${money(body.amount)}\nProvider: ${clean(body.provider)}\nReason: ${clean(body.reason)}\nRecorded by: ${actor}`; break;
      case 'PAYMENT_RECONCILIATION': message = `⚖️ PAYMENT RECONCILIATION DISCREPANCY\nReference: ${clean(body.reference)}\nExpected: KES ${money(body.expected)}\nReceived: KES ${money(body.received)}\nDifference: KES ${money(Number(body.expected || 0) - Number(body.received || 0))}\nDetails: ${clean(body.details)}`; break;
      case 'REFUND': message = `↩️ REFUND PROCESSED\nReference: ${clean(body.reference)}\nAmount: KES ${money(body.amount)}\nReason: ${clean(body.reason)}\nProcessed by: ${actor}`; break;
      case 'EXPENSE_CREATED':
        message = ['💸 NEW EXPENSE REQUEST', `Reference: ${clean(body.reference)}`, `Amount: KES ${money(body.amount)}`, `Reason: ${clean(body.reason)}`, `Requested by: ${actor}`, `Branch: ${clean(body.branchId || 'Unassigned')}`].join('\n');
        replyMarkup = Markup.inlineKeyboard([[
          Markup.button.callback('Review approval', `expense:review:approve:${clean(body.reference, 40)}`),
          Markup.button.callback('Review rejection', `expense:review:reject:${clean(body.reference, 40)}`),
        ]]).reply_markup;
        break;
      case 'EXPENSE_DECIDED': message = `🧾 EXPENSE APPROVAL DECISION\nReference: ${clean(body.reference)}\nAmount: KES ${money(body.amount)}\nDecision: ${clean(body.decision)}\nReason: ${clean(body.reason)}\nBy: ${actor}`; break;
      case 'ADMIN_CRUD': message = `🛠 ADMIN DATA CHANGE\nModule: ${clean(body.module)}\nOperation: ${clean(body.operation)}\nRecord: ${clean(body.recordId)}\nSummary: ${clean(body.details, 180)}\nBy: ${actor}`; break;
      case 'ACCESS_CHANGE': message = `🔑 SECURITY / ACCESS CONFIGURATION CHANGE\nTarget: ${clean(body.target)}\nChange: ${clean(body.change)}\nBy: ${actor}`; break;
      case 'SUSPICIOUS_ACTIVITY': message = `🚨 SUSPICIOUS ACTIVITY DETECTED\nActivity: ${clean(body.activity)}\nAccount: ${clean(decoded.email || 'Account unavailable')}\nDetails: ${clean(body.details)}\nBy: ${actor}`; break;
      default: return NextResponse.json({ error: 'Unsupported event.' }, { status: 400 });
    }
    await sendToManagement(message, eventId, clean(body.branchId, 80) || undefined, replyMarkup);
    await db.collection('system_audit_logs').add({ action: `TELEGRAM_${type}`, actorUid: uid, actorName: actor, createdAt: Date.now(), eventId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('Telegram event endpoint failed', error);
    return NextResponse.json({ error: 'Unable to dispatch event.' }, { status: 500 });
  }
}
