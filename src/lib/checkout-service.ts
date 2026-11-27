import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { staffAccess, StaffAccessError, type StaffIdentity } from './staff-access';
export class CheckoutError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
const fail = (code: string, status = 400): never => { throw new CheckoutError(code,status); };
const string = (value: unknown, max = 150) => typeof value === 'string' ? value.trim().slice(0,max) : '';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const inactive = (data: Record<string, any>) => data.disabled === true || data.active === false || data.status === 'DISABLED';

export async function checkout(db: Firestore, identity: StaffIdentity, raw: Record<string, any>, verifyPayment: (reference: string, amount: number) => Promise<boolean>) {
  const access = await staffAccess(db,identity);
  if (!access.manager && access.role !== 'CASHIER') throw new StaffAccessError('CHECKOUT_ROLE_DENIED',403);
  if (typeof raw.total !== 'number' || !Number.isFinite(raw.total) || raw.total < 0 || raw.total > 1e9) fail('CHECKOUT_INVALID');
  const unit = raw.unit;
  if (!['STORE','LOUNGE','CARWASH'].includes(unit)) fail('CHECKOUT_INVALID');
  if (!access.manager && (!Array.isArray(access.profile.assignedUnits) || !access.profile.assignedUnits.includes(unit))) fail('CHECKOUT_UNIT_DENIED',403);
  if (typeof raw.key !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(raw.key)) fail('CHECKOUT_INVALID');
  if (!Array.isArray(raw.items) || raw.items.length < 1 || raw.items.length > 100) fail('CHECKOUT_INVALID');
  const quantities = new Map<string, number>();
  for (const item of raw.items) {
    if (!item || typeof item.productId !== 'string' || !item.productId || item.productId.includes('/') || item.productId.length > 1500 || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000) fail('CHECKOUT_INVALID');
    const quantity = (quantities.get(item.productId) || 0) + item.quantity;
    if (quantity > 10000) fail('CHECKOUT_INVALID');
    quantities.set(item.productId,quantity);
  }
  if (!['CASH','MOBILE'].includes(raw.method)) fail('CHECKOUT_INVALID');
  const manual = raw.method === 'MOBILE' && raw.manual === true;
  const reference = string(raw.reference,150);
  if (raw.method === 'MOBILE' && !/^[a-zA-Z0-9_-]{5,150}$/.test(reference)) fail('CHECKOUT_PAYMENT_REQUIRED');
  const heldId = string(raw.heldId,1500);
  if (heldId.includes('/')) fail('CHECKOUT_INVALID');
  if (raw.unit === 'LOUNGE' && !string(raw.tableNumber,40)) raw.tableNumber = 'WALK-IN';
  if (unit === 'CARWASH' && !['VEHICLE','CARPET'].includes(raw.jobType)) fail('CHECKOUT_INVALID');
  const plate = string(raw.plateNumber,30).toUpperCase();
  if (unit === 'CARWASH' && raw.jobType === 'VEHICLE' && (!plate || !/^[A-Z0-9 -]+$/.test(plate))) fail('CHECKOUT_PLATE_REQUIRED');
  const attendantId = string(raw.attendantId,128);
  if (attendantId.includes('/')) fail('CHECKOUT_INVALID');
  const cart = [...quantities].sort(([a],[b]) => a.localeCompare(b));
  const fingerprint = hash(JSON.stringify({ unit, cart, method:raw.method, manual, reference, heldId, total:raw.total, cashReceived:raw.cashReceived ?? null, tableNumber:string(raw.tableNumber,40), jobType:raw.jobType || '', plate, attendantId, vehicleMake:string(raw.vehicleMake,60), vehicleModel:string(raw.vehicleModel,60), vehicleColor:string(raw.vehicleColor,40), carpetDimensions:string(raw.carpetDimensions,80) }));
  const keyId = hash(identity.uid + ':' + raw.key);
  const operationRef = db.collection('checkout_operations').doc(keyId);
  const orderRef = db.collection('orders').doc(heldId || 'sale_' + keyId);
  const auditRef = db.collection('audit_logs').doc('checkout_' + keyId);
  const paymentRef = reference ? db.collection('checkout_payment_refs').doc(hash(reference.toUpperCase())) : null;
  // Processor verification never trusts the browser's previous verification/callback.
  if (raw.method === 'MOBILE' && !manual && !(await verifyPayment(reference,raw.total))) fail('CHECKOUT_PAYMENT_UNVERIFIED',409);
  return db.runTransaction(async tx => {
    const currentActor = await tx.get(db.collection('users').doc(identity.uid));
    if (!currentActor.exists || inactive(currentActor.data() || {}) || currentActor.get('role') !== access.profile.role || JSON.stringify(currentActor.get('assignedUnits') || []) !== JSON.stringify(access.profile.assignedUnits || [])) fail('CHECKOUT_ACCOUNT_CHANGED',403);
    const previous = await tx.get(operationRef);
    if (previous.exists) {
      if (previous.get('fingerprint') !== fingerprint) fail('CHECKOUT_KEY_REUSED',409);
      return { receipt: previous.get('receipt'), replayed: true };
    }
    const existingOrder = await tx.get(orderRef);
    const heldRef = heldId ? db.collection('users').doc(identity.uid).collection('held_bills').doc(heldId) : null;
    const held = heldRef ? await tx.get(heldRef) : null;
    if (heldId && (!held?.exists || held.get('type') !== unit || (held.get('cashierId') && held.get('cashierId') !== identity.uid))) fail('CHECKOUT_HELD_DENIED',409);
    if (heldId && (held?.get('inventorySynced') === true || existingOrder.get('inventorySynced') === true)) fail('CHECKOUT_HELD_REVIEW_REQUIRED',409);
    if (existingOrder.exists && (!heldId || existingOrder.get('status') !== 'PENDING' || existingOrder.get('cashierId') !== identity.uid)) fail('CHECKOUT_ALREADY_SETTLED',409);
    const usedPayment = paymentRef ? await tx.get(paymentRef) : null;
    if (usedPayment?.exists) fail('CHECKOUT_PAYMENT_REUSED',409);
    let attendantName = 'Unassigned';
    if (unit === 'CARWASH' && attendantId && attendantId !== 'Unassigned') {
      const attendant = await tx.get(db.collection('users').doc(attendantId));
      if (!attendant.exists || attendant.get('role') !== 'ATTENDANT' || inactive(attendant.data() || {})) fail('CHECKOUT_ATTENDANT_INVALID');
      attendantName = string(attendant.get('displayName'),120);
    }
    const products = await Promise.all(cart.map(([id]) => tx.get(db.collection('inventory').doc(id))));
    const items: any[] = [];
    let cents = 0;
    let commission = 0;
    const stocks: Array<{ ref: any; stock: number }> = [];
    for (let index=0;index<cart.length;index++) {
      const [id,quantity] = cart[index]; const product = products[index]; const data = product.data() || {};
      if (!product.exists || data.archived === true || typeof data.unit !== 'string' || data.unit.toUpperCase() !== unit || typeof data.price !== 'number' || !Number.isFinite(data.price) || data.price < 0) fail('CHECKOUT_CATALOGUE_CHANGED',409);
      const priceCents = Math.round(data.price*100);
      cents += priceCents * quantity;
      if (!Number.isSafeInteger(cents) || cents > 1e11) fail('CHECKOUT_INVALID');
      const rate = typeof data.commission === 'number' && data.commission >= 0 && data.commission <= 100 ? data.commission : 30;
      const item = { productId:id, name:string(data.name,200), category:string(data.category,200), price:priceCents/100, quantity, status:'COMMITTED', commission: unit === 'CARWASH' ? rate : 0 };
      items.push(item);
      if (unit === 'CARWASH') commission += item.price * quantity * rate / 100;
      else {
        if (typeof data.stockLevel !== 'number' || !Number.isFinite(data.stockLevel) || data.stockLevel < quantity) fail('CHECKOUT_STOCK_CHANGED',409);
        stocks.push({ ref:product.ref,stock:data.stockLevel-quantity });
      }
    }
    const total = cents/100;
    if (typeof raw.total !== 'number' || !Number.isFinite(raw.total) || Math.round(raw.total*100) !== cents) fail('CHECKOUT_PRICE_CHANGED',409);
    if (raw.method === 'CASH' && (typeof raw.cashReceived !== 'number' || !Number.isFinite(raw.cashReceived) || raw.cashReceived < total)) fail('CHECKOUT_CASH_REQUIRED');
    const now = Date.now();
    const receipt: Record<string, any> = { id:orderRef.id, type:unit,status:'PAID',total,paymentMethod:raw.method,paymentRef:reference || null,paymentVerification:raw.method === 'CASH' ? 'STAFF_RECORDED_CASH' : manual ? 'STAFF_RECORDED_MOBILE' : 'PROCESSOR_VERIFIED',cashierId:identity.uid,cashierName:string(access.profile.displayName,120),timestamp:now,inventorySynced:true,items };
    if (raw.method === 'CASH') { receipt.cashReceived = raw.cashReceived; receipt.change = raw.cashReceived-total; }
    if (unit === 'LOUNGE') receipt.tableNumber = string(raw.tableNumber,40);
    if (unit === 'CARWASH') Object.assign(receipt,{ jobType:raw.jobType,plateNumber:plate,vehicleMake:string(raw.vehicleMake,60),vehicleModel:string(raw.vehicleModel,60),vehicleColor:string(raw.vehicleColor,40),carpetDimensions:string(raw.carpetDimensions,80),attendantId:attendantId || 'Unassigned',attendantName });
    // All reads above; stock, receipt, audit and idempotency marker commit together.
    tx.set(orderRef,receipt);
    for (const stock of stocks) tx.update(stock.ref,{ stockLevel:stock.stock,updatedAt:now });
    if (heldRef) tx.delete(heldRef);
    if (paymentRef) tx.set(paymentRef,{ uid:identity.uid,orderId:orderRef.id,createdAt:now,verification:receipt.paymentVerification });
    if (unit === 'CARWASH') {
      tx.set(db.collection('carwash_jobs').doc('job_'+keyId),{ orderId:orderRef.id,jobType:raw.jobType,plateNumber:plate,vehicleMake:receipt.vehicleMake,vehicleModel:receipt.vehicleModel,vehicleColor:receipt.vehicleColor,carpetDimensions:receipt.carpetDimensions,service:items.length===1 ? items[0].name : `${items.length} Services`,price:total,commission,status:'QUEUED',attendantId:receipt.attendantId,attendantName,timestamp:now });
      if (raw.jobType === 'VEHICLE') tx.set(db.collection('vehicles').doc(plate),{ plateNumber:plate,make:receipt.vehicleMake,model:receipt.vehicleModel,color:receipt.vehicleColor,lastSeen:now },{ merge:true });
    }
    tx.set(auditRef,{ action:'CHECKOUT_COMPLETED',userId:identity.uid,orderId:orderRef.id,timestamp:now,severity:'INFO',unit,total,paymentVerification:receipt.paymentVerification });
    tx.set(operationRef,{ uid:identity.uid,fingerprint,receipt,createdAt:now });
    return { receipt,replayed:false };
  });
}
