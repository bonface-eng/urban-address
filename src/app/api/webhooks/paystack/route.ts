import { NextRequest, NextResponse } from 'next/server';
import * as admin from '@/lib/db/admin';
import crypto from 'crypto';
import { notifyTelegramOperations } from '@/lib/telegram/notifications';

export const runtime = 'nodejs';

function initAdmin() {
  return admin.getAdminApp();
}

export async function POST(req: NextRequest) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const signature = req.headers.get('x-paystack-signature');
  if (!secret || !signature) {
    return NextResponse.json({ message: 'Webhook authentication is not configured.' }, { status: 401 });
  }

  const body = await req.text();
  const expected = crypto.createHmac('sha512', secret).update(body).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, 'hex');
  } catch {
    return NextResponse.json({ message: 'Invalid signature.' }, { status: 401 });
  }
  if (received.length !== expected.length || !crypto.timingSafeEqual(expected, received)) {
    return NextResponse.json({ message: 'Invalid signature.' }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ message: 'Invalid JSON payload.' }, { status: 400 });
  }

  try {
    const db = admin.firestore(initAdmin()!);
    switch (event.event) {
      case 'charge.success':
        await handleChargeSuccess(db, event.data);
        break;
      case 'refund.processed':
        await handleRefundProcessed(db, event.data);
        break;
      case 'charge.failed':
        await handleChargeFailed(db, event.data);
        break;
      case 'transfer.success':
        await handleTransferSuccess(db, event.data);
        break;
      default:
        break;
    }
    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (error) {
    console.error('[PAYSTACK_WEBHOOK_ERROR]', error);
    return NextResponse.json({ message: 'Webhook processing failed; retry later.' }, { status: 500 });
  }
}

async function handleChargeSuccess(db: admin.firestore.Firestore, data: any) {
  const reference = typeof data?.reference === 'string' ? data.reference : '';
  const amount = Number(data?.amount);
  if (!reference || !Number.isSafeInteger(amount) || data?.currency !== 'KES') {
    throw new Error('Invalid charge payload.');
  }

  const query = await db.collection('orders').where('paymentRef', '==', reference).limit(1).get();
  if (query.empty) throw new Error('Order reference not found.');
  const orderDoc = query.docs[0];
  await db.runTransaction(async transaction => {
    const fresh = await transaction.get(orderDoc.ref);
    const order = fresh.data();
    if (!order) throw new Error('Order not found.');
    const expectedAmount = Number(order.amountKobo ?? (Number(order.total) * 100));
    if (!Number.isSafeInteger(expectedAmount) || expectedAmount !== amount) {
      throw new Error('Payment amount does not match the order.');
    }
    if (order.status === 'PAID') return;

    transaction.update(orderDoc.ref, {
      status: 'PAID',
      paidAt: Date.now(),
      gatewayResponse: 'WEBHOOK_VERIFIED',
      inventorySynced: true
    });
    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        if (!item?.productId || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
          throw new Error('Invalid order item.');
        }
        transaction.update(db.collection('inventory').doc(String(item.productId)), {
          stockLevel: admin.firestore.FieldValue.increment(-Number(item.quantity)),
          updatedAt: Date.now()
        });
      }
    }
  });

  await db.collection('audit_logs').add({
    action: 'PAYMENT_WEBHOOK_SYNC',
    userId: 'SYSTEM',
    details: `Verified Paystack payment for order ${orderDoc.id}; amount minor units ${amount}.`,
    timestamp: Date.now(),
    severity: 'INFO'
  });
}

async function handleRefundProcessed(db: admin.firestore.Firestore, data: any) {
  const reference = data?.transaction_reference;
  if (typeof reference !== 'string' || !reference) throw new Error('Invalid refund reference.');
  const query = await db.collection('orders').where('paymentRef', '==', reference).limit(1).get();
  if (query.empty) return;
  await query.docs[0].ref.update({ status: 'REFUNDED', refundedAt: Date.now() });
  await notifyTelegramOperations({ type: 'PAYMENT', title: 'Payment refund processed', message: `Refund confirmed for payment reference ${reference}.`, severity: 'WARNING' });
  await db.collection('audit_logs').add({
    action: 'REFUND_WEBHOOK_SYNC',
    userId: 'SYSTEM',
    details: `Confirmed refund for reference ${reference}.`,
    timestamp: Date.now(),
    severity: 'WARNING'
  });
}

async function handleChargeFailed(db: admin.firestore.Firestore, data: any) {
  const reference = typeof data?.reference === 'string' ? data.reference : '';
  if (!reference) return;
  const query = await db.collection('orders').where('paymentRef', '==', reference).limit(1).get();
  if (query.empty) return;
  const order = query.docs[0];
  await order.ref.update({ paymentStatus: 'FAILED', paymentFailureReason: String(data?.gateway_response || data?.message || 'Payment failed').slice(0, 240), paymentFailedAt: Date.now() });
  await notifyTelegramOperations({ type: 'PAYMENT', title: 'Paystack payment failed', message: `Order ${order.id} payment failed: ${String(data?.gateway_response || data?.message || 'Payment failed').slice(0, 180)}.`, severity: 'WARNING' });
}

async function handleTransferSuccess(db: admin.firestore.Firestore, data: any) {
  const recipientCode = data?.recipient?.recipient_code || 'UNKNOWN';
  const amount = Number(data?.amount) || 0;
  const reference = String(data?.reference || '');
  await db.collection('audit_logs').add({
    action: 'PAYOUT_WEBHOOK_SYNC',
    userId: 'SYSTEM',
    details: `Successful payout to ${recipientCode}; minor units ${amount}; reference ${reference}.`,
    timestamp: Date.now(),
    severity: 'INFO'
  });
}
