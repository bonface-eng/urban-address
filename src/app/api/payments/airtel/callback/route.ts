import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDbAdmin } from '@/lib/firebase-admin';
import { markOrderPaid } from '@/lib/payment-server';
export const runtime = 'nodejs';

function airtelBase() {
  return process.env.AIRTEL_ENV === 'production' ? 'https://openapi.airtel.africa' : 'https://openapiuat.airtel.africa';
}
async function airtelToken() {
  const clientId = process.env.AIRTEL_CLIENT_ID, clientSecret = process.env.AIRTEL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('AIRTEL_CREDENTIALS_MISSING');
  const response = await fetch(airtelBase() + '/auth/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }), cache: 'no-store'
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error('AIRTEL_AUTH_FAILED');
  return data.access_token as string;
}
export async function POST(request: NextRequest) {
  try {
    const configuredToken = process.env.AIRTEL_CALLBACK_TOKEN;
    const suppliedToken = request.nextUrl.searchParams.get('token') || '';
    if (!configuredToken || suppliedToken.length !== configuredToken.length ||
      !crypto.timingSafeEqual(Buffer.from(suppliedToken), Buffer.from(configuredToken))) {
      return NextResponse.json({ message: 'Unauthorized callback' }, { status: 401 });
    }
    const payload = await request.json();
    const transactionId = String(payload?.transactionId || payload?.data?.transaction?.id || '');
    const reference = String(payload?.reference || '');
    const status = String(payload?.status || payload?.data?.transaction?.status || '').toUpperCase();
    if (!transactionId || !reference) return NextResponse.json({ received: true });
    const db = getDbAdmin();
    const orderQuery = await db.collection('orders').where('airtelTransactionId', '==', transactionId).limit(1).get();
    if (orderQuery.empty) return NextResponse.json({ received: true });
    const orderDoc = orderQuery.docs[0];
    if (orderDoc.id !== reference) return NextResponse.json({ message: 'Reference mismatch' }, { status: 400 });
    if (!['SUCCESS', 'SUCCESSFUL', 'COMPLETED'].includes(status)) {
      if (['FAILED', 'FAILURE', 'CANCELLED'].includes(status)) {
        await orderDoc.ref.update({ paymentStatus: 'FAILED', paymentFailureReason: 'Airtel Money reported ' + status, paymentFailedAt: Date.now() });
      }
      return NextResponse.json({ received: true });
    }
    const token = await airtelToken();
    const verifyResponse = await fetch(airtelBase() + '/merchant/v2/transactions/' + encodeURIComponent(transactionId), {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', 'X-Country': 'KE', 'X-Currency': 'KES' },
      cache: 'no-store'
    });
    const verified = await verifyResponse.json();
    const transaction = verified?.data?.transaction || verified?.data;
    const verifiedStatus = String(transaction?.status || '').toUpperCase();
    const amount = Number(transaction?.amount);
    if (!verifyResponse.ok || !['SUCCESS', 'SUCCESSFUL', 'COMPLETED'].includes(verifiedStatus) || amount !== Number(orderDoc.data()?.total)) {
      throw new Error('AIRTEL_PROVIDER_VERIFICATION_FAILED');
    }
    await markOrderPaid({
      orderId: orderDoc.id, provider: 'AIRTEL_MONEY', amount,
      receipt: String(transaction?.airtelMoneyId || transaction?.reference || transactionId),
      phone: String(payload?.phone || payload?.subscriber?.msisdn || ''),
      providerTransactionId: transactionId
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[AIRTEL_CALLBACK_ERROR]', error);
    return NextResponse.json({ received: true, reconciliationRequired: true });
  }
}
