import { NextRequest, NextResponse } from 'next/server';
import { bot } from '@/lib/telegram/bot';
import { getDbAdmin } from '@/lib/firebase-admin';
import { getTelegramDashboard, getTelegramSalesBreakdown, getTelegramPendingExpenses, getTelegramStationSalesReport, getTelegramCashierAnalyticsReport, getTelegramTopItems12HourReport } from '@/lib/telegram/actions';
import { getTelegramWeeklySummary, getTelegramHourlyClientOrders, getTelegramAllCashierHeldBills } from '@/lib/telegram/extended-actions';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const requestedPeriod = req.nextUrl.searchParams.get('period');
    const isAnalytics = ['station-sales', 'cashier-hourly', 'top-items-12h'].includes(String(requestedPeriod));
    const period = requestedPeriod === 'morning' ? 'MORNING OPERATIONS BRIEF'
      : requestedPeriod === 'hourly' || requestedPeriod === 'cashier-hourly' ? 'HOURLY OPERATIONS PULSE'
      : requestedPeriod === 'weekly' ? 'WEEKLY BUSINESS REVIEW'
      : requestedPeriod === 'station-sales' ? 'POS STATION SALES | 15-MINUTE REPORT'
      : requestedPeriod === 'top-items-12h' ? 'TOP SELLING ITEMS | 12-HOUR REPORT'
      : 'EVENING BUSINESS CLOSE';
    const [dashboard, sales, expenses, weekly, clientOrders, heldBills, stationSales, cashierAnalytics, topItems] = await Promise.all([
      isAnalytics ? Promise.resolve('') : getTelegramDashboard(),
      isAnalytics ? Promise.resolve('') : getTelegramSalesBreakdown(),
      isAnalytics ? Promise.resolve('') : getTelegramPendingExpenses(),
      requestedPeriod === 'weekly' ? getTelegramWeeklySummary() : Promise.resolve(''),
      requestedPeriod === 'hourly' ? getTelegramHourlyClientOrders() : Promise.resolve(''),
      requestedPeriod === 'hourly' ? getTelegramAllCashierHeldBills() : Promise.resolve(''),
      requestedPeriod === 'station-sales' ? getTelegramStationSalesReport() : Promise.resolve(''),
      requestedPeriod === 'cashier-hourly' ? getTelegramCashierAnalyticsReport() : Promise.resolve(''),
      requestedPeriod === 'top-items-12h' ? getTelegramTopItems12HourReport() : Promise.resolve('')
    ]);
    const db = getDbAdmin();
    const recipients = new Map<string, string>();
    try {
      const env = JSON.parse(process.env.TELEGRAM_USER_ACCESS || '{}') as Record<string, { role?: string }>;
      for (const [id, value] of Object.entries(env)) {
        if (/^\d{1,20}$/.test(id) && ['OWNER', 'MANAGER'].includes(String(value.role || '').toUpperCase())) recipients.set(id, String(value.role).toUpperCase());
      }
    } catch { logger.warn('Invalid TELEGRAM_USER_ACCESS JSON while building daily summary'); }
    String(process.env.OWNER_TELEGRAM_IDS || '').split(/[;,\s]+/).filter(id => /^\d{1,20}$/.test(id)).forEach(id => recipients.set(id, 'OWNER'));
    const databaseAccess = await db.collection('telegram_user_access').get();
    for (const user of databaseAccess.docs) {
      const value = user.data();
      if (value.enabled === false) { recipients.delete(user.id); continue; }
      const role = String(value.role || '').toUpperCase();
      if (['OWNER', 'MANAGER'].includes(role)) recipients.set(user.id, role);
    }
    const [telegramHealth, databaseHealth] = await Promise.allSettled([
      bot.telegram.getMe(),
      db.collection('users').limit(1).get()
    ]);
    const health = `Telegram Bot: ${telegramHealth.status === 'fulfilled' ? 'ONLINE' : 'ERROR'}\nFirestore: ${databaseHealth.status === 'fulfilled' ? 'ONLINE' : 'ERROR'}\nVercel Environment: ${process.env.VERCEL_ENV || 'unknown'}\nDeployment: ${process.env.VERCEL_URL || 'not supplied'}`;
    if (telegramHealth.status === 'rejected') logger.error('Telegram bot health check failed', telegramHealth.reason);
    if (databaseHealth.status === 'rejected') logger.error('Firestore health check failed', databaseHealth.reason);
    const date = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', dateStyle: 'full', timeStyle: 'short' });
    const analytics = [stationSales, cashierAnalytics, topItems].filter(Boolean).join('\n\n');
    const message = isAnalytics ? `${period}\n${date}\n\n${analytics}` : `${period}\n${date}\n\n🖥 SYSTEM HEALTH\n${health}\n\n📊 OPERATIONS SUMMARY\n${dashboard}\n\n💳 SALES & CLIENT ORDERS\n${requestedPeriod === 'weekly' ? weekly : sales}${requestedPeriod === 'hourly' ? `\n\n🛍 CLIENT ORDERS (LAST HOUR)\n${clientOrders}\n\n🧾 HELD BILLS — ALL CASHIERS\n${heldBills}` : ''}\n\n💰 PETTY CASH & APPROVAL QUEUE\n${expenses}`;
    const results = await Promise.allSettled([...recipients.keys()].map(id => bot.telegram.sendMessage(id, message)));
    const failed = results.filter(x => x.status === 'rejected').length;
    await db.collection('audit_logs').add({
      action: 'TELEGRAM_SCHEDULED_REPORT_SENT', actorType: 'SYSTEM',
      details: `${period}: sent to ${results.length - failed}/${results.length} management recipients`,
      timestamp: Date.now(), severity: failed ? 'WARNING' : 'INFO'
    });
    return NextResponse.json({ ok: true, period, sent: results.length - failed, failed, recipients: recipients.size });
  } catch (error) {
    logger.error('Telegram scheduled report failed', error);
    return NextResponse.json({ error: 'Report delivery failed' }, { status: 500 });
  }
}
