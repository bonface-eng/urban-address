import { getDbAdmin } from '../firebase-admin';

function nairobiDayStart(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  return new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00+03:00`).getTime();
}
const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
const kes = (v: number) => 'KES ' + Math.round(v).toLocaleString('en-KE');

export async function getTelegramDashboard() {
  const db = getDbAdmin();
  const start = nairobiDayStart();
  // Query each source independently; avoid the orders timestamp+status composite index.
  const results = await Promise.allSettled([
    db.collection('orders').where('timestamp', '>=', start).get(),
    db.collection('carwash_jobs').where('status', '==', 'IN_PROGRESS').get(),
    db.collection('inventory').get()
  ]);
  const orders = results[0].status === 'fulfilled' ? results[0].value.docs.filter(d => d.data().status === 'PAID') : [];
  const activeJobs = results[1].status === 'fulfilled' ? results[1].value.size : null;
  const lowStock = results[2].status === 'fulfilled' ? results[2].value.docs.filter(d => {
    const x = d.data();
    return x.archived !== true && x.unit !== 'CARWASH' && num(x.stockLevel) <= num(x.minStock);
  }).length : null;
  const revenue = orders.reduce((sum, d) => sum + num(d.data().total), 0);
  const date = new Intl.DateTimeFormat('en-KE', { timeZone: 'Africa/Nairobi', dateStyle: 'full' }).format(new Date());
  const lines = [
    'URBAN ADDRESS | OPERATIONS DASHBOARD', date, '',
    `Revenue today: ${kes(revenue)}`, `Paid orders: ${orders.length}`,
    `Active carwash jobs: ${activeJobs === null ? 'Unavailable' : activeJobs}`,
    `Low-stock items: ${lowStock === null ? 'Unavailable' : lowStock}`
  ];
  if (results.some(x => x.status === 'rejected')) lines.push('', 'Some telemetry sources are unavailable. Check server logs for [TELEGRAM_REPORT_ERROR].');
  results.forEach((r, i) => { if (r.status === 'rejected') console.error('[TELEGRAM_REPORT_ERROR]', ['orders','carwash_jobs','inventory'][i], r.reason); });
  return lines.join('\n');
}

export async function getTelegramLowStock() {
  const snap = await getDbAdmin().collection('inventory').get();
  const low = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((x: any) =>
    x.archived !== true && x.unit !== 'CARWASH' && num(x.stockLevel) <= num(x.minStock)
  ).slice(0, 15);
  if (!low.length) return 'INVENTORY STATUS\nAll active stock items are above their restock thresholds.';
  return 'LOW STOCK | RESTOCK REQUIRED\n\n' + low.map((x: any) =>
    `${String(x.name || x.id)}\nStock: ${num(x.stockLevel)} | Minimum: ${num(x.minStock)} | Department: ${String(x.unit || 'Unassigned')}`
  ).join('\n\n');
}

export async function getTelegramSalesBreakdown() {
  const snap = await getDbAdmin().collection('orders').where('timestamp', '>=', nairobiDayStart()).get();
  const stats: Record<string, number> = { LOUNGE: 0, STORE: 0, CARWASH: 0 };
  snap.forEach(d => {
    const x = d.data(), type = String(x.type || '').toUpperCase();
    if (x.status === 'PAID' && Object.prototype.hasOwnProperty.call(stats, type)) stats[type] += num(x.total);
  });
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  return ['SALES BREAKDOWN | TODAY (EAT)', `Lounge: ${kes(stats.LOUNGE)}`, `Store: ${kes(stats.STORE)}`,
    `Carwash: ${kes(stats.CARWASH)}`, '', `Total revenue: ${kes(total)}`].join('\n');
}

export async function getTelegramPendingExpenses() {
  const snap = await getDbAdmin().collection('petty_cash').where('status', '==', 'PENDING').limit(50).get();
  const docs = snap.docs.sort((a, b) => num(b.data().timestamp) - num(a.data().timestamp)).slice(0, 10);
  if (!docs.length) return 'TREASURY STATUS\nNo pending petty cash requests.';
  return 'PENDING TREASURY AUTHORIZATIONS\n\n' + docs.map(d => {
    const x = d.data();
    return `${kes(num(x.amount))}\nMemo: ${String(x.reason || 'No memo')}\nStaff: ${String(x.requesterName || 'Staff')}\nRequest: ${d.id}`;
  }).join('\n\n');
}


type PaidOrderRow = { id: string; data: any };
async function getPaidOrdersSince(cutoff: number): Promise<PaidOrderRow[]> {
  const snap = await getDbAdmin().collection('orders')
    .where('timestamp', '>=', cutoff)
    .orderBy('timestamp', 'desc')
    .limit(3000)
    .get();
  return snap.docs
    .filter(doc => doc.data().status === 'PAID' || doc.data().paymentStatus === 'PAID')
    .map(doc => ({ id: doc.id, data: doc.data() }));
}

export async function getTelegramStationSalesReport() {
  const now = Date.now();
  const orders = await getPaidOrdersSince(now - 15 * 60 * 1000);
  const groups = new Map<string, { name: string; count: number; total: number }>();
  for (const { data } of orders) {
    const id = String(data.terminalId || data.terminalName || 'UNASSIGNED');
    const name = String(data.terminalName || data.terminalId || 'Unassigned POS station');
    const group = groups.get(id) || { name, count: 0, total: 0 };
    group.count += 1;
    group.total += num(data.total);
    groups.set(id, group);
  }
  const rows = [...groups.values()].sort((a,b) => b.total - a.total);
  return [
    'POS STATION SALES | LAST 15 MINUTES',
    new Date(now).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }),
    `Paid transactions: ${orders.length}`,
    '',
    ...(rows.length ? rows.map(x => `${x.name} | ${x.count} sales | ${kes(x.total)}`) : ['No paid sales recorded in this 15-minute window.']),
    '',
    `TOTAL: ${kes(orders.reduce((sum, x) => sum + num(x.data.total), 0))}`,
    ...(orders.length >= 3000 ? ['Note: report is capped at the latest 3,000 orders.'] : [])
  ].join('\n');
}

export async function getTelegramCashierAnalyticsReport() {
  const now = Date.now();
  const orders = await getPaidOrdersSince(now - 60 * 60 * 1000);
  const groups = new Map<string, { name: string; count: number; total: number; units: Map<string, number> }>();
  for (const { data } of orders) {
    const id = String(data.cashierId || data.cashierName || 'UNASSIGNED');
    const name = String(data.cashierName || data.cashierId || 'Unassigned cashier');
    const group = groups.get(id) || { name, count: 0, total: 0, units: new Map<string, number>() };
    group.count += 1;
    group.total += num(data.total);
    const unit = String(data.type || 'OTHER').toUpperCase();
    group.units.set(unit, (group.units.get(unit) || 0) + num(data.total));
    groups.set(id, group);
  }
  const rows = [...groups.values()].sort((a,b) => b.total - a.total);
  return [
    'CASHIER PERFORMANCE | LAST 60 MINUTES',
    new Date(now).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }),
    `Cashiers with sales: ${rows.length} | Paid orders: ${orders.length}`,
    '',
    ...(rows.length ? rows.map(x => [
      `${x.name} | ${x.count} sales | ${kes(x.total)}`,
      `Average sale: ${kes(x.count ? x.total / x.count : 0)}`,
      ...[...x.units.entries()].map(([unit, total]) => `  ${unit}: ${kes(total)}`)
    ].join('\n')) : ['No paid cashier sales recorded in this hour.']),
    '',
    `TOTAL CASHIER SALES: ${kes(orders.reduce((sum, x) => sum + num(x.data.total), 0))}`,
    ...(orders.length >= 3000 ? ['Note: report is capped at the latest 3,000 orders.'] : [])
  ].join('\n');
}

export async function getTelegramTopItems12HourReport() {
  const now = Date.now();
  const orders = await getPaidOrdersSince(now - 12 * 60 * 60 * 1000);
  const items = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const { data } of orders) {
    const rows = Array.isArray(data.items) ? data.items : [];
    for (const item of rows) {
      const name = String(item.name || item.productName || 'Unnamed item');
      const key = String(item.productId || name).toLowerCase();
      const quantity = num(item.quantity || item.qty || 1);
      const revenue = num(item.lineTotal ?? item.total ?? (num(item.price) * quantity));
      const current = items.get(key) || { name, quantity: 0, revenue: 0 };
      current.quantity += quantity;
      current.revenue += revenue;
      items.set(key, current);
    }
  }
  const top = [...items.values()].sort((a,b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 10);
  return [
    'TOP 10 SELLING ITEMS | LAST 12 HOURS',
    new Date(now).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }),
    `Paid orders analysed: ${orders.length}`,
    '',
    ...(top.length ? top.map((x,i) => `${i+1}. ${x.name} | Qty ${x.quantity.toLocaleString('en-KE')} | ${kes(x.revenue)}`) : ['No item sales recorded in the last 12 hours.']),
    '',
    `Items ranked: ${top.length}`,
    ...(orders.length >= 3000 ? ['Note: report is capped at the latest 3,000 orders.'] : [])
  ].join('\n');
}
