import { bot } from './bot';
import { getDbAdmin } from '../firebase-admin';
import { logger } from '../logger';

type TelegramRole = 'OWNER' | 'MANAGER' | 'STAFF';
type Recipient = { id: string; role: TelegramRole; branchIds: string[] };

function legacyRecipients(): Recipient[] {
  const map: Record<string, { role?: string; branchIds?: string[] }> = {};
  try {
    const raw = JSON.parse(process.env.TELEGRAM_USER_ACCESS || '{}') as Record<string, { role?: string; branchIds?: string[] }> | null;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) Object.assign(map, raw);
  } catch { logger.error('Unable to load legacy Telegram recipients'); }
  const ownerIds = String(process.env.OWNER_TELEGRAM_IDS || '').split(/[;,\s]+/).map(id => id.trim()).filter(id => /^\d{1,20}$/.test(id));
  for (const id of ownerIds) map[id] = { role: 'OWNER', branchIds: [] };
  return Object.entries(map)
    .filter(([, value]) => ['OWNER','MANAGER','STAFF'].includes(String(value.role || '').toUpperCase()))
    .map(([id, value]) => ({ id, role: String(value.role).toUpperCase() as TelegramRole, branchIds: Array.isArray(value.branchIds) ? value.branchIds : [] }));
}

async function recipients(): Promise<Recipient[]> {
  const merged = new Map(legacyRecipients().map(user => [user.id, user]));
  try {
    const snapshot = await getDbAdmin().collection('telegram_user_access').get();
    for (const doc of snapshot.docs) {
      const value = doc.data();
      if (value.enabled === false) { merged.delete(doc.id); continue; }
      const role = String(value.role || '').toUpperCase();
      if (!['OWNER','MANAGER','STAFF'].includes(role)) continue;
      merged.set(doc.id, {
        id: doc.id,
        role: role as TelegramRole,
        branchIds: Array.isArray(value.branchIds) ? value.branchIds.filter((item: unknown) => typeof item === 'string') : [],
      });
    }
  } catch (error) {
    logger.error('Telegram database recipient lookup failed; using legacy recipients', error);
  }
  return [...merged.values()];
}

function branchMatches(user: Recipient, branchId?: string) {
  if (!branchId || user.role === 'OWNER' || user.branchIds.length === 0) return true;
  return user.branchIds.includes(branchId);
}

/** Call only from trusted server-side workflows after the business transaction commits. */
export async function notifyTelegramOperations(event: {
  type: 'SALE' | 'PAYMENT' | 'CARWASH' | 'INVENTORY' | 'SECURITY';
  title: string;
  message: string;
  branchId?: string;
  severity?: 'INFO'|'WARNING'|'CRITICAL';
  managementOnly?: boolean;
}) {
  const targets = (await recipients()).filter(user => (!event.managementOnly || user.role === 'OWNER' || user.role === 'MANAGER') && branchMatches(user, event.branchId));
  const text = `${event.severity === 'CRITICAL' ? 'URGENT' : event.severity === 'WARNING' ? 'ATTENTION' : 'UPDATE'} | ${event.title}\n${event.message}${event.branchId ? `\nBranch: ${event.branchId}` : ''}`;
  const results = await Promise.allSettled(targets.map(user => bot.telegram.sendMessage(user.id, text)));
  const failed = results.filter(result => result.status === 'rejected').length;
  if (failed) logger.warn('Some Telegram operational notifications failed', { type: event.type, failed, total: targets.length });
  return { sent: targets.length - failed, failed };
}

function money(value: unknown) {
  return Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 });
}

/** Idempotent, branch-aware sale notification. Successfully delivered recipients are not repeated on retry. */
export async function notifyTelegramSale(orderId: string) {
  const db = getDbAdmin();
  const orderRef = db.collection('orders').doc(orderId);
  const notificationRef = db.collection('telegram_sale_notifications').doc(orderId);
  try {
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) throw new Error('Sale order not found');
    const order = orderSnap.data()!;
    if (order.status !== 'PAID' && order.paymentStatus !== 'PAID') throw new Error('Only paid sales can trigger Telegram notifications');

    const claim = await db.runTransaction(async transaction => {
      const snap = await transaction.get(notificationRef);
      const state = snap.data() || {};
      if (state.status === 'SENT') return { claimed: false, delivered: [] as string[] };
      if (state.status === 'PROCESSING' && Number(state.leaseUntil || 0) > Date.now()) return { claimed: false, delivered: [] as string[] };
      const delivered = Array.isArray(state.deliveredRecipientIds) ? state.deliveredRecipientIds.map(String) : [];
      transaction.set(notificationRef, {
        orderId, status: 'PROCESSING', leaseUntil: Date.now() + 45_000,
        attemptCount: Number(state.attemptCount || 0) + 1, updatedAt: Date.now(),
      }, { merge: true });
      return { claimed: true, delivered };
    });
    if (!claim.claimed) return { sent: 0, failed: 0, skipped: true };

    const allRecipients = (await recipients()).filter(user => branchMatches(user, order.branchId ? String(order.branchId) : undefined));
    const targets = allRecipients.filter(user => !claim.delivered.includes(user.id));
    if (!targets.length && !claim.delivered.length) {
      await notificationRef.set({ status: 'FAILED', leaseUntil: null, lastError: 'No Telegram recipients are configured for this branch.', updatedAt: Date.now() }, { merge: true });
      return { sent: 0, failed: 1 };
    }

    let branchName = String(order.branchName || '');
    if (!branchName && order.branchId) {
      const branch = await db.collection('branches').doc(String(order.branchId)).get().catch(() => null);
      branchName = branch?.exists ? String(branch.data()?.name || '') : '';
    }
    let stationName = String(order.terminalName || '');
    if (!stationName && order.terminalId) {
      const station = await db.collection('terminal_devices').doc(String(order.terminalId)).get().catch(() => null);
      stationName = station?.exists ? String(station.data()?.name || station.data()?.terminalName || station.data()?.label || '') : '';
    }
    stationName = stationName || String(order.terminalId || 'UNASSIGNED POS STATION');
    const items = Array.isArray(order.items) ? order.items : [];
    const itemLines = items.slice(0, 12).map((item: any) => `• ${String(item.name || 'Item').slice(0, 70)} × ${Number(item.quantity || 0)} — KES ${money(Number(item.price || 0) * Number(item.quantity || 0))}`);
    if (items.length > 12) itemLines.push(`• +${items.length - 12} more item(s)`);
    const time = new Date(Number(order.paidAt || order.timestamp || Date.now())).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', dateStyle: 'medium', timeStyle: 'short' });
    const text = [
      `URBAN ADDRESS | SALE | ${stationName.toUpperCase()}`,
      `Sale: #${orderId.slice(-10).toUpperCase()}`,
      `Unit: ${String(order.type || 'POS').replace('-', ' ')}`,
      `Amount: KES ${money(order.total)}`,
      `Payment: ${String(order.paymentProvider || order.paymentMethod || '—').replace('_', ' ')}`,
      `Cashier: ${String(order.cashierName || 'Not recorded')} (${String(order.cashierId || '—')})`,
      `POS station: ${stationName}`,
      `Register session: ${String(order.registerSessionId || '—')}`,
      `Branch: ${branchName || order.branchId || 'Not assigned'}`,
      ...(order.tableNumber ? [`Table: ${String(order.tableNumber)}`] : []),
      ...(order.plateNumber ? [`Vehicle: ${String(order.plateNumber)}`] : []),
      ...(order.attendantName ? [`Attendant: ${String(order.attendantName)}`] : []),
      '',
      'ITEMS',
      ...(itemLines.length ? itemLines : ['• Items not recorded']),
      '',
      `Time: ${time}`,
      `Reference: ${String(order.paymentReceipt || order.paymentRef || order.providerTransactionId || orderId)}`,
    ].join('\n');

    const results = await Promise.all(targets.map(async user => {
      let lastError: unknown = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await bot.telegram.sendMessage(user.id, text);
          return { id: user.id, ok: true as const };
        } catch (error) {
          lastError = error;
          if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 500));
        }
      }
      logger.warn('Telegram sale notification delivery failed after retries', { orderId, telegramUserId: user.id, error: lastError });
      return { id: user.id, ok: false as const };
    }));
    const delivered = results.filter(result => result.ok).map(result => result.id);
    const failed = results.length - delivered.length;
    const allDelivered = [...new Set([...claim.delivered, ...delivered])];
    await notificationRef.set({
      deliveredRecipientIds: allDelivered,
      sentCount: allDelivered.length,
      failedCount: failed,
      status: failed === 0 ? 'SENT' : 'FAILED',
      sentAt: failed === 0 ? Date.now() : null,
      leaseUntil: null,
      lastError: failed ? `${failed} Telegram recipient(s) could not be reached.` : null,
      updatedAt: Date.now(),
    }, { merge: true });
    return { sent: delivered.length, failed };
  } catch (error) {
    logger.error('Telegram sale notification failed', { orderId, error });
    await notificationRef.set({ status: 'FAILED', leaseUntil: null, lastError: error instanceof Error ? error.message.slice(0, 300) : 'Notification failed', updatedAt: Date.now() }, { merge: true }).catch(() => undefined);
    return { sent: 0, failed: 1 };
  }
}
