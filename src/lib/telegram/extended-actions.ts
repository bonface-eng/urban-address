import { getDbAdmin } from '../firebase-admin';

const clean = (value: unknown, max = 90) => String(value ?? '—').replace(/[<>\r\n]/g, ' ').slice(0, max);
const money = (value: unknown) => Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 });
const time = (value: unknown) => new Date(Number(value || 0)).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });

export async function getTelegramOnlineReport() {
  const snap = await getDbAdmin().collection('telegram_presence')
    .where('lastSeenAt', '>=', Date.now() - 4 * 60_000).orderBy('lastSeenAt', 'desc').limit(200).get();
  const groups = { CUSTOMER: [] as string[], STAFF: [] as string[], ADMIN: [] as string[] };
  for (const doc of snap.docs) {
    const x = doc.data();
    const key = x.category === 'ADMIN' ? 'ADMIN' : x.category === 'STAFF' ? 'STAFF' : 'CUSTOMER';
    groups[key].push(`• ${clean(x.displayName)} | ${clean(x.role)} | ${time(x.lastSeenAt)}`);
  }
  return ['LIVE ACCOUNTS (last 4 minutes)', `Total: ${snap.size}`, '', `CUSTOMERS (${groups.CUSTOMER.length})`, ...(groups.CUSTOMER.length ? groups.CUSTOMER : ['• None']), '', `STAFF (${groups.STAFF.length})`, ...(groups.STAFF.length ? groups.STAFF : ['• None']), '', `ADMINS (${groups.ADMIN.length})`, ...(groups.ADMIN.length ? groups.ADMIN : ['• None'])].join('\n');
}

export async function getTelegramJobsReport() {
  const snap = await getDbAdmin().collection('carwash_jobs').limit(100).get();
  const active = snap.docs.filter(d => ['PENDING','ASSIGNED','IN_PROGRESS','IN PROGRESS'].includes(String(d.data().status || '').toUpperCase()));
  if (!active.length) return 'CARWASH JOBS\nNo active jobs found in the latest 100 records.';
  return 'ACTIVE CARWASH JOBS\n\n' + active.slice(0, 20).map(d => {
    const x = d.data();
    return `Job: ${clean(d.id)} | ${clean(x.status)}\nVehicle: ${clean(x.plateNumber || x.plate)}\nService: ${clean(x.serviceName || x.service)}\nAttendant: ${clean(x.attendantName || x.assignedAttendant || 'Unassigned')}\nAmount: KES ${money(x.amount || x.total)}`;
  }).join('\n\n');
}

export async function getTelegramAttendantsReport() {
  const snap = await getDbAdmin().collection('carwash_jobs').limit(200).get();
  const counts = new Map<string, { active: number; completed: number }>();
  for (const d of snap.docs) {
    const x = d.data();
    const name = clean(x.attendantName || x.assignedAttendant || x.attendantId || '');
    if (name === '—') continue;
    const item = counts.get(name) || { active: 0, completed: 0 };
    const status = String(x.status || '').toUpperCase();
    if (['COMPLETED','COMPLETE','DONE'].includes(status)) item.completed++;
    else if (['PENDING','ASSIGNED','IN_PROGRESS','IN PROGRESS'].includes(status)) item.active++;
    counts.set(name, item);
  }
  if (!counts.size) return 'ATTENDANT PERFORMANCE\nNo attendant assignments found in the latest 200 carwash jobs.';
  return 'ATTENDANT PERFORMANCE (latest 200 jobs)\n\n' + [...counts.entries()].sort((a,b) => b[1].completed - a[1].completed).slice(0,20).map(([name,x]) => `${name}\nActive: ${x.active} | Completed: ${x.completed}`).join('\n\n');
}

export async function getTelegramPaymentsReport() {
  const snap = await getDbAdmin().collection('orders').orderBy('timestamp','desc').limit(100).get();
  const rows = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  const pending = rows.filter((x:any) => !['PAID','COMPLETED','SUCCESS','SUCCESSFUL'].includes(String(x.status || x.paymentStatus || '').toUpperCase()));
  const paid = rows.filter((x:any) => ['PAID','COMPLETED','SUCCESS','SUCCESSFUL'].includes(String(x.status || x.paymentStatus || '').toUpperCase()));
  const pendingValue = pending.reduce((n:number,x:any) => n + Number(x.total || x.amount || 0),0);
  return ['PAYMENT MONITOR | latest 100 orders', `Paid/complete: ${paid.length}`, `Pending/other: ${pending.length}`, `Pending value (indicative): KES ${money(pendingValue)}`, '', 'LATEST UNCONFIRMED / NON-PAID', ...(pending.slice(0,12).map((x:any) => `• ${clean(x.id,24)} | ${clean(x.status || x.paymentStatus)} | KES ${money(x.total || x.amount)}`))].join('\n');
}

export async function getTelegramAlertsReport() {
  const since = Date.now() - 24 * 60 * 60_000;
  const snap = await getDbAdmin().collection('audit_logs').where('timestamp','>=',since).orderBy('timestamp','desc').limit(100).get();
  const alerts = snap.docs.filter(d => ['WARNING','ERROR','CRITICAL','HIGH'].includes(String(d.data().severity || '').toUpperCase()) || /FAILED|DENIED|REJECTED|SECURITY|REFUND|DISCREPANCY/i.test(String(d.data().action || '')));
  if (!alerts.length) return 'SECURITY & OPERATIONS ALERTS\nNo warning-level or matching events found in the latest 100 audit records from the last 24 hours.';
  return 'SECURITY & OPERATIONS ALERTS | last 24 hours\n\n' + alerts.slice(0,20).map(d => {
    const x=d.data();
    return `[${clean(x.severity || 'NOTICE',16)}] ${clean(x.action)}\nBy: ${clean(x.actorName || x.userName || x.actorType || 'Unknown')}\n${clean(x.details || x.description,180)}\n${time(x.timestamp)}`;
  }).join('\n\n');
}

export async function getTelegramHealthReport() {
  const db = getDbAdmin();
  const [database, presence, audit] = await Promise.allSettled([
    db.collection('users').limit(1).get(),
    db.collection('telegram_presence').limit(1).get(),
    db.collection('audit_logs').limit(1).get()
  ]);
  const lines = ['URBAN ADDRESS | SYSTEM HEALTH', `Firestore users: ${database.status === 'fulfilled' ? 'ONLINE' : 'ERROR'}`, `Presence store: ${presence.status === 'fulfilled' ? 'ONLINE' : 'ERROR'}`, `Audit store: ${audit.status === 'fulfilled' ? 'ONLINE' : 'ERROR'}`, `Telegram token: ${process.env.TELEGRAM_BOT_TOKEN ? 'CONFIGURED' : 'MISSING'}`, `Webhook secret: ${(process.env.TELEGRAM_WEBHOOK_SECRET || '').length >= 32 ? 'CONFIGURED' : 'MISSING / INVALID'}`, `Environment: ${clean(process.env.VERCEL_ENV || 'unknown')}`, `Checked: ${new Date().toLocaleString('en-KE',{timeZone:'Africa/Nairobi'})}`];
  return lines.join('\n');
}


export async function getTelegramWeeklySummary() {
  const start = Date.now() - 7 * 24 * 60 * 60_000;
  const snap = await getDbAdmin().collection('orders').where('timestamp', '>=', start).orderBy('timestamp', 'desc').limit(1000).get();
  const paid = snap.docs.filter(d => ['PAID','COMPLETED','SUCCESS','SUCCESSFUL'].includes(String(d.data().status || d.data().paymentStatus || '').toUpperCase()));
  const totals = new Map<string, number>();
  for (const d of paid) {
    const x = d.data();
    const unit = String(x.type || 'OTHER').toUpperCase();
    totals.set(unit, (totals.get(unit) || 0) + Number(x.total || x.amount || 0));
  }
  const revenue = [...totals.values()].reduce((sum, value) => sum + value, 0);
  const byUnit = [...totals.entries()].map(([unit, value]) => `${unit}: KES ${money(value)}`);
  return ['WEEKLY BUSINESS PERFORMANCE | last 7 days', `Paid transactions: ${paid.length}`, ...byUnit, `Total recorded revenue: KES ${money(revenue)}`, '', 'Note: This is based on the latest 1,000 order records and recorded paid statuses; it is not a provider settlement statement.'].join('\n');
}


export async function getTelegramHourlyClientOrders() {
  const db = getDbAdmin();
  const cutoff = Date.now() - 60 * 60_000;
  const snap = await db.collection('orders').where('timestamp', '>=', cutoff).orderBy('timestamp', 'desc').limit(150).get();
  const clientOrders = snap.docs.filter(doc => {
    const x = doc.data();
    return typeof x.customerId === 'string' && x.customerId.length > 0 && !x.cashierId;
  });
  if (!clientOrders.length) return 'CLIENT ORDERS | LAST 60 MINUTES\nNo new direct client orders were recorded in the last hour.';
  return ['CLIENT ORDERS | LAST 60 MINUTES', `Orders: ${clientOrders.length}`, '', ...clientOrders.slice(0, 40).map(doc => {
    const x = doc.data();
    const customer = clean(x.customerName || x.customer || 'Client');
    const status = clean(x.status || x.paymentStatus || 'PENDING');
    const dept = clean(x.type || 'ORDER');
    return `• ${clean(doc.id, 24)} | ${dept} | ${status}\n  ${customer} | KES ${money(x.total || x.amount)} | ${time(x.timestamp)}`;
  })].join('\n');
}

export async function getTelegramAllCashierHeldBills() {
  const snap = await getDbAdmin().collectionGroup('held_bills').limit(300).get();
  const groups = new Map<string, { name: string; bills: Array<{ id: string; department: string; customer: string; amount: number; timestamp: number; status: string }> }>();
  for (const doc of snap.docs) {
    const x = doc.data();
    const cashierId = doc.ref.parent.parent?.id || String(x.cashierId || 'unknown');
    const cashierName = clean(x.cashierName || x.createdByName || cashierId);
    const group = groups.get(cashierId) || { name: cashierName, bills: [] };
    group.bills.push({
      id: doc.id,
      department: clean(x.type || 'POS'),
      customer: clean(x.customerName || x.plateNumber || x.vehicleNumber || 'Walk-in'),
      amount: Number(x.total || x.amount || 0),
      timestamp: Number(x.timestamp || x.createdAt || x.updatedAt || 0),
      status: clean(x.status || 'HELD')
    });
    groups.set(cashierId, group);
  }
  const sorted = [...groups.values()].sort((a,b) => a.name.localeCompare(b.name));
  const total = sorted.reduce((sum, group) => sum + group.bills.length, 0);
  if (!total) return 'HELD BILLS | ALL CASHIERS\nNo held bills are currently recorded.';
  const lines = ['HELD BILLS | ALL CASHIERS', `Cashiers: ${sorted.length} | Held bills: ${total}`, ''];
  for (const group of sorted) {
    lines.push(`CASHIER: ${group.name} (${group.bills.length})`);
    for (const bill of group.bills.sort((a,b) => b.timestamp-a.timestamp).slice(0, 20)) {
      lines.push(`• ${bill.id.slice(-12)} | ${bill.department} | ${bill.status}\n  ${bill.customer} | KES ${money(bill.amount)}${bill.timestamp ? ` | ${time(bill.timestamp)}` : ''}`);
    }
    lines.push('');
  }
  lines.push('Scope: latest 300 held-bill records across cashier accounts.');
  return lines.join('\n');
}
