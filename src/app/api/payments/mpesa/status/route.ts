import { NextRequest, NextResponse } from 'next/server';
import * as admin from '@/lib/db/admin';
import { getAdminApp, getDbAdmin } from '@/lib/db/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const user = await admin.auth(getAdminApp()).verifyIdToken(token);
    const orderId = String(request.nextUrl.searchParams.get('orderId') || '');
    if (!orderId || orderId.length > 128) return NextResponse.json({ error: 'Invalid order reference.' }, { status: 400 });
    const order = await getDbAdmin().collection('orders').doc(orderId).get();
    if (!order.exists) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    const data = order.data()!;
    if (data.customerId !== user.uid && data.cashierId !== user.uid) return NextResponse.json({ error: 'Order access denied.' }, { status: 403 });
    return NextResponse.json({ status: String(data.status || 'PENDING'), paymentStatus: String(data.paymentStatus || ''), paymentFailureReason: data.paymentFailureReason ? String(data.paymentFailureReason) : null }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch {
    return NextResponse.json({ error: 'Unable to check payment status.' }, { status: 401 });
  }
}
