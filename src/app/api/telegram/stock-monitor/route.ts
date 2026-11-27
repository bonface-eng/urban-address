import { NextRequest, NextResponse } from 'next/server';
import { bot } from '@/lib/telegram/bot';
import { getDbAdmin } from '@/lib/db/admin';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

type Recipient = { role: string; branchIds: string[] };
const clean = (value: unknown, max = 100) => String(value ?? '').replace(/[<>\r\n]/g, ' ').trim().slice(0, max);

async function recipients() {
  const db = getDbAdmin();
  const map = new Map<string, Recipient>();
  try {
    const configured = JSON.parse(process.env.TELEGRAM_USER_ACCESS || '{}') as Record<string, any>;
    for (const [id, value] of Object.entries(configured)) {
      const role = String(value?.role || '').toUpperCase();
      if (/^\d{1,20}$/.test(id) && ['OWNER', 'MANAGER'].includes(role)) {
        map.set(id, { role, branchIds: Array.isArray(value.branchIds) ? value.branchIds.map(String) : [] });
      }
    }
  } catch { logger.error('Invalid Telegram access JSON in stock monitor'); }
  String(process.env.OWNER_TELEGRAM_IDS || '').split(/[;,\s]+/).filter(id => /^\d{1,20}$/.test(id))
    .forEach(id => map.set(id, { role: 'OWNER', branchIds: [] }));
  const snap = await db.collection('telegram_user_access').get();
  for (const doc of snap.docs) {
    const value = doc.data();
    if (value.enabled === false) { map.delete(doc.id); continue; }
    const role = String(value.role || '').toUpperCase();
    if (['OWNER', 'MANAGER'].includes(role)) {
      map.set(doc.id, { role, branchIds: Array.isArray(value.branchIds) ? value.branchIds.map(String) : [] });
    }
  }
  return map;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== 'Bearer ' + secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const db = getDbAdmin();
    const [inventory, access] = await Promise.all([
      db.collection('inventory').get(),
      recipients()
    ]);
    if (!access.size) return NextResponse.json({ ok: true, alerts: 0, reason: 'No management recipients configured.' });
    const now = Date.now();
    let sent = 0, recovered = 0, failed = 0, skipped = 0;
    for (const productDoc of inventory.docs) {
      const product = productDoc.data();
      if (product.archived === true || String(product.unit || '').toUpperCase() === 'CARWASH') continue;
      const stock = Number(product.stockLevel || 0), minimum = Number(product.minStock || 0);
      if (!Number.isFinite(stock) || !Number.isFinite(minimum)) continue;
      const low = stock <= minimum;
      const stateRef = db.collection('telegram_stock_alert_state').doc(productDoc.id);
      const stateSnap = await stateRef.get();
      const previous = stateSnap.data() || {};
      const branchId = String(product.branchId || '');
      const targets = [...access.entries()].filter(([, value]) =>
        value.role === 'OWNER' || !branchId || value.branchIds.length === 0 || value.branchIds.includes(branchId)
      ).map(([id]) => id);
      if (!low) {
        if (previous.active === true) {
          await stateRef.set({ active: false, recoveredAt: now, currentStock: stock, minimumStock: minimum, leaseUntil: null }, { merge: true });
          recovered++;
        }
        continue;
      }
      if (Number(previous.lastSentAt || 0) > now - 6 * 60 * 60 * 1000 || Number(previous.leaseUntil || 0) > now) {
        skipped++;
        continue;
      }
      const claimed = await db.runTransaction(async tx => {
        const snap = await tx.get(stateRef), value = snap.data() || {};
        if (Number(value.lastSentAt || 0) > now - 6 * 60 * 60 * 1000 || Number(value.leaseUntil || 0) > now) return false;
        tx.set(stateRef, { leaseUntil: now + 45_000, lastAttemptAt: now, productId: productDoc.id }, { merge: true });
        return true;
      });
      if (!claimed) { skipped++; continue; }
      const message = [
        '⚠️ URBAN ADDRESS | LOW STOCK ALERT',
        'Item: ' + clean(product.name || productDoc.id),
        'Available: ' + stock,
        'Reorder level: ' + minimum,
        'Department: ' + clean(product.unit || 'Unassigned'),
        'Branch: ' + clean(product.branchName || branchId || 'Unassigned'),
        'Action: Review replenishment or submit an approved stock adjustment.'
      ].join('\n');
      const results = await Promise.allSettled(targets.map(id => bot.telegram.sendMessage(id, message)));
      const delivered = results.filter(x => x.status === 'fulfilled').length;
      const rejected = results.length - delivered;
      if (delivered > 0) {
        await stateRef.set({ active: true, lastSentAt: now, currentStock: stock, minimumStock: minimum, leaseUntil: null, delivered, failed: rejected }, { merge: true });
        sent += delivered;
      } else {
        await stateRef.set({ leaseUntil: null, failed: rejected, lastErrorAt: now }, { merge: true });
        failed += rejected;
      }
    }
    return NextResponse.json({ ok: true, lowStockAlertsSent: sent, recoveredItems: recovered, failedDeliveries: failed, skipped: skipped });
  } catch (error) {
    logger.error('Telegram stock monitor failed', error);
    return NextResponse.json({ error: 'Stock monitor failed.' }, { status: 500 });
  }
}
