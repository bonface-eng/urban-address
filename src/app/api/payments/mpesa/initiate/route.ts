import { NextRequest, NextResponse } from 'next/server';
import { authenticatePaymentRequest, getOwnedPendingOrder, normalizeKenyanPhone, publicBaseUrl } from '@/lib/payment-server';
export const runtime = 'nodejs';

function darajaBase() {
  return process.env.MPESA_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
}
function darajaTimestamp() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)?.value || '';
  return part('year') + part('month') + part('day') + part('hour') + part('minute') + part('second');
}
async function getToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error('MPESA_CREDENTIALS_MISSING');
  const response = await fetch(darajaBase() + '/oauth/v1/generate?grant_type=client_credentials', {
    headers: { Authorization: 'Basic ' + Buffer.from(key + ':' + secret).toString('base64') },
    cache: 'no-store'
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error('MPESA_AUTH_FAILED');
  return data.access_token as string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticatePaymentRequest(request);
    const body = await request.json();
    const phone = normalizeKenyanPhone(body.phone);
    const { db, ref, order, amount } = await getOwnedPendingOrder(String(body.orderId || ''), user.uid);
    if (order.paymentMethod !== 'MPESA') throw new Error('PAYMENT_METHOD_MISMATCH');
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const callbackUrl = process.env.MPESA_CALLBACK_URL || publicBaseUrl() + '/api/payments/mpesa/callback';
    if (!shortcode || !passkey || !callbackUrl.startsWith('https://')) throw new Error('MPESA_CONFIGURATION_INCOMPLETE');
    const timestamp = darajaTimestamp();
    const password = Buffer.from(shortcode + passkey + timestamp).toString('base64');
    const token = await getToken();
    const accountReference = ('UA' + ref.id).slice(0, 12);
    const response = await fetch(darajaBase() + '/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: accountReference,
        TransactionDesc: 'Urban Address order ' + ref.id.slice(-10)
      }),
      cache: 'no-store'
    });
    const result = await response.json();
    if (!response.ok || result.ResponseCode !== '0' || !result.CheckoutRequestID) {
      console.error('[MPESA_STK_INIT_FAILED]', result);
      return NextResponse.json({ success: false, message: result.errorMessage || result.ResponseDescription || 'M-Pesa request could not be initiated.' }, { status: 502 });
    }
    await ref.update({
      paymentProvider: 'MPESA',
      paymentPhone: phone,
      paymentRef: result.CheckoutRequestID,
      merchantRequestId: result.MerchantRequestID || null,
      checkoutRequestId: result.CheckoutRequestID,
      paymentStatus: 'AWAITING_PAYMENT',
      paymentInitiatedAt: Date.now()
    });
    return NextResponse.json({ success: true, message: result.CustomerMessage || 'M-Pesa prompt sent. Enter your M-Pesa PIN on your phone.', checkoutRequestId: result.CheckoutRequestID });
  } catch (error: any) {
    const message = error.message || 'MPESA_INITIATION_FAILED';
    const status = message === 'AUTH_REQUIRED' ? 401 : message === 'ORDER_ACCESS_DENIED' ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
