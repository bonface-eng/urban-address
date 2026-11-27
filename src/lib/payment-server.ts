import * as admin from '@/lib/db/admin';
import { NextRequest } from 'next/server';
import { getAdminApp, getDbAdmin } from '@/lib/db/admin';
import { paymentReceiptEmail } from '@/lib/email/templates';
import { sendTransactionalEmail } from '@/lib/resend';
import { notifyTelegramSale } from '@/lib/telegram/notifications';

export async function authenticatePaymentRequest(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new Error('AUTH_REQUIRED');
  const decoded = await admin.auth(getAdminApp()).verifyIdToken(token);
  return decoded;
}

export function normalizeKenyanPhone(input: unknown) {
  const digits = String(input || '').replace(/\D/g, '');
  if (/^0[17]\d{8}$/.test(digits)) return '254' + digits.slice(1);
  if (/^[17]\d{8}$/.test(digits)) return '254' + digits;
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  throw new Error('Enter a valid Kenyan mobile number, e.g. 07XXXXXXXX or 2547XXXXXXXX.');
}

export async function getOwnedPendingOrder(orderId: string, uid: string) {
  if (!orderId || orderId.length > 128) throw new Error('INVALID_ORDER');
  const db = getDbAdmin();
  const ref = db.collection('orders').doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('ORDER_NOT_FOUND');
  const order = snap.data()!;
  if (order.customerId !== uid && order.cashierId !== uid) throw new Error('ORDER_ACCESS_DENIED');
  if (order.status === 'PAID' || order.paymentStatus === 'PAID') throw new Error('ORDER_ALREADY_PAID');
  if (order.paymentStatus !== 'AWAITING_PAYMENT') throw new Error('ORDER_NOT_PAYABLE');
  if (!Array.isArray(order.items) || order.items.length === 0) throw new Error('ORDER_ITEMS_REQUIRED');
  let calculatedTotal = 0;
  const inventoryRows = await Promise.all(order.items.map(async (item: any) => {
    const productId = String(item?.productId || '');
    const quantity = Number(item?.quantity);
    if (!productId || !Number.isSafeInteger(quantity) || quantity < 1) throw new Error('INVALID_ORDER_ITEM');
    const productSnap = await db.collection('inventory').doc(productId).get();
    if (!productSnap.exists) throw new Error('PRODUCT_NOT_FOUND: ' + productId);
    const product = productSnap.data()!;
    const price = Number(product.price);
    if (product.archived === true || !Number.isFinite(price) || price < 0) throw new Error('PRODUCT_UNAVAILABLE: ' + productId);
    if (Number(item.price) !== price) throw new Error('PRODUCT_PRICE_CHANGED: ' + String(product.name || item.name));
    if (!Number.isFinite(Number(product.stockLevel)) || Number(product.stockLevel) < quantity) throw new Error('INSUFFICIENT_STOCK: ' + String(product.name || item.name));
    return { price, quantity };
  }));
  for (const row of inventoryRows) calculatedTotal += row.price * row.quantity;
  if (!Number.isSafeInteger(calculatedTotal) || calculatedTotal < 1 || Number(order.total) !== calculatedTotal) {
    throw new Error('ORDER_TOTAL_MISMATCH');
  }
  await ref.update({ paymentAmount: calculatedTotal, amountCurrency: 'KES' });
  return { db, ref, order, amount: calculatedTotal };
}

export async function markOrderPaid(input: {
  orderId: string;
  provider: 'MPESA' | 'AIRTEL_MONEY';
  amount: number;
  receipt?: string | null;
  phone?: string | null;
  providerTransactionId?: string | null;
}) {
  const db = getDbAdmin();
  const orderRef = db.collection('orders').doc(input.orderId);
  const outboxRef = db.collection('email_outbox').doc('payment-receipt-' + input.orderId);
  await db.runTransaction(async transaction => {
    const [orderSnap, outboxSnap] = await Promise.all([transaction.get(orderRef), transaction.get(outboxRef)]);
    if (!orderSnap.exists) throw new Error('ORDER_NOT_FOUND');
    const order = orderSnap.data()!;
    if (order.status === 'PAID' || order.paymentStatus === 'PAID') return;
    const carwashJobRef = order.type === 'CARWASH' ? db.collection('carwash_jobs').doc(input.orderId) : null;
    const heldBillRef = order.cashierId ? db.collection('users').doc(String(order.cashierId)).collection('held_bills').doc(input.orderId) : null;
    const [carwashJobSnap, heldBillSnap] = await Promise.all([
      carwashJobRef ? transaction.get(carwashJobRef) : Promise.resolve(null),
      heldBillRef ? transaction.get(heldBillRef) : Promise.resolve(null),
    ]);
    if (Number(order.paymentAmount ?? order.total) !== input.amount) throw new Error('PAYMENT_AMOUNT_MISMATCH');
    if (order.paymentMethod !== input.provider) throw new Error('PAYMENT_PROVIDER_MISMATCH');

    const items = Array.isArray(order.items) ? order.items : [];
    const productRefs = items.filter((item: any) => item?.productId)
      .map((item: any) => db.collection('inventory').doc(String(item.productId)));
    const productSnaps = await Promise.all(productRefs.map((ref: any) => transaction.get(ref)));
    let index = 0;
    for (const item of items) {
      if (!item?.productId) continue;
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('INVALID_ORDER_ITEM');
      const productSnap = productSnaps[index++];
      if (productSnap.exists) transaction.update(productSnap.ref, {
        stockLevel: admin.firestore.FieldValue.increment(-quantity),
        updatedAt: Date.now()
      });
    }

    transaction.update(orderRef, {
      status: 'PAID', paymentStatus: 'PAID', paidAt: Date.now(),
      paymentProvider: input.provider, paymentReceipt: input.receipt || null,
      providerTransactionId: input.providerTransactionId || null, paidPhone: input.phone || null,
      inventorySynced: true, gatewayResponse: 'PROVIDER_VERIFIED'
    });
    if (heldBillRef && heldBillSnap?.exists) transaction.delete(heldBillRef);
    if (carwashJobRef && !carwashJobSnap?.exists) {
      transaction.create(carwashJobRef, {
        orderId: input.orderId, jobType: order.jobType || 'VEHICLE',
        plateNumber: order.plateNumber || '', vehicleMake: order.vehicleMake || '',
        vehicleModel: order.vehicleModel || '', vehicleColor: order.vehicleColor || '',
        carpetDimensions: order.carpetDimensions || null,
        service: items.length === 1 ? String(items[0].name || 'Carwash service') : `${items.length} Services`,
        price: input.amount, commission: Number(order.commission || 0),
        status: 'QUEUED', attendantId: order.attendantId || 'Unassigned',
        attendantName: order.attendantName || 'Unassigned', timestamp: Date.now(),
        customerId: order.customerId || null,
      });
    }
    if (!outboxSnap.exists) transaction.create(outboxRef, {
      type: 'PAYMENT_RECEIPT', orderId: input.orderId, status: 'PENDING',
      createdAt: Date.now(), attemptCount: 0
    });
  });

  await notifyTelegramSale(input.orderId);

  await db.collection('audit_logs').add({
    action: 'PAYMENT_WEBHOOK_SYNC', userId: 'SYSTEM',
    details: `Verified ${input.provider} payment for order ${input.orderId}; KES ${input.amount}.`,
    timestamp: Date.now(), severity: 'INFO'
  });

  // Claim the receipt outbox record so repeated provider callbacks do not send duplicate receipts.
  const claimed = await db.runTransaction(async transaction => {
    const snap = await transaction.get(outboxRef);
    if (!snap.exists) return false;
    const data = snap.data()!;
    if (data.status === 'SENT' || data.status === 'SKIPPED') return false;
    if (data.status === 'PROCESSING' && Number(data.leaseUntil || 0) > Date.now()) return false;
    transaction.update(outboxRef, {
      status: 'PROCESSING', leaseUntil: Date.now() + 60_000,
      attemptCount: admin.firestore.FieldValue.increment(1), updatedAt: Date.now()
    });
    return true;
  });
  if (claimed) {
    try {
      const orderSnap = await orderRef.get();
      const order = orderSnap.data() || {};
      let recipient = typeof order.customerEmail === 'string' ? order.customerEmail : '';
      let customerName = String(order.customerName || 'Customer');
      if (!recipient && order.customerId) {
        const user = await admin.auth(getAdminApp()).getUser(String(order.customerId));
        recipient = user.email || '';
        customerName = String(user.displayName || customerName);
      }
      if (!recipient) {
        await outboxRef.update({ status: 'SKIPPED', skipReason: 'Customer email unavailable', updatedAt: Date.now() });
      } else {
        const paidAt = Number(order.paidAt || Date.now());
        const receiptEmail = paymentReceiptEmail({
          email: recipient, name: customerName, currency: 'KES', amount: input.amount,
          receiptNumber: String(input.receipt || input.providerTransactionId || input.orderId),
          transactionReference: String(input.providerTransactionId || input.receipt || input.orderId),
          paymentMethod: input.provider === 'MPESA' ? 'M-Pesa' : 'Airtel Money',
          paymentDate: new Date(paidAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }),
          description: 'Urban Auto Express order ' + input.orderId
        });
        await sendTransactionalEmail({ sender: 'finance', to: recipient, ...receiptEmail });
        await outboxRef.update({ status: 'SENT', sentAt: Date.now(), leaseUntil: null, updatedAt: Date.now() });
      }
    } catch (error) {
      console.error('[PAYMENT_RECEIPT_EMAIL]', error);
      await outboxRef.update({ status: 'FAILED', lastError: error instanceof Error ? error.message : 'Email delivery failed', leaseUntil: null, updatedAt: Date.now() });
    }
  }
}
export function publicBaseUrl() {
  const value = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!value) throw new Error('APP_BASE_URL is not configured');
  return value.startsWith('http') ? value : 'https://' + value;
}
