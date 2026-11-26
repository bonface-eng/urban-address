import { Markup, Telegraf } from 'telegraf';
import { getDbAdmin } from '../firebase-admin';
import { logger } from '../logger';

type Access = { role: 'OWNER' | 'MANAGER' | 'STAFF'; branchIds?: string[]; name?: string };
const clean = (value: unknown, max = 180) => String(value ?? '').replace(/[<>\r\n]/g, ' ').trim().slice(0, max);
const money = (value: number) => 'KES ' + Math.round(value).toLocaleString('en-KE');
const canManage = (a: Access) => a.role === 'OWNER' || a.role === 'MANAGER';
const canSeeBranch = (a: Access, branchId: unknown) => a.role === 'OWNER' || !a.branchIds?.length || (!!branchId && a.branchIds.includes(String(branchId)));

async function locked() {
  const snap = await getDbAdmin().collection('telegram_controls').doc('remote_admin').get();
  return snap.data()?.enabled === true;
}
async function requireManager(ctx: any) {
  const a = ctx.state.access as Access;
  if (!canManage(a)) { await ctx.reply('Owner or manager access is required.'); return false; }
  if (await locked()) { await ctx.reply('Remote administration is locked by an owner.'); return false; }
  return true;
}
async function requireOwner(ctx: any) {
  const a = ctx.state.access as Access;
  if (a.role !== 'OWNER') { await ctx.reply('This action is restricted to configured owners.'); return false; }
  if (await locked()) { await ctx.reply('Remote administration is locked.'); return false; }
  return true;
}
function commandText(ctx: any) { return String(ctx.message?.text || '').trim(); }
async function managementRecipients() {
  const db = getDbAdmin();
  const users = new Map<string, { role: string; branchIds: string[] }>();
  try {
    const env = JSON.parse(process.env.TELEGRAM_USER_ACCESS || '{}') as Record<string, any>;
    for (const [id, value] of Object.entries(env)) {
      const role = String(value?.role || '').toUpperCase();
      if (/^\d{1,20}$/.test(id) && ['OWNER', 'MANAGER'].includes(role)) {
        users.set(id, { role, branchIds: Array.isArray(value.branchIds) ? value.branchIds.map(String) : [] });
      }
    }
  } catch { logger.error('Invalid Telegram access configuration while notifying management'); }
  String(process.env.OWNER_TELEGRAM_IDS || '').split(/[;,\s]+/).filter(id => /^\d{1,20}$/.test(id))
    .forEach(id => users.set(id, { role: 'OWNER', branchIds: [] }));
  const snap = await db.collection('telegram_user_access').get();
  for (const doc of snap.docs) {
    const value = doc.data();
    if (value.enabled === false) { users.delete(doc.id); continue; }
    const role = String(value.role || '').toUpperCase();
    if (['OWNER', 'MANAGER'].includes(role)) {
      users.set(doc.id, { role, branchIds: Array.isArray(value.branchIds) ? value.branchIds.map(String) : [] });
    }
  }
  return users;
}
async function broadcast(bot: Telegraf<any>, message: string, branchId?: string) {
  const users = await managementRecipients();
  const targets = [...users.entries()].filter(([, value]) =>
    value.role === 'OWNER' || !branchId || value.branchIds.length === 0 || value.branchIds.includes(branchId)
  );
  const results = await Promise.allSettled(targets.map(([id]) => bot.telegram.sendMessage(id, message)));
  return { sent: results.filter(x => x.status === 'fulfilled').length, failed: results.filter(x => x.status === 'rejected').length };
}

export function registerTelegramRemoteOperations(bot: Telegraf<any>) {
  // Staff can submit a refund request, but Telegram approval does not issue money.
  bot.command('request_refund', async ctx => {
    const a = ctx.state.access as Access;
    if (await locked()) { await ctx.reply('Remote administration is locked.'); return; }
    const parts = commandText(ctx).split(/\s+/);
    const orderId = parts[1] || '';
    const amount = Number(parts[2]);
    const reason = parts.slice(3).join(' ').trim();
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(orderId) || !Number.isFinite(amount) || amount <= 0 || amount > 100000000 || reason.length < 4 || reason.length > 240) {
      await ctx.reply('Usage: /request_refund ORDER_ID AMOUNT REASON\nExample: /request_refund abc123 2500 Customer returned item');
      return;
    }
    const db = getDbAdmin();
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) { await ctx.reply('Order not found.'); return; }
    const order = orderSnap.data()!;
    const total = Number(order.total || 0);
    if ((order.status !== 'PAID' && order.paymentStatus !== 'PAID') || order.status === 'REFUNDED' || amount > total) {
      await ctx.reply('Only paid orders can be requested for refund, and the amount cannot exceed the order total.');
      return;
    }
    if (!canSeeBranch(a, order.branchId)) { await ctx.reply('This order is outside your assigned branch access.'); return; }
    const prior = await db.collection('refund_requests').where('orderId', '==', orderId).limit(20).get();
    const reserved = prior.docs.filter(d => ['PENDING', 'APPROVED', 'PROCESSING'].includes(String(d.data().status || '').toUpperCase()))
      .reduce((sum, d) => sum + Number(d.data().amount || 0), 0);
    if (reserved + amount > total) { await ctx.reply('This request would exceed the remaining refundable order balance.'); return; }
    const ref = await db.collection('refund_requests').add({
      orderId, amount, reason, status: 'PENDING', branchId: String(order.branchId || ''),
      branchName: String(order.branchName || ''), orderTotal: total,
      paymentMethod: String(order.paymentMethod || order.paymentProvider || ''),
      requestedByTelegramId: String(ctx.from.id), requestedBy: clean(a.name || ('Telegram ' + ctx.from.id), 80),
      createdAt: Date.now(), source: 'TELEGRAM'
    });
    await db.collection('audit_logs').add({
      action: 'REFUND_REQUESTED_TELEGRAM', actorType: 'TELEGRAM', telegramUserId: String(ctx.from.id),
      details: 'Refund request ' + ref.id + ' for order ' + orderId + ', amount ' + amount + ', reason: ' + reason,
      timestamp: Date.now(), severity: 'WARNING'
    });
    await ctx.reply('Refund request recorded: ' + ref.id + '\nOrder: ' + orderId + '\nAmount: ' + money(amount) + '\nIt is awaiting manager approval. Approval does not itself send money or mark the order refunded.');
    await broadcast(bot, 'REFUND REQUEST AWAITING REVIEW\nRequest: ' + ref.id + '\nOrder: ' + orderId + '\nAmount: ' + money(amount) + '\nReason: ' + reason, String(order.branchId || '') || undefined);
  });

  bot.command('refunds', async ctx => {
    if (!await requireManager(ctx)) return;
    const a = ctx.state.access as Access;
    const snap = await getDbAdmin().collection('refund_requests').where('status', '==', 'PENDING').limit(50).get();
    const rows = snap.docs.filter(d => canSeeBranch(a, d.data().branchId)).sort((x, y) => Number(y.data().createdAt || 0) - Number(x.data().createdAt || 0)).slice(0, 12);
    if (!rows.length) { await ctx.reply('No pending refund approvals for your branch access.'); return; }
    for (const d of rows) {
      const x = d.data();
      await ctx.reply(
        'REFUND APPROVAL\nRequest: ' + d.id + '\nOrder: ' + clean(x.orderId) + '\nAmount: ' + money(Number(x.amount || 0)) +
        '\nReason: ' + clean(x.reason) + '\nRequested by: ' + clean(x.requestedBy) + '\nBranch: ' + clean(x.branchName || x.branchId || 'Unassigned'),
        Markup.inlineKeyboard([[
          Markup.button.callback('Review approve', 'refund:review:approve:' + d.id),
          Markup.button.callback('Review reject', 'refund:review:reject:' + d.id)
        ]])
      );
    }
  });

  bot.action(/^refund:review:(approve|reject):([A-Za-z0-9_-]+)$/, async ctx => {
    if (!await requireManager(ctx)) { await ctx.answerCbQuery('Management access unavailable', { show_alert: true }); return; }
    const a = ctx.state.access as Access;
    const match = ctx.match as RegExpMatchArray;
    const decision = match[1], id = match[2];
    const snap = await getDbAdmin().collection('refund_requests').doc(id).get();
    if (!snap.exists || snap.data()?.status !== 'PENDING') { await ctx.answerCbQuery('This request is no longer pending.', { show_alert: true }); return; }
    if (!canSeeBranch(a, snap.data()?.branchId)) { await ctx.answerCbQuery('Outside your branch access.', { show_alert: true }); return; }
    await ctx.answerCbQuery('Confirm the decision in the next message.');
    await ctx.reply('CONFIRM REFUND ' + decision.toUpperCase() + '\nRequest: ' + id + '\nAmount: ' + money(Number(snap.data()?.amount || 0)) +
      '\nThis records approval only; payment execution remains in the authorized payment workflow.',
      Markup.inlineKeyboard([[
        Markup.button.callback('Confirm ' + decision, 'refund:confirm:' + decision + ':' + id),
        Markup.button.callback('Cancel', 'refund:cancel:' + id)
      ]]));
  });
  bot.action(/^refund:cancel:([A-Za-z0-9_-]+)$/, async ctx => {
    await ctx.answerCbQuery('Cancelled.');
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
  });
  bot.action(/^refund:confirm:(approve|reject):([A-Za-z0-9_-]+)$/, async ctx => {
    if (!await requireManager(ctx)) { await ctx.answerCbQuery('Management access unavailable', { show_alert: true }); return; }
    const a = ctx.state.access as Access;
    const match = ctx.match as RegExpMatchArray;
    const decision = match[1], id = match[2];
    const db = getDbAdmin(), ref = db.collection('refund_requests').doc(id);
    try {
      const result = await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new Error('Refund request not found.');
        const x = snap.data()!;
        if (x.status !== 'PENDING') return { changed: false, status: String(x.status || 'UNKNOWN') };
        if (!canSeeBranch(a, x.branchId)) throw new Error('Request is outside your branch access.');
        if (String(x.requestedByTelegramId || '') === String(ctx.from.id)) throw new Error('A requester cannot approve their own refund request.');
        const orderRef = db.collection('orders').doc(String(x.orderId));
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists || (orderSnap.data()?.status !== 'PAID' && orderSnap.data()?.paymentStatus !== 'PAID')) throw new Error('The order is no longer eligible for a refund approval.');
        const now = Date.now(), approved = decision === 'approve';
        tx.update(ref, {
          status: approved ? 'APPROVED' : 'REJECTED',
          decision: approved ? 'APPROVED' : 'REJECTED',
          decidedAt: now, decidedByTelegramId: String(ctx.from.id),
          decidedBy: clean(a.name || ('Telegram ' + ctx.from.id), 80),
          decisionSource: 'TELEGRAM'
        });
        if (approved) tx.set(db.collection('orders').doc(String(x.orderId)), {
          refundApprovalStatus: 'APPROVED', refundApprovalRequestId: id, refundApprovedAt: now
        }, { merge: true });
        tx.set(db.collection('audit_logs').doc(), {
          action: approved ? 'REFUND_APPROVED_TELEGRAM' : 'REFUND_REJECTED_TELEGRAM',
          actorType: 'TELEGRAM', telegramUserId: String(ctx.from.id),
          details: (approved ? 'Approved' : 'Rejected') + ' refund request ' + id + ' for order ' + x.orderId + ' amount ' + x.amount,
          timestamp: now, severity: approved ? 'WARNING' : 'INFO'
        });
        return { changed: true, status: approved ? 'APPROVED' : 'REJECTED' };
      });
      await ctx.answerCbQuery(result.changed ? result.status : 'Already ' + result.status, { show_alert: true });
      if (result.changed) await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    } catch (error) {
      logger.error('Telegram refund decision failed', error);
      await ctx.answerCbQuery(error instanceof Error ? error.message : 'Refund decision failed.', { show_alert: true });
    }
  });

  // Inventory adjustments are staged as requests. The actual stock write happens only on approval.
  bot.command('request_stock_adjustment', async ctx => {
    if (await locked()) { await ctx.reply('Remote administration is locked.'); return; }
    const a = ctx.state.access as Access;
    const parts = commandText(ctx).split(/\s+/);
    const productId = parts[1] || '';
    const delta = Number(parts[2]);
    const reason = parts.slice(3).join(' ').trim();
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(productId) || !Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 100000 || reason.length < 4 || reason.length > 240) {
      await ctx.reply('Usage: /request_stock_adjustment PRODUCT_ID +/-QUANTITY REASON\nExample: /request_stock_adjustment abc123 -2 Damaged stock');
      return;
    }
    const db = getDbAdmin(), productRef = db.collection('inventory').doc(productId);
    const productSnap = await productRef.get();
    if (!productSnap.exists) { await ctx.reply('Inventory item not found.'); return; }
    const product = productSnap.data()!;
    if (product.archived === true || !canSeeBranch(a, product.branchId)) { await ctx.reply('This item is archived or outside your branch access.'); return; }
    const before = Number(product.stockLevel || 0), after = before + delta;
    if (after < 0) { await ctx.reply('The requested adjustment would make stock negative.'); return; }
    const ref = await db.collection('stock_adjustment_requests').add({
      productId, productName: clean(product.name || productId, 100), beforeStock: before, afterStock: after, delta,
      reason, unit: clean(product.unit || 'UNASSIGNED', 30), branchId: String(product.branchId || ''),
      requestedByTelegramId: String(ctx.from.id), requestedBy: clean(a.name || ('Telegram ' + ctx.from.id), 80),
      status: 'PENDING', createdAt: Date.now(), source: 'TELEGRAM'
    });
    await db.collection('audit_logs').add({
      action: 'STOCK_ADJUSTMENT_REQUESTED_TELEGRAM', actorType: 'TELEGRAM', telegramUserId: String(ctx.from.id),
      details: 'Requested stock change ' + delta + ' for ' + productId + ': ' + reason,
      timestamp: Date.now(), severity: 'WARNING'
    });
    await ctx.reply('Stock adjustment request submitted.\nRequest: ' + ref.id + '\nItem: ' + clean(product.name || productId) +
      '\nStock: ' + before + ' → ' + after + '\nReason: ' + reason + '\nNo stock was changed yet.');
    await broadcast(bot, 'STOCK ADJUSTMENT AWAITING APPROVAL\nRequest: ' + ref.id + '\nItem: ' + clean(product.name || productId) +
      '\nChange: ' + before + ' → ' + after + '\nReason: ' + reason, String(product.branchId || '') || undefined);
  });

  bot.command('stock_adjustments', async ctx => {
    if (!await requireManager(ctx)) return;
    const a = ctx.state.access as Access;
    const snap = await getDbAdmin().collection('stock_adjustment_requests').where('status', '==', 'PENDING').limit(50).get();
    const rows = snap.docs.filter(d => canSeeBranch(a, d.data().branchId)).sort((x, y) => Number(y.data().createdAt || 0) - Number(x.data().createdAt || 0)).slice(0, 12);
    if (!rows.length) { await ctx.reply('No pending stock adjustment approvals.'); return; }
    for (const d of rows) {
      const x = d.data();
      await ctx.reply('STOCK ADJUSTMENT\nRequest: ' + d.id + '\nItem: ' + clean(x.productName) + '\nStock: ' + Number(x.beforeStock) + ' → ' + Number(x.afterStock) +
        '\nReason: ' + clean(x.reason) + '\nRequested by: ' + clean(x.requestedBy),
        Markup.inlineKeyboard([[
          Markup.button.callback('Approve', 'stock:review:approve:' + d.id),
          Markup.button.callback('Reject', 'stock:review:reject:' + d.id)
        ]]));
    }
  });
  bot.action(/^stock:review:(approve|reject):([A-Za-z0-9_-]+)$/, async ctx => {
    if (!await requireManager(ctx)) { await ctx.answerCbQuery('Management access unavailable', { show_alert: true }); return; }
    const a = ctx.state.access as Access, match = ctx.match as RegExpMatchArray;
    const decision = match[1], id = match[2];
    const snap = await getDbAdmin().collection('stock_adjustment_requests').doc(id).get();
    if (!snap.exists || snap.data()?.status !== 'PENDING') { await ctx.answerCbQuery('This request is no longer pending.', { show_alert: true }); return; }
    if (!canSeeBranch(a, snap.data()?.branchId)) { await ctx.answerCbQuery('Outside your branch access.', { show_alert: true }); return; }
    await ctx.answerCbQuery('Confirm the decision in the next message.');
    await ctx.reply('CONFIRM STOCK ADJUSTMENT ' + decision.toUpperCase() + '\nItem: ' + clean(snap.data()?.productName) +
      '\nChange: ' + Number(snap.data()?.beforeStock) + ' → ' + Number(snap.data()?.afterStock),
      Markup.inlineKeyboard([[
        Markup.button.callback('Confirm ' + decision, 'stock:confirm:' + decision + ':' + id),
        Markup.button.callback('Cancel', 'stock:cancel:' + id)
      ]]));
  });
  bot.action(/^stock:cancel:([A-Za-z0-9_-]+)$/, async ctx => {
    await ctx.answerCbQuery('Cancelled.');
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
  });
  bot.action(/^stock:confirm:(approve|reject):([A-Za-z0-9_-]+)$/, async ctx => {
    if (!await requireManager(ctx)) { await ctx.answerCbQuery('Management access unavailable', { show_alert: true }); return; }
    const a = ctx.state.access as Access, match = ctx.match as RegExpMatchArray;
    const decision = match[1], id = match[2], db = getDbAdmin();
    const requestRef = db.collection('stock_adjustment_requests').doc(id);
    try {
      const result = await db.runTransaction(async tx => {
        const requestSnap = await tx.get(requestRef);
        if (!requestSnap.exists) throw new Error('Stock request not found.');
        const x = requestSnap.data()!;
        if (x.status !== 'PENDING') return { changed: false, status: String(x.status || 'UNKNOWN') };
        if (!canSeeBranch(a, x.branchId)) throw new Error('Request is outside your branch access.');
        if (String(x.requestedByTelegramId || '') === String(ctx.from.id)) throw new Error('A requester cannot approve their own stock adjustment.');
        const productRef = db.collection('inventory').doc(String(x.productId));
        const productSnap = await tx.get(productRef);
        if (!productSnap.exists) throw new Error('Inventory item no longer exists.');
        const current = Number(productSnap.data()?.stockLevel || 0);
        if (decision === 'approve' && current !== Number(x.beforeStock)) throw new Error('Stock changed after this request was submitted. Reject it and submit a fresh adjustment.');
        const now = Date.now(), approved = decision === 'approve';
        if (approved) tx.update(productRef, { stockLevel: Number(x.afterStock), updatedAt: now, stockAdjustedByTelegramId: String(ctx.from.id) });
        tx.update(requestRef, {
          status: approved ? 'APPROVED' : 'REJECTED', decidedAt: now,
          decidedByTelegramId: String(ctx.from.id), decidedBy: clean(a.name || ('Telegram ' + ctx.from.id), 80),
          decisionSource: 'TELEGRAM'
        });
        tx.set(db.collection('audit_logs').doc(), {
          action: approved ? 'STOCK_ADJUSTMENT_APPROVED_TELEGRAM' : 'STOCK_ADJUSTMENT_REJECTED_TELEGRAM',
          actorType: 'TELEGRAM', telegramUserId: String(ctx.from.id),
          details: (approved ? 'Approved' : 'Rejected') + ' stock adjustment ' + id + ' for ' + x.productId + ': ' + x.beforeStock + ' → ' + x.afterStock,
          timestamp: now, severity: approved ? 'WARNING' : 'INFO'
        });
        return { changed: true, status: approved ? 'APPROVED' : 'REJECTED' };
      });
      await ctx.answerCbQuery(result.changed ? result.status : 'Already ' + result.status, { show_alert: true });
      if (result.changed) await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    } catch (error) {
      logger.error('Telegram stock adjustment decision failed', error);
      await ctx.answerCbQuery(error instanceof Error ? error.message : 'Stock decision failed.', { show_alert: true });
    }
  });

  // Station lock and cashier session controls.
  bot.command('lock_station', async ctx => {
    if (!await requireOwner(ctx)) return;
    const id = commandText(ctx).split(/\s+/)[1] || '';
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) { await ctx.reply('Usage: /lock_station TERMINAL_ID'); return; }
    const db = getDbAdmin();
    const [device, station] = await Promise.all([db.collection('terminal_devices').doc(id).get(), db.collection('pos_terminals').doc(id).get()]);
    if (!device.exists && !station.exists) { await ctx.reply('POS station not found.'); return; }
    await ctx.reply('Confirm locking POS station ' + id + '? Current cashier will be locked out of POS actions.',
      Markup.inlineKeyboard([[Markup.button.callback('Confirm lock', 'station:confirm_lock:' + id), Markup.button.callback('Cancel', 'station:cancel:' + id)]]));
  });
  bot.command('unlock_station', async ctx => {
    if (!await requireOwner(ctx)) return;
    const id = commandText(ctx).split(/\s+/)[1] || '';
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) { await ctx.reply('Usage: /unlock_station TERMINAL_ID'); return; }
    const db = getDbAdmin();
    const [device, station] = await Promise.all([db.collection('terminal_devices').doc(id).get(), db.collection('pos_terminals').doc(id).get()]);
    if (!device.exists && !station.exists) { await ctx.reply('POS station not found.'); return; }
    await ctx.reply('Confirm unlocking POS station ' + id + '?',
      Markup.inlineKeyboard([[Markup.button.callback('Confirm unlock', 'station:confirm_unlock:' + id), Markup.button.callback('Cancel', 'station:cancel:' + id)]]));
  });
  bot.action(/^station:(confirm_lock|confirm_unlock|cancel):([A-Za-z0-9_-]{1,80})$/, async ctx => {
    if (!await requireOwner(ctx)) { await ctx.answerCbQuery('Owner access required.', { show_alert: true }); return; }
    const match = ctx.match as RegExpMatchArray, action = match[1], id = match[2];
    if (action === 'cancel') { await ctx.answerCbQuery('Cancelled.'); await ctx.editMessageReplyMarkup(undefined).catch(() => undefined); return; }
    const db = getDbAdmin(), deviceRef = db.collection('terminal_devices').doc(id), stationRef = db.collection('pos_terminals').doc(id);
    try {
      const disabled = action === 'confirm_lock', now = Date.now();
      await db.runTransaction(async tx => {
        const [device, station] = await Promise.all([tx.get(deviceRef), tx.get(stationRef)]);
        if (!device.exists && !station.exists) throw new Error('POS station not found.');
        if (device.exists) tx.set(deviceRef, { disabled, disabledAt: disabled ? now : null, disabledByTelegramId: String(ctx.from.id), updatedAt: now, updatedBy: 'TELEGRAM_OWNER' }, { merge: true });
        if (station.exists) tx.set(stationRef, { disabled, locked: disabled, lockedAt: disabled ? now : null, lockedByTelegramId: String(ctx.from.id), updatedAt: now }, { merge: true });
        tx.set(db.collection('audit_logs').doc(), {
          action: disabled ? 'POS_STATION_LOCKED_TELEGRAM' : 'POS_STATION_UNLOCKED_TELEGRAM',
          actorType: 'TELEGRAM', telegramUserId: String(ctx.from.id), details: (disabled ? 'Locked' : 'Unlocked') + ' POS station ' + id,
          timestamp: now, severity: disabled ? 'CRITICAL' : 'WARNING'
        });
      });
      await ctx.answerCbQuery(disabled ? 'Station locked.' : 'Station unlocked.', { show_alert: true });
      await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    } catch (error) {
      logger.error('Telegram station control failed', error);
      await ctx.answerCbQuery(error instanceof Error ? error.message : 'Station control failed.', { show_alert: true });
    }
  });

  bot.command('cashier_sessions', async ctx => {
    if (!await requireManager(ctx)) return;
    const a = ctx.state.access as Access, db = getDbAdmin();
    const snap = await db.collection('pos_terminals').limit(150).get();
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as any))
      .filter(x => x.currentCashierId && x.currentRegisterSessionId && (x.status === 'OPEN' || !x.status) && canSeeBranch(a, x.branchId)).slice(0, 20);
    if (!rows.length) { await ctx.reply('No active cashier sessions found.'); return; }
    for (const x of rows) {
      await ctx.reply('ACTIVE CASHIER SESSION\nStation: ' + clean(x.name || x.id) + ' (' + x.id + ')\nCashier: ' + clean(x.currentCashierName || x.currentCashierId) +
        '\nRegister session: ' + clean(x.currentRegisterSessionId) + '\nBranch: ' + clean(x.branchName || x.branchId || 'Unassigned'),
        Markup.inlineKeyboard([[Markup.button.callback('End cashier session', 'cashier:review_end:' + x.currentRegisterSessionId)]]));
    }
  });
  bot.command('end_cashier_session', async ctx => {
    if (!await requireManager(ctx)) return;
    const id = commandText(ctx).split(/\s+/)[1] || '';
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) { await ctx.reply('Usage: /end_cashier_session REGISTER_SESSION_ID'); return; }
    const snap = await getDbAdmin().collection('register_sessions').doc(id).get();
    if (!snap.exists || snap.data()?.status !== 'OPEN') { await ctx.reply('Open register session not found.'); return; }
    if (!canSeeBranch(ctx.state.access as Access, snap.data()?.branchId)) { await ctx.reply('Session is outside your branch access.'); return; }
    await ctx.reply('Confirm ending cashier session ' + id + ' at terminal ' + clean(snap.data()?.terminalId) + '? The terminal will return to its staff sign-in screen; the station itself remains enabled.',
      Markup.inlineKeyboard([[Markup.button.callback('Confirm end session', 'cashier:confirm_end:' + id), Markup.button.callback('Cancel', 'cashier:cancel:' + id)]]));
  });
  bot.action(/^cashier:review_end:([A-Za-z0-9_-]+)$/, async ctx => {
    if (!await requireManager(ctx)) { await ctx.answerCbQuery('Management access unavailable.', { show_alert: true }); return; }
    const id = (ctx.match as RegExpMatchArray)[1];
    const snap = await getDbAdmin().collection('register_sessions').doc(id).get();
    if (!snap.exists || snap.data()?.status !== 'OPEN') { await ctx.answerCbQuery('Session is no longer open.', { show_alert: true }); return; }
    if (!canSeeBranch(ctx.state.access as Access, snap.data()?.branchId)) { await ctx.answerCbQuery('Outside branch access.', { show_alert: true }); return; }
    await ctx.answerCbQuery('Confirm ending the cashier session.');
    await ctx.reply('End cashier session ' + id + '? This closes the register without recording a cash count. Use /reconcile_shift for cash reconciliation.',
      Markup.inlineKeyboard([[Markup.button.callback('Confirm end', 'cashier:confirm_end:' + id), Markup.button.callback('Cancel', 'cashier:cancel:' + id)]]));
  });
  bot.action(/^cashier:cancel:([A-Za-z0-9_-]+)$/, async ctx => {
    await ctx.answerCbQuery('Cancelled.');
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
  });
  bot.action(/^cashier:confirm_end:([A-Za-z0-9_-]+)$/, async ctx => {
    if (!await requireManager(ctx)) { await ctx.answerCbQuery('Management access unavailable.', { show_alert: true }); return; }
    const id = (ctx.match as RegExpMatchArray)[1], db = getDbAdmin(), ref = db.collection('register_sessions').doc(id);
    try {
      await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists || snap.data()?.status !== 'OPEN') throw new Error('Session is no longer open.');
        const x = snap.data()!;
        if (!canSeeBranch(ctx.state.access as Access, x.branchId)) throw new Error('Session is outside your branch access.');
        const terminalId = String(x.terminalId || '');
        const terminalRef = terminalId ? db.collection('pos_terminals').doc(terminalId) : null;
        const terminal = terminalRef ? await tx.get(terminalRef) : null;
        const now = Date.now();
        tx.update(ref, { status: 'CLOSED', closedAt: now, closedByTelegramId: String(ctx.from.id), closeReason: 'REMOTE_CASHIER_SESSION_END', closeSource: 'TELEGRAM' });
        if (terminalRef && terminal?.exists && terminal.data()?.currentRegisterSessionId === id) {
          tx.update(terminalRef, { status: 'CLOSED', currentCashierId: null, currentRegisterSessionId: null, sessionEndedAt: now, sessionEndedByTelegramId: String(ctx.from.id) });
        }
        tx.set(db.collection('audit_logs').doc(), {
          action: 'CASHIER_SESSION_ENDED_TELEGRAM', actorType: 'TELEGRAM', telegramUserId: String(ctx.from.id),
          details: 'Ended register session ' + id + ' remotely without cash reconciliation.', timestamp: now, severity: 'WARNING'
        });
      });
      await ctx.answerCbQuery('Cashier session ended.', { show_alert: true });
      await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    } catch (error) {
      logger.error('Telegram cashier session termination failed', error);
      await ctx.answerCbQuery(error instanceof Error ? error.message : 'Could not end session.', { show_alert: true });
    }
  });

  // Cash reconciliation computes expected till cash from opening float plus paid cash orders.
  bot.command('reconcile_shift', async ctx => {
    if (!await requireOwner(ctx)) return;
    const parts = commandText(ctx).split(/\s+/), id = parts[1] || '', actualCash = Number(parts[2]);
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || !Number.isFinite(actualCash) || actualCash < 0 || actualCash > 100000000) {
      await ctx.reply('Usage: /reconcile_shift REGISTER_SESSION_ID ACTUAL_CASH');
      return;
    }
    const snap = await getDbAdmin().collection('register_sessions').doc(id).get();
    if (!snap.exists || snap.data()?.status !== 'OPEN') { await ctx.reply('Open register session not found.'); return; }
    if (!canSeeBranch(ctx.state.access as Access, snap.data()?.branchId)) { await ctx.reply('Outside your branch access.'); return; }
    await ctx.reply('CONFIRM SHIFT RECONCILIATION\nSession: ' + id + '\nActual cash counted: ' + money(actualCash) +
      '\nExpected cash will be calculated from opening float plus paid cash orders.',
      Markup.inlineKeyboard([[Markup.button.callback('Confirm cash count', 'shift:confirm:' + id + ':' + actualCash), Markup.button.callback('Cancel', 'shift:cancel:' + id)]]));
  });
  bot.action(/^shift:cancel:([A-Za-z0-9_-]+)$/, async ctx => {
    await ctx.answerCbQuery('Reconciliation cancelled.');
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
  });
  bot.action(/^shift:confirm:([A-Za-z0-9_-]+):([0-9]+(?:\.[0-9]{1,2})?)$/, async ctx => {
    if (!await requireOwner(ctx)) { await ctx.answerCbQuery('Owner access required.', { show_alert: true }); return; }
    const match = ctx.match as RegExpMatchArray, id = match[1], actualCash = Number(match[2]);
    const db = getDbAdmin(), sessionRef = db.collection('register_sessions').doc(id);
    try {
      const sessionSnap = await sessionRef.get();
      if (!sessionSnap.exists || sessionSnap.data()?.status !== 'OPEN') throw new Error('Session is no longer open.');
      const session = sessionSnap.data()!;
      if (!canSeeBranch(ctx.state.access as Access, session.branchId)) throw new Error('Session is outside your branch access.');
      const orders = await db.collection('orders').where('registerSessionId', '==', id).limit(500).get();
      const cashSales = orders.docs.reduce((sum, d) => {
        const x = d.data(), method = String(x.paymentMethod || '').toUpperCase();
        const isCash = method.includes('CASH') || Number(x.cashTendered || 0) > 0;
        if (!isCash) return sum;
        if (x.status === 'REFUNDED' || x.paymentStatus === 'REFUNDED') return sum - Number(x.total || 0);
        if (x.status === 'PAID' || x.paymentStatus === 'PAID' || x.status === 'PARTIALLY_REFUNDED') {
          return sum + Number(x.total || 0) - Number(x.refundedAmount || x.refundTotal || 0);
        }
        return sum;
      }, 0);
      const expectedCash = Number(session.openingCash || 0) + cashSales;
      const variance = actualCash - expectedCash, now = Date.now();
      const reconciliationRef = db.collection('reconciliations').doc();
      await db.runTransaction(async tx => {
        const current = await tx.get(sessionRef);
        if (!current.exists || current.data()?.status !== 'OPEN') throw new Error('Session was already closed by another operator.');
        const terminalId = String(current.data()?.terminalId || '');
        const terminalRef = terminalId ? db.collection('pos_terminals').doc(terminalId) : null;
        const terminal = terminalRef ? await tx.get(terminalRef) : null;
        tx.update(sessionRef, {
          status: 'CLOSED', closedAt: now, closingCash: actualCash, expectedCash, variance,
          reconciliationId: reconciliationRef.id, closedByTelegramId: String(ctx.from.id), closeSource: 'TELEGRAM'
        });
        tx.set(reconciliationRef, {
          userId: 'TELEGRAM', actorType: 'TELEGRAM', telegramUserId: String(ctx.from.id),
          registerSessionId: id, terminalId, timestamp: now, expectedCash, actualCash, variance,
          status: Math.abs(variance) < 1 ? 'STABLE' : 'DISCREPANCY',
          branchId: String(current.data()?.branchId || ''), cashierId: String(current.data()?.cashierId || current.data()?.cashierName || ''),
          notes: 'Telegram shift reconciliation. Cash sales analysed: ' + orders.size
        });
        if (terminalRef && terminal?.exists && terminal.data()?.currentRegisterSessionId === id) {
          tx.update(terminalRef, { status: 'CLOSED', closingCash: actualCash, currentCashierId: null, currentRegisterSessionId: null, sessionEndedAt: now });
        }
        tx.set(db.collection('audit_logs').doc(), {
          action: 'SHIFT_RECONCILED_TELEGRAM', actorType: 'TELEGRAM', telegramUserId: String(ctx.from.id),
          details: 'Reconciled session ' + id + ': expected ' + expectedCash + ', actual ' + actualCash + ', variance ' + variance,
          timestamp: now, severity: Math.abs(variance) < 1 ? 'INFO' : 'CRITICAL'
        });
      });
      const resultText = 'SHIFT RECONCILED\nExpected: ' + money(expectedCash) + '\nCounted: ' + money(actualCash) + '\nVariance: ' + money(variance);
      await ctx.answerCbQuery('Shift reconciled.', { show_alert: true });
      await ctx.reply(resultText);
      await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
      if (Math.abs(variance) >= 1) await broadcast(bot, 'CASH VARIANCE ALERT\nSession: ' + id + '\nExpected: ' + money(expectedCash) + '\nCounted: ' + money(actualCash) + '\nVariance: ' + money(variance), String(session.branchId || '') || undefined);
    } catch (error) {
      logger.error('Telegram shift reconciliation failed', error);
      await ctx.answerCbQuery(error instanceof Error ? error.message : 'Reconciliation failed.', { show_alert: true });
    }
  });

  bot.command('reconciliations', async ctx => {
    if (!await requireManager(ctx)) return;
    const a = ctx.state.access as Access;
    const snap = await getDbAdmin().collection('reconciliations').limit(100).get();
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as any))
      .filter(x => canSeeBranch(a, x.branchId)).sort((x, y) => Number(y.timestamp || 0) - Number(x.timestamp || 0)).slice(0, 12);
    if (!rows.length) { await ctx.reply('No reconciliation records found.'); return; }
    await ctx.reply(['CASH RECONCILIATION HISTORY', ...rows.map(x =>
      '• ' + clean(x.registerSessionId || x.id) + ' | ' + clean(x.status) + ' | expected ' + money(Number(x.expectedCash || 0)) +
      ' | counted ' + money(Number(x.actualCash || 0)) + ' | variance ' + money(Number(x.variance || 0))
    )].join('\n'));
  });

  // Incidents are stored in the same owner-visible feed as app telemetry.
  bot.command('incidents', async ctx => {
    if (!await requireManager(ctx)) return;
    const db = getDbAdmin(), a = ctx.state.access as Access;
    const [open, acknowledged] = await Promise.all([
      db.collection('system_incidents').where('status', '==', 'OPEN').limit(20).get(),
      db.collection('system_incidents').where('status', '==', 'ACKNOWLEDGED').limit(20).get()
    ]);
    const rows = [...open.docs, ...acknowledged.docs].filter(d => canSeeBranch(a, d.data().branchId))
      .sort((x, y) => Number(y.data().createdAt || 0) - Number(x.data().createdAt || 0)).slice(0, 15);
    if (!rows.length) { await ctx.reply('No open or acknowledged incidents.'); return; }
    for (const d of rows) {
      const x = d.data();
      await ctx.reply('INCIDENT | ' + clean(x.severity || 'WARNING') + '\n' + clean(x.category) + ': ' + clean(x.message) +
        '\nStatus: ' + clean(x.status) + '\nReference: ' + d.id,
        Markup.inlineKeyboard([[
          ...(x.status === 'OPEN' ? [Markup.button.callback('Acknowledge', 'incident:acknowledge:' + d.id)] : []),
          Markup.button.callback('Resolve', 'incident:resolve:' + d.id)
        ]]));
    }
  });
  bot.action(/^incident:(acknowledge|resolve):([A-Za-z0-9_-]+)$/, async ctx => {
    if (!await requireManager(ctx)) { await ctx.answerCbQuery('Management access unavailable.', { show_alert: true }); return; }
    const a = ctx.state.access as Access, match = ctx.match as RegExpMatchArray;
    const next = match[1] === 'resolve' ? 'RESOLVED' : 'ACKNOWLEDGED', id = match[2], db = getDbAdmin();
    try {
      await db.runTransaction(async tx => {
        const ref = db.collection('system_incidents').doc(id), snap = await tx.get(ref);
        if (!snap.exists) throw new Error('Incident not found.');
        if (!canSeeBranch(a, snap.data()?.branchId)) throw new Error('Incident is outside your branch access.');
        if (snap.data()?.status === 'RESOLVED') throw new Error('Incident is already resolved.');
        const now = Date.now();
        tx.update(ref, { status: next, ...(next === 'RESOLVED' ? { resolvedAt: now, resolvedBy: 'TELEGRAM:' + ctx.from.id } : { acknowledgedAt: now, acknowledgedBy: 'TELEGRAM:' + ctx.from.id }) });
        tx.set(db.collection('audit_logs').doc(), {
          action: 'INCIDENT_' + next + '_TELEGRAM', actorType: 'TELEGRAM', telegramUserId: String(ctx.from.id),
          details: next + ' incident ' + id, timestamp: now, severity: next === 'RESOLVED' ? 'INFO' : 'WARNING'
        });
      });
      await ctx.answerCbQuery('Incident ' + next.toLowerCase() + '.', { show_alert: true });
      await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    } catch (error) {
      logger.error('Telegram incident update failed', error);
      await ctx.answerCbQuery(error instanceof Error ? error.message : 'Incident update failed.', { show_alert: true });
    }
  });

  bot.command('raise_incident', async ctx => {
    if (!await requireManager(ctx)) return;
    const message = commandText(ctx).replace(/^\/raise_incident(?:@\w+)?\s*/i, '').trim();
    if (message.length < 8 || message.length > 500) { await ctx.reply('Usage: /raise_incident Describe the operational or system incident (8–500 characters).'); return; }
    const a = ctx.state.access as Access, db = getDbAdmin(), now = Date.now();
    const ref = await db.collection('system_incidents').add({
      incidentId: 'TG-' + now, category: 'TELEGRAM_REPORTED', message: clean(message, 500),
      route: 'telegram', status: 'OPEN', severity: 'WARNING', createdAt: now,
      userId: 'TELEGRAM', userAgent: 'Telegram bot', branchId: a.branchIds?.[0] || '',
      createdByTelegramId: String(ctx.from.id)
    });
    await db.collection('audit_logs').add({
      action: 'INCIDENT_CREATED_TELEGRAM', actorType: 'TELEGRAM', telegramUserId: String(ctx.from.id),
      details: 'Created incident ' + ref.id + ': ' + clean(message, 200), timestamp: now, severity: 'WARNING'
    });
    const result = await broadcast(bot, 'NEW OPERATIONAL INCIDENT\nReference: ' + ref.id + '\nReported by: ' + clean(a.name || ('Telegram ' + ctx.from.id)) + '\n' + clean(message, 500), a.branchIds?.[0]);
    await ctx.reply('Incident recorded: ' + ref.id + '\nManagement notifications sent: ' + result.sent + (result.failed ? '\nFailed deliveries: ' + result.failed : ''));
  });

  bot.command('emergency_alert', async ctx => {
    const a = ctx.state.access as Access;
    if (a.role !== 'OWNER') { await ctx.reply('Only a configured owner can issue an emergency alert.'); return; }
    const message = commandText(ctx).replace(/^\/emergency_alert(?:@\w+)?\s*/i, '').trim();
    if (message.length < 8 || message.length > 500) { await ctx.reply('Usage: /emergency_alert Describe the emergency (8–500 characters).'); return; }
    const db = getDbAdmin(), now = Date.now();
    const ref = await db.collection('system_incidents').add({
      incidentId: 'EMERGENCY-' + now, category: 'EMERGENCY_ALERT', message: clean(message, 500),
      route: 'telegram', status: 'OPEN', severity: 'CRITICAL', createdAt: now,
      userId: 'TELEGRAM', userAgent: 'Telegram bot', createdByTelegramId: String(ctx.from.id)
    });
    await db.collection('audit_logs').add({
      action: 'EMERGENCY_ALERT_ISSUED_TELEGRAM', actorType: 'TELEGRAM', telegramUserId: String(ctx.from.id),
      details: 'Emergency alert ' + ref.id + ': ' + clean(message, 250), timestamp: now, severity: 'CRITICAL'
    });
    const result = await broadcast(bot, '🚨 URBAN ADDRESS EMERGENCY ALERT\nReference: ' + ref.id + '\nIssued by: ' + clean(a.name || ('Owner ' + ctx.from.id)) + '\n\n' + clean(message, 500));
    await ctx.reply('Emergency alert recorded: ' + ref.id + '\nManagement notified: ' + result.sent + (result.failed ? '\nFailed deliveries: ' + result.failed : ''));
  });
}
