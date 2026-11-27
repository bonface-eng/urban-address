import { Telegraf, Markup } from 'telegraf';
import { getDbAdmin } from '@/lib/db/admin';
import { getTelegramDashboard, getTelegramLowStock, getTelegramSalesBreakdown, getTelegramPendingExpenses, getTelegramStationSalesReport, getTelegramCashierAnalyticsReport, getTelegramTopItems12HourReport } from './actions';
import { logger } from '../logger';
import { getTelegramOnlineReport, getTelegramJobsReport, getTelegramAttendantsReport, getTelegramPaymentsReport, getTelegramAlertsReport, getTelegramHealthReport } from './extended-actions';
import { registerTelegramRemoteOperations } from './remote-operations';

type TelegramRole = 'OWNER' | 'MANAGER' | 'STAFF';
type AccessEntry = { role: TelegramRole; branchIds?: string[]; name?: string };
function accessMap(): Record<string, AccessEntry> {
  const parsed: Record<string, AccessEntry> = {};
  try {
    const raw = JSON.parse(process.env.TELEGRAM_USER_ACCESS || '{}') as Record<string, AccessEntry> | null;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) Object.assign(parsed, raw);
  } catch { logger.error('TELEGRAM_USER_ACCESS is not valid JSON'); }
  const owners = String(process.env.OWNER_TELEGRAM_IDS || '').split(/[;,\s]+/).map(id => id.trim()).filter(id => /^\d{1,20}$/.test(id));
  for (const id of owners) parsed[id] = { role: 'OWNER', name: 'Owner' };
  return parsed;
}
async function accessFor(id?: number): Promise<AccessEntry | null> {
  if (!id) return null;
  const key = String(id);
  try {
    const snapshot = await getDbAdmin().collection('telegram_user_access').doc(key).get();
    if (snapshot.exists) {
      const value = snapshot.data()!;
      if (value.enabled === false) return null;
      const role = String(value.role || '').toUpperCase();
      if (['OWNER','MANAGER','STAFF'].includes(role)) {
        return {
          role: role as TelegramRole,
          name: typeof value.name === 'string' ? value.name : undefined,
          branchIds: Array.isArray(value.branchIds) ? value.branchIds.filter((x: unknown) => typeof x === 'string') : [],
        };
      }
      return null;
    }
  } catch (error) {
    logger.error('Telegram database access lookup failed; checking legacy environment access', error);
  }
  const entry = accessMap()[key];
  return entry && ['OWNER','MANAGER','STAFF'].includes(entry.role) ? entry : null;
}
function canManage(entry: AccessEntry | null) { return !!entry && ['OWNER','MANAGER'].includes(entry.role); }
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) logger.warn('Telegram bot disabled: TELEGRAM_BOT_TOKEN is not configured');
export const bot = new Telegraf(token || 'disabled-token');

bot.use(async (ctx, next) => {
  const entry = await accessFor(ctx.from?.id);
  if (!entry) {
    logger.warn('Blocked Telegram user without configured access', { telegramUserId: ctx.from?.id });
    if ('reply' in ctx) await ctx.reply(`Access is not enabled for this Telegram account.\n\nYour Telegram user ID: ${ctx.from?.id ?? 'Unavailable'}\nShare this ID with your business administrator to request access.`);
    return;
  }
  ctx.state.access = entry;
  return next();
});

bot.start(async ctx => ctx.reply('Urban Address Operations\n\nYour account is authorized. Use /help to see the tools available to your role.'));
bot.help(async ctx => {
  const a = ctx.state.access as AccessEntry;
  const common = ['/start — Connect your Telegram account', '/help — Show commands available to your role', '/myrole — View your configured role and branch assignment', '/request_refund ORDER_ID AMOUNT REASON — Submit a refund request', '/request_stock_adjustment PRODUCT_ID +/-QUANTITY REASON — Request a stock change'];
  const management = ['/online — Live customer, staff and admin sessions (owner only)', '/jobs — Active carwash jobs (owner only)', '/attendants — Attendant performance (owner only)', '/payments — Recent payment status overview (owner only)', '/alerts — Security and operations alerts (owner only)', '/health — Application and integration health (owner only)', '/branches — Branch directory', '/shifts — Recent register sessions', '/lock_terminal <id> — Disable a POS terminal (owner only)', '/unlock_terminal <id> — Re-enable a POS terminal (owner only)', '/emergency_lockdown — Lock Telegram remote administration (owner only)', '/unlock_remote_admin — Restore Telegram remote administration (owner only)', '/dashboard — Revenue, paid orders, active carwash jobs and low-stock overview', '/sales — Today’s sales totals by Lounge, Store and Carwash', '/inventory — Items at or below their restock threshold', '/expenses — Pending petty-cash requests with confirmation buttons', '/approvals — Pending approval queue', '/stock — Inventory restock report', '/report — Daily operations report', '/summary — Combined daily operations and sales summary', '/station_sales — POS station sales for the last 15 minutes', '/cashier_report — Cashier analytics for the last hour', '/top_items — Top 10 selling items for the last 12 hours', '/refunds — Review pending refunds', '/stock_adjustments — Approve or reject stock changes', '/lock_station TERMINAL_ID — Lock a POS station (owner)', '/unlock_station TERMINAL_ID — Unlock a POS station (owner)', '/cashier_sessions — View active cashier sessions', '/end_cashier_session SESSION_ID — End a cashier session (owner)', '/reconcile_shift SESSION_ID ACTUAL_CASH — Close and reconcile a register shift (owner)', '/reconciliations — View cash reconciliation history', '/incidents — Review open incidents', '/raise_incident MESSAGE — Report an incident', '/emergency_alert MESSAGE — Broadcast an emergency alert (owner)'];
  await ctx.reply(['URBAN ADDRESS OS | COMMANDS', '', ...common, ...(canManage(a) ? ['', 'MANAGEMENT COMMANDS', ...management] : []), '', a.role === 'STAFF' ? 'Staff accounts receive operational notifications when configured by an administrator. Management reports and approvals are restricted.' : 'Management commands are enabled for your configured role.'].join('\n'));
});
bot.command('emergency_lockdown', async ctx => {
  const a = ctx.state.access as AccessEntry;
  if (a.role !== 'OWNER') { await ctx.reply('Only a configured owner can activate emergency lockdown.'); return; }
  const now = Date.now();
  await getDbAdmin().collection('telegram_controls').doc('remote_admin').set({
    enabled: true, changedAt: now, changedByTelegramId: String(ctx.from.id), reason: 'Emergency lockdown activated from Telegram'
  }, { merge: true });
  await getDbAdmin().collection('audit_logs').add({
    action: 'TELEGRAM_REMOTE_ADMIN_LOCKDOWN_ENABLED', actorType: 'TELEGRAM', telegramUserId: String(ctx.from.id),
    details: 'Owner disabled remote Telegram management commands.', timestamp: now, severity: 'CRITICAL'
  });
  await ctx.reply('EMERGENCY LOCKDOWN ACTIVE. Telegram management commands are now disabled for all roles. Use /unlock_remote_admin to restore them. This does not disable POS sign-ins or application operations.');
});
bot.command('unlock_remote_admin', async ctx => {
  const a = ctx.state.access as AccessEntry;
  if (a.role !== 'OWNER') { await ctx.reply('Only a configured owner can restore remote administration.'); return; }
  const now = Date.now();
  await getDbAdmin().collection('telegram_controls').doc('remote_admin').set({
    enabled: false, changedAt: now, changedByTelegramId: String(ctx.from.id), reason: 'Remote administration restored by owner'
  }, { merge: true });
  await getDbAdmin().collection('audit_logs').add({
    action: 'TELEGRAM_REMOTE_ADMIN_LOCKDOWN_DISABLED', actorType: 'TELEGRAM', telegramUserId: String(ctx.from.id),
    details: 'Owner restored Telegram management commands.', timestamp: now, severity: 'WARNING'
  });
  await ctx.reply('Remote Telegram administration has been restored.');
});
bot.command('myrole', async ctx => {
  const a = ctx.state.access as AccessEntry;
  await ctx.reply(`Role: ${a.role}\nBranch access: ${a.branchIds?.length ? a.branchIds.join(', ') : 'All branches'}`);
});
async function remoteAdminLocked() {
  const snap = await getDbAdmin().collection('telegram_controls').doc('remote_admin').get();
  return snap.data()?.enabled === true;
}
async function ownerOnly(ctx: any) {
  const a = ctx.state.access as AccessEntry;
  if (a.role !== 'OWNER') { await ctx.reply('This command is restricted to configured owners.'); return false; }
  if (await remoteAdminLocked()) { await ctx.reply('Remote administration is locked. Use /unlock_remote_admin to restore commands.'); return false; }
  return true;
}
async function managerOnly(ctx: any) {
  const a = ctx.state.access as AccessEntry;
  if (!canManage(a)) { await ctx.reply('This action requires owner or manager access.'); return false; }
  if (await remoteAdminLocked()) { await ctx.reply('Remote administration is currently locked by an owner.'); return false; }
  return true;
}
async function sendReport(ctx: any, label: string, report: () => Promise<string>) {
  try {
    await ctx.reply(await report());
  } catch (error) {
    logger.error(`Telegram ${label} report failed`, error);
    await ctx.reply(`Unable to load ${label.toLowerCase()} right now. The request was logged for investigation. Please try again shortly.`);
  }
}
bot.command('online', async ctx => { if (await ownerOnly(ctx)) await sendReport(ctx, 'Online accounts', getTelegramOnlineReport); });
bot.command('jobs', async ctx => { if (await ownerOnly(ctx)) await sendReport(ctx, 'Carwash jobs', getTelegramJobsReport); });
bot.command('attendants', async ctx => { if (await ownerOnly(ctx)) await sendReport(ctx, 'Attendant performance', getTelegramAttendantsReport); });
bot.command('payments', async ctx => { if (await ownerOnly(ctx)) await sendReport(ctx, 'Payments', getTelegramPaymentsReport); });
bot.command('alerts', async ctx => { if (await ownerOnly(ctx)) await sendReport(ctx, 'Security alerts', getTelegramAlertsReport); });
bot.command('health', async ctx => {
  if (!await ownerOnly(ctx)) return;
  await sendReport(ctx, 'System health', async () => {
    const report = await getTelegramHealthReport();
    const telegram = await bot.telegram.getMe();
    return report + `\nTelegram bot: ONLINE (@${telegram.username || 'configured'})`;
  });
});
bot.command('branches', async ctx => {
  if (!await managerOnly(ctx)) return;
  try {
    const a = ctx.state.access as AccessEntry;
    const snap = await getDbAdmin().collection('branches').limit(100).get();
    const rows = snap.docs.filter(d => a.role === 'OWNER' || !a.branchIds?.length || a.branchIds.includes(d.id));
    const lines = rows.slice(0, 40).map(d => {
      const x = d.data();
      return `• ${String(x.name || d.id).slice(0, 80)} | ${String(x.code || '—')} | ${String(x.status || 'UNKNOWN')} | ${String(x.location?.town || x.town || '')}`;
    });
    await ctx.reply(['BRANCH DIRECTORY', `Branches: ${rows.length}`, '', ...(lines.length ? lines : ['No branches available for this account.'])].join('\n'));
  } catch (error) { logger.error('Telegram branch report failed', error); await ctx.reply('Unable to load branches.'); }
});
bot.command('shifts', async ctx => {
  if (!await managerOnly(ctx)) return;
  try {
    const a = ctx.state.access as AccessEntry;
    const snap = await getDbAdmin().collection('register_sessions').limit(150).get();
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as any))
      .filter(x => a.role === 'OWNER' || !a.branchIds?.length || (!!x.branchId && a.branchIds.includes(String(x.branchId))))
      .sort((x,y) => Number(y.startedAt || y.openedAt || y.timestamp || 0) - Number(x.startedAt || x.openedAt || x.timestamp || 0))
      .slice(0, 20);
    const lines = rows.map(x => {
      const when = Number(x.startedAt || x.openedAt || x.timestamp || 0);
      return `• ${String(x.cashierName || x.staffName || x.userName || x.cashierId || 'Staff')} | ${String(x.status || (x.closedAt ? 'CLOSED' : 'OPEN'))} | ${String(x.branchName || x.branchId || 'Branch —')} | ${when ? new Date(when).toLocaleString('en-KE',{timeZone:'Africa/Nairobi'}) : 'Time unavailable'}`;
    });
    await ctx.reply(['REGISTER SHIFTS | recent sessions', `Records: ${rows.length}`, '', ...(lines.length ? lines : ['No register sessions found.'])].join('\n'));
  } catch (error) { logger.error('Telegram shift report failed', error); await ctx.reply('Unable to load register shifts.'); }
});
bot.command('branches', async ctx => {
  if (!await managerOnly(ctx)) return;
  try {
    const a = ctx.state.access as AccessEntry;
    const snap = await getDbAdmin().collection('branches').limit(100).get();
    const rows = snap.docs.filter(d => a.role === 'OWNER' || !a.branchIds?.length || a.branchIds.includes(d.id));
    const lines = rows.slice(0, 40).map(d => {
      const x = d.data();
      return '• ' + String(x.name || d.id).slice(0, 80) + ' | ' + String(x.code || '—') + ' | ' + String(x.status || 'UNKNOWN') + ' | ' + String(x.location?.town || x.town || '');
    });
    await ctx.reply(['BRANCH DIRECTORY', 'Branches: ' + rows.length, '', ...(lines.length ? lines : ['No branches available for this account.'])].join('\n'));
  } catch (error) { logger.error('Telegram branch report failed', error); await ctx.reply('Unable to load branches.'); }
});
bot.command('shifts', async ctx => {
  if (!await managerOnly(ctx)) return;
  try {
    const a = ctx.state.access as AccessEntry;
    const snap = await getDbAdmin().collection('register_sessions').limit(150).get();
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as any))
      .filter(x => a.role === 'OWNER' || !a.branchIds?.length || !x.branchId || a.branchIds.includes(String(x.branchId)))
      .sort((x,y) => Number(y.startedAt || y.openedAt || y.timestamp || 0) - Number(x.startedAt || x.openedAt || x.timestamp || 0))
      .slice(0, 20);
    const lines = rows.map(x => {
      const when = Number(x.startedAt || x.openedAt || x.timestamp || 0);
      return '• ' + String(x.cashierName || x.staffName || x.userName || x.cashierId || 'Staff') + ' | ' + String(x.status || (x.closedAt ? 'CLOSED' : 'OPEN')) + ' | ' + String(x.branchName || x.branchId || 'Branch —') + ' | ' + (when ? new Date(when).toLocaleString('en-KE',{timeZone:'Africa/Nairobi'}) : 'Time unavailable');
    });
    await ctx.reply(['REGISTER SHIFTS | recent sessions', 'Records: ' + rows.length, '', ...(lines.length ? lines : ['No register sessions found.'])].join('\n'));
  } catch (error) { logger.error('Telegram shift report failed', error); await ctx.reply('Unable to load register shifts.'); }
});
bot.command('dashboard', async ctx => { if (await managerOnly(ctx)) await sendReport(ctx, 'Dashboard', getTelegramDashboard); });
bot.command('sales', async ctx => { if (await managerOnly(ctx)) await sendReport(ctx, 'Sales', getTelegramSalesBreakdown); });
bot.command('inventory', async ctx => { if (await managerOnly(ctx)) await sendReport(ctx, 'Inventory', getTelegramLowStock); });
bot.command('stock', async ctx => { if (await managerOnly(ctx)) await sendReport(ctx, 'Stock', getTelegramLowStock); });
bot.command('report', async ctx => { if (await managerOnly(ctx)) await sendReport(ctx, 'Daily report', async () => `${await getTelegramDashboard()}\n\n${await getTelegramSalesBreakdown()}`); });
bot.command('station_sales', async ctx => { if (await managerOnly(ctx)) await sendReport(ctx, 'Station sales', getTelegramStationSalesReport); });
bot.command('cashier_report', async ctx => { if (await managerOnly(ctx)) await sendReport(ctx, 'Cashier analytics', getTelegramCashierAnalyticsReport); });
bot.command('top_items', async ctx => { if (await managerOnly(ctx)) await sendReport(ctx, 'Top selling items', getTelegramTopItems12HourReport); });
bot.command('summary', async ctx => {
  if (!await managerOnly(ctx)) return;
  try {
    const [sales, dashboard] = await Promise.all([getTelegramSalesBreakdown(), getTelegramDashboard()]);
    await ctx.reply(`DAILY BUSINESS SUMMARY\n\n${dashboard}\n\n${sales}`);
  } catch (error) {
    logger.error('Telegram daily summary report failed', error);
    await ctx.reply('Unable to load the daily summary right now. The request was logged for investigation.');
  }
});
async function listPendingApprovals(ctx: any) {
  if (!await managerOnly(ctx)) return;
  const a = ctx.state.access as AccessEntry;
  const snap = await getDbAdmin().collection('petty_cash').where('status','==','PENDING').orderBy('timestamp','desc').limit(10).get();
  if (snap.empty) { await ctx.reply('No pending petty cash approvals.'); return; }
  let sent = 0;
  for (const d of snap.docs) {
    const x = d.data();
    if (a.role !== 'OWNER' && a.branchIds?.length && (!x.branchId || !a.branchIds.includes(String(x.branchId)))) continue;
    await ctx.reply(`PETTY CASH REQUEST\nKES ${Number(x.amount || 0).toLocaleString()}\n${String(x.reason || 'No memo')}\nRequested by: ${x.requesterName || 'Staff'}\nBranch: ${x.branchName || x.branchId || 'Unassigned'}`,
      Markup.inlineKeyboard([[Markup.button.callback('Review approval', `expense:review:approve:${d.id}`), Markup.button.callback('Review rejection', `expense:review:reject:${d.id}`)]]));
    sent++;
  }
  if (!sent) await ctx.reply('No pending approvals are assigned to your branch access.');
}
bot.command('approvals', listPendingApprovals);
bot.command('expenses', listPendingApprovals);

bot.action(/^expense:review:(approve|reject):([A-Za-z0-9_-]+)$/, async ctx => {
  const a = ctx.state.access as AccessEntry;
  if (!canManage(a) || await remoteAdminLocked()) { await ctx.answerCbQuery('Management access unavailable', { show_alert: true }); return; }
  const [, decision, id] = ctx.match;
  const snap = await getDbAdmin().collection('petty_cash').doc(id).get();
  if (!snap.exists || snap.data()?.status !== 'PENDING') { await ctx.answerCbQuery('This request is no longer pending.', { show_alert: true }); return; }
  const data = snap.data()!;
  if (a.role !== 'OWNER' && a.branchIds?.length && data.branchId && !a.branchIds.includes(data.branchId)) { await ctx.answerCbQuery('Outside your branch access', { show_alert: true }); return; }
  await ctx.answerCbQuery('Please confirm the decision.');
  await ctx.reply(`CONFIRM PETTY CASH DECISION\n\nRequest: ${id}\nAmount: KES ${Number(data.amount || 0).toLocaleString()}\nDecision: ${decision.toUpperCase()}\n\nThis action will be recorded in the audit log.`,
    Markup.inlineKeyboard([[Markup.button.callback(`Confirm ${decision}`, `expense:confirm:${decision}:${id}`), Markup.button.callback('Cancel', `expense:cancel:${id}`)]]));
});
bot.action(/^expense:cancel:([A-Za-z0-9_-]+)$/, async ctx => {
  await ctx.answerCbQuery('Decision cancelled.');
  await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
});
bot.action(/^expense:confirm:(approve|reject):([A-Za-z0-9_-]+)$/, async ctx => {
  const a = ctx.state.access as AccessEntry;
  if (!canManage(a) || await remoteAdminLocked()) { await ctx.answerCbQuery('Owner/manager access required or remote administration is locked', { show_alert: true }); return; }
  const [, decision, id] = ctx.match;
  const db = getDbAdmin();
  const ref = db.collection('petty_cash').doc(id);
  try {
    const result = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Request not found');
      const data = snap.data()!;
      if (data.status !== 'PENDING') return { changed: false, status: data.status };
      if (a.role !== 'OWNER' && a.branchIds?.length && (!data.branchId || !a.branchIds.includes(String(data.branchId)))) throw new Error('Request is outside your assigned branches');
      const now = Date.now();
      const approved = decision === 'approve';
      tx.update(ref, approved
        ? { status: 'APPROVED', approvedByTelegramId: String(ctx.from.id), approvedBy: a.name || `Telegram ${ctx.from.id}`, approvedAt: now, approvalSource: 'TELEGRAM' }
        : { status: 'DENIED', deniedByTelegramId: String(ctx.from.id), deniedBy: a.name || `Telegram ${ctx.from.id}`, deniedAt: now, denialReason: 'Rejected through Telegram', approvalSource: 'TELEGRAM' });
      const audit = db.collection('audit_logs').doc();
      tx.set(audit, { action: approved ? 'PETTY_CASH_APPROVED_TELEGRAM' : 'PETTY_CASH_DENIED_TELEGRAM', userId: null, actorType: 'TELEGRAM', telegramUserId: String(ctx.from.id), details: `${approved ? 'Approved' : 'Rejected'} petty cash ${id} for KES ${data.amount || 0}`, timestamp: now, severity: approved ? 'INFO' : 'WARNING' });
      return { changed: true, status: approved ? 'APPROVED' : 'DENIED' };
    });
    await ctx.answerCbQuery(result.changed ? result.status : `Already ${result.status}`);
    if (result.changed) await ctx.editMessageReplyMarkup(undefined);
  } catch (error) {
    logger.error('Telegram petty cash decision failed', error);
    await ctx.answerCbQuery(error instanceof Error ? error.message : 'Action failed', { show_alert: true });
  }
});
bot.command('lock_terminal', async ctx => {
  if (!await ownerOnly(ctx)) return;
  const id = String((ctx.message as any)?.text || '').trim().split(/\s+/)[1] || '';
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(id)) { await ctx.reply('Usage: /lock_terminal TERMINAL_ID (16–40 letters, numbers, _ or -).'); return; }
  const ref = getDbAdmin().collection('terminal_devices').doc(id);
  const snap = await ref.get();
  if (!snap.exists) { await ctx.reply('Terminal not found.'); return; }
  if (snap.data()?.disabled === true) { await ctx.reply('This terminal is already disabled.'); return; }
  await ctx.reply(`Confirm disabling terminal ${id}? Staff will not be able to sign in on it until it is re-enabled.`,
    Markup.inlineKeyboard([[Markup.button.callback('Confirm lock', `terminal:confirm_lock:${id}`), Markup.button.callback('Cancel', `terminal:cancel:${id}`)]]));
});
bot.command('unlock_terminal', async ctx => {
  if (!await ownerOnly(ctx)) return;
  const id = String((ctx.message as any)?.text || '').trim().split(/\s+/)[1] || '';
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(id)) { await ctx.reply('Usage: /unlock_terminal TERMINAL_ID (16–80 letters, numbers, _ or -).'); return; }
  const snap = await getDbAdmin().collection('terminal_devices').doc(id).get();
  if (!snap.exists) { await ctx.reply('Terminal not found.'); return; }
  if (snap.data()?.disabled !== true) { await ctx.reply('This terminal is not disabled.'); return; }
  await ctx.reply(`Confirm re-enabling terminal ${id}?`,
    Markup.inlineKeyboard([[Markup.button.callback('Confirm unlock', `terminal:confirm_unlock:${id}`), Markup.button.callback('Cancel', `terminal:cancel:${id}`)]]));
});
bot.action(/^terminal:(confirm_lock|confirm_unlock|cancel):([A-Za-z0-9_-]{16,80})$/, async ctx => {
  const a = ctx.state.access as AccessEntry;
  if (a.role !== 'OWNER' || await remoteAdminLocked()) { await ctx.answerCbQuery('Owner access required or remote administration is locked.', { show_alert: true }); return; }
  const [, action, id] = ctx.match;
  if (action === 'cancel') { await ctx.answerCbQuery('Cancelled.'); await ctx.editMessageReplyMarkup(undefined).catch(() => undefined); return; }
  const ref = getDbAdmin().collection('terminal_devices').doc(id);
  try {
    const disabled = action === 'confirm_lock';
    await getDbAdmin().runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Terminal not found');
      tx.set(ref, { disabled, disabledAt: disabled ? Date.now() : null, disabledByTelegramId: String(ctx.from.id), updatedAt: Date.now(), updatedBy: 'TELEGRAM_OWNER' }, { merge: true });
      const audit = getDbAdmin().collection('audit_logs').doc();
      tx.set(audit, { action: disabled ? 'TERMINAL_DISABLED_TELEGRAM' : 'TERMINAL_ENABLED_TELEGRAM', actorType: 'TELEGRAM', telegramUserId: String(ctx.from.id), details: `${disabled ? 'Disabled' : 'Re-enabled'} terminal ${id} from Telegram.`, timestamp: Date.now(), severity: disabled ? 'CRITICAL' : 'WARNING' });
    });
    await ctx.answerCbQuery(disabled ? 'Terminal disabled.' : 'Terminal re-enabled.', { show_alert: true });
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
  } catch (error) {
    logger.error('Telegram terminal control failed', error);
    await ctx.answerCbQuery(error instanceof Error ? error.message : 'Terminal update failed', { show_alert: true });
  }
});
bot.catch((err, ctx) => { logger.error('Telegram update handler failed', { updateId: ctx.update.update_id, error: err }); });


registerTelegramRemoteOperations(bot);
