import { NextRequest, NextResponse } from 'next/server';
import * as admin from '@/lib/db/admin';
import { getAdminApp, getDbAdmin } from '@/lib/db/admin';
import { notifyTelegramSale } from '@/lib/telegram/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const header = request.headers.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const decoded = await admin.auth(getAdminApp()).verifyIdToken(token);
    const body = await request.json();
    const orderId = String(body.orderId || '').trim();
    if (!orderId || orderId.length > 128) return NextResponse.json({ error: 'A valid sale reference is required.' }, { status: 400 });
    const orderSnap = await getDbAdmin().collection('orders').doc(orderId).get();
    if (!orderSnap.exists) return NextResponse.json({ error: 'Sale not found.' }, { status: 404 });
    const order = orderSnap.data()!;
    if (order.status !== 'PAID' && order.paymentStatus !== 'PAID') return NextResponse.json({ error: 'Only completed sales can be reported.' }, { status: 409 });
    const staffSnap = await getDbAdmin().collection('users').doc(decoded.uid).get();
    const role = String(staffSnap.data()?.role || '').toUpperCase();
    const isManager = ['ADMIN','MANAGER','SUPERVISOR'].includes(role);
    if (String(order.cashierId || '') !== decoded.uid && !isManager) return NextResponse.json({ error: 'You are not allowed to report this sale.' }, { status: 403 });
    const result = await notifyTelegramSale(orderId);
    return NextResponse.json({ ok: result.failed === 0, ...result, ...(result.failed ? { error: 'Telegram delivery failed for one or more recipients.' } : {}) }, { status: result.failed ? 502 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[TELEGRAM_SALE_NOTIFY]', error);
    return NextResponse.json({ error: 'Unable to dispatch the sale notification.' }, { status: 500 });
  }
}
