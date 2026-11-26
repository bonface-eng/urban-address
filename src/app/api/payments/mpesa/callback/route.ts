import { NextRequest, NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase-admin';
import { markOrderPaid } from '@/lib/payment-server';
import { notifyTelegramOperations } from '@/lib/telegram/notifications';
export const runtime = 'nodejs';

function darajaBase() {
  return process.env.MPESA_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
}
async function getToken() {
  const key = process.env.MPESA_CONSUMER_KEY, secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error('MPESA_CREDENTIALS_MISSING');
  const response = await fetch(darajaBase() + '/oauth/v1/generate?grant_type=client_credentials', {
    headers: { Authorization: 'Basic ' + Buffer.from(key + ':' + secret).toString('base64') }, cache: 'no-store'
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error('MPESA_AUTH_FAILED');
  return data.access_token as string;
}
function timestamp() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)?.value || '';
  return part('year') + part('month') + part('day') + part('hour') + part('minute') + part('second');
}
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const callback = payload?.Body?.stkCallback;
    const checkoutId = String(callback?.CheckoutRequestID || '');
    if (!checkoutId) return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    const db = getDbAdmin();
    const query = await db.collection('orders').where('checkoutRequestId', '==', checkoutId).limit(1).get();
    if (query.empty) return NextResponse.json({ ResultCode: 0, ResultDesc: 'Unknown request ignored' });
    const orderDoc = query.docs[0];
    if (Number(callback.ResultCode) !== 0) {
      await orderDoc.ref.update({ paymentStatus: 'FAILED', paymentFailureReason: String(callback.ResultDesc || 'Payment cancelled'), paymentFailedAt: Date.now() });
      await notifyTelegramOperations({ type: 'PAYMENT', title: 'M-Pesa payment failed', message: `Order ${orderDoc.id} payment failed: ${String(callback.ResultDesc || 'Payment cancelled').slice(0, 180)}.`, severity: 'WARNING' });
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Failure recorded' });
    }
    const shortcode = process.env.MPESA_SHORTCODE, passkey = process.env.MPESA_PASSKEY;
    if (!shortcode || !passkey) throw new Error('MPESA_CONFIGURATION_INCOMPLETE');
    const ts = timestamp();
    const password = Buffer.from(shortcode + passkey + ts).toString('base64');
    const token = await getToken();
    const verify = await fetch(darajaBase() + '/mpesa/stkpushquery/v1/query', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ BusinessShortCode: shortcode, Password: password, Timestamp: ts, CheckoutRequestID: checkoutId }),
      cache: 'no-store'
    });
    const verified = await verify.json();
    if (!verify.ok || String(verified.ResultCode) !== '0') throw new Error('MPESA_PROVIDER_VERIFICATION_FAILED');
    const metadata = callback.CallbackMetadata?.Item || [];
    const getValue = (name: string) => metadata.find((item: any) => item.Name === name)?.Value;
    const amount = Number(getValue('Amount'));
    const receipt = String(getValue('MpesaReceiptNumber') || '');
    const phone = String(getValue('PhoneNumber') || '');
    if (!Number.isSafeInteger(amount) || !receipt) throw new Error('MPESA_CALLBACK_METADATA_INVALID');
    await markOrderPaid({ orderId: orderDoc.id, provider: 'MPESA', amount, receipt, phone, providerTransactionId: checkoutId });
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Payment verified' });
  } catch (error) {
    console.error('[MPESA_CALLBACK_ERROR]', error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Callback received for reconciliation' });
  }
}
