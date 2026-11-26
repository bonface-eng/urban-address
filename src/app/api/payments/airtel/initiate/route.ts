import { NextRequest, NextResponse } from 'next/server';
import { authenticatePaymentRequest, getOwnedPendingOrder, normalizeKenyanPhone } from '@/lib/payment-server';
export const runtime = 'nodejs';

function airtelBase() {
  return process.env.AIRTEL_ENV === 'production' ? 'https://openapi.airtel.africa' : 'https://openapiuat.airtel.africa';
}
async function airtelToken() {
  const clientId = process.env.AIRTEL_CLIENT_ID, clientSecret = process.env.AIRTEL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('AIRTEL_CREDENTIALS_MISSING');
  const response = await fetch(airtelBase() + '/auth/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
    cache: 'no-store'
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error('AIRTEL_AUTH_FAILED');
  return data.access_token as string;
}
export async function POST(request: NextRequest) {
  try {
    const user = await authenticatePaymentRequest(request);
    const body = await request.json();
    const phone = normalizeKenyanPhone(body.phone);
    const { ref, order, amount } = await getOwnedPendingOrder(String(body.orderId || ''), user.uid);
    if (order.paymentMethod !== 'AIRTEL_MONEY') throw new Error('PAYMENT_METHOD_MISMATCH');
    if (!process.env.AIRTEL_CALLBACK_TOKEN) throw new Error('AIRTEL_CALLBACK_TOKEN_MISSING. Configure a private callback URL in the Airtel developer portal.');
    const token = await airtelToken();
    const transactionId = 'UA' + ref.id + Date.now().toString(36);
    const response = await fetch(airtelBase() + '/merchant/v2/payments/KE', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json',
        'X-Country': 'KE', 'X-Currency': 'KES'
      },
      body: JSON.stringify({
        reference: ref.id,
        subscriber: { country: 'KE', currency: 'KES', msisdn: phone },
        transaction: { amount: String(amount), country: 'KE', currency: 'KES', id: transactionId, type: 'MerchantPayment' }
      }),
      cache: 'no-store'
    });
    const result = await response.json();
    const transaction = result?.data?.transaction;
    if (!response.ok || !transaction?.id) {
      console.error('[AIRTEL_COLLECTION_INIT_FAILED]', result);
      return NextResponse.json({ success: false, message: transaction?.message || result?.message || 'Airtel Money request could not be initiated.' }, { status: 502 });
    }
    await ref.update({
      paymentProvider: 'AIRTEL_MONEY',
      paymentPhone: phone,
      paymentRef: transaction.id,
      airtelTransactionId: transaction.id,
      paymentStatus: 'AWAITING_PAYMENT',
      paymentInitiatedAt: Date.now(),
      airtelInitialStatus: transaction.status || 'PENDING'
    });
    return NextResponse.json({ success: true, message: transaction.message || 'Airtel Money payment request sent. Approve it on your phone.', transactionId: transaction.id, status: transaction.status || 'PENDING' });
  } catch (error: any) {
    const message = error.message || 'AIRTEL_INITIATION_FAILED';
    const status = message === 'AUTH_REQUIRED' ? 401 : message === 'ORDER_ACCESS_DENIED' ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
