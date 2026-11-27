import { getDbAdmin } from '../firebase-admin';

/**
 * Telegram Bot Actions
 * Interfaces with Firebase Admin SDK to generate reports for Telegram.
 * Synchronized with master OS schema.
 */

export async function getTelegramDashboard() {
  try {
    const db = getDbAdmin();
    const startOfToday = new Date().setHours(0, 0, 0, 0);

    const [ordersSnap, jobsSnap, inventorySnap] = await Promise.all([
      db.collection('orders').where('timestamp', '>=', startOfToday).where('status', '==', 'PAID').get(),
      db.collection('carwash_jobs').where('status', '==', 'IN_PROGRESS').get(),
      db.collection('inventory').where('archived', '==', false).get()
    ]);

    const totalSales = ordersSnap.docs.reduce((sum, d) => sum + (d.data().total || 0), 0);
    const lowStock = inventorySnap.docs.filter(d => {
      const data = d.data();
      return data.unit !== 'CARWASH' && (data.stockLevel || 0) <= (data.minStock || 0);
    }).length;

    return `🛡️ *DASHBOARD SUMMARY*\n` +
           `_${new Date().toLocaleDateString('en-KE')}_\n\n` +
           `💰 *Revenue:* KES ${totalSales.toLocaleString()}\n` +
           `🧾 *Orders:* ${ordersSnap.size}\n` +
           `🚗 *Active Jobs:* ${jobsSnap.size}\n` +
           `📦 *Low Stock:* ${lowStock} items\n\n` +
           `_Sync Node: HQ-NAKURU_`;
  } catch (err) {
    console.error('[TELEGRAM_ACTION_ERROR] Dashboard:', err);
    throw err;
  }
}

export async function getTelegramLowStock() {
  try {
    const db = getDbAdmin();
    const inventorySnap = await db.collection('inventory')
      .where('archived', '==', false)
      .get();

    const lowItems = inventorySnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((item: any) => item.unit !== 'CARWASH' && (item.stockLevel || 0) <= (item.minStock || 0))
      .slice(0, 15);

    if (lowItems.length === 0) return "✅ *Inventory Healthy*\nAll items above threshold.";

    let report = "⚠️ *LOW STOCK ALERTS*\n\n";
    lowItems.forEach((item: any) => {
      report += `• *${item.name}*\n`;
      report += `  Stock: ${item.stockLevel} (Min: ${item.minStock}) | Dept: ${item.unit}\n\n`;
    });

    return report;
  } catch (err) {
    console.error('[TELEGRAM_ACTION_ERROR] LowStock:', err);
    throw err;
  }
}

export async function getTelegramSalesBreakdown() {
  try {
    const db = getDbAdmin();
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const ordersSnap = await db.collection('orders')
      .where('timestamp', '>=', startOfToday)
      .where('status', '==', 'PAID')
      .get();

    const stats = { LOUNGE: 0, STORE: 0, CARWASH: 0 };
    ordersSnap.forEach(doc => {
      const data = doc.data();
      const type = data.type as keyof typeof stats;
      if (type in stats) {
        stats[type] += (data.total || 0);
      }
    });

    return `📊 *SALES BREAKDOWN*\n` +
           `_Today's Shift Yield_\n\n` +
           `☕ *Lounge:* KES ${stats.LOUNGE.toLocaleString()}\n` +
           `🛍️ *Store:* KES ${stats.STORE.toLocaleString()}\n` +
           `🧼 *Carwash:* KES ${stats.CARWASH.toLocaleString()}\n\n` +
           `📈 *Total:* KES ${(stats.LOUNGE + stats.STORE + stats.CARWASH).toLocaleString()}`;
  } catch (err) {
    console.error('[TELEGRAM_ACTION_ERROR] Sales:', err);
    throw err;
  }
}

export async function getTelegramPendingExpenses() {
  try {
    const db = getDbAdmin();
    const requestsSnap = await db.collection('petty_cash')
      .where('status', '==', 'PENDING')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    if (requestsSnap.empty) return "💎 *Treasury Clear*\nNo pending petty cash requests.";

    let report = "💸 *PENDING EXPENSES*\n\n";
    requestsSnap.forEach(doc => {
      const data = doc.data();
      report += `🔸 *KES ${data.amount.toLocaleString()}*\n`;
      report += `   Memo: ${data.reason}\n`;
      report += `   Staff: ${data.requesterName}\n\n`;
    });

    return report;
  } catch (err) {
    console.error('[TELEGRAM_ACTION_ERROR] Expenses:', err);
    throw err;
  }
}
