import type { Firestore } from 'firebase-admin/firestore';
import { FieldPath } from 'firebase-admin/firestore';
import { ROOT_ADMIN_EMAILS } from './admin-identity';
export class PosReadError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}
const roles = new Set(['ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'STOREKEEPER', 'ATTENDANT', 'KITCHEN']);
const text = (value: unknown) => typeof value === 'string' ? value : '';
const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const tabFields = ['type','jobType','status','prepStatus','cashierId','cashierName','terminalId','registerSessionId','customerId','customerName','plateNumber','vehicleMake','vehicleModel','vehicleColor','tableNumber','attendantId','attendantName','carpetDimensions'];

export async function readPosData(db: Firestore, identity: { uid: string; email?: string; email_verified?: boolean }, params: URLSearchParams) {
  const resource = params.get('resource');
  if (!['customers', 'own-tabs'].includes(resource || '') || [...params.keys()].some(key => !['resource','cursor','unit'].includes(key))) throw new PosReadError('POS_READ_INVALID',400);
  const cursor = params.get('cursor');
  const unit = params.get('unit');
  if (cursor && (cursor.includes('/') || cursor.length > 1500)) throw new PosReadError('POS_READ_INVALID',400);
  if (unit && !['LOUNGE','STORE','CARWASH'].includes(unit)) throw new PosReadError('POS_READ_INVALID',400);
  const profile = await db.collection('users').doc(identity.uid).get();
  const role = profile.get('role');
  if (!profile.exists || profile.get('disabled') === true || profile.get('active') === false || profile.get('status') === 'DISABLED') throw new PosReadError('POS_STAFF_REQUIRED',403);
  if (typeof role !== 'string' || !roles.has(role.toUpperCase())) {
    const email = text(identity.email).toLowerCase().trim();
    if (!email || email.includes('/') || email.length > 254 || identity.email_verified !== true) throw new PosReadError('POS_STAFF_REQUIRED',403);
    if (!ROOT_ADMIN_EMAILS.includes(email) && !(await db.collection('admins').doc(email).get()).exists) throw new PosReadError('POS_STAFF_REQUIRED',403);
  }
  let query = resource === 'customers'
    ? db.collection('users').where('role', '==', 'CLIENT').orderBy(FieldPath.documentId()).limit(100)
    : db.collection('users').doc(identity.uid).collection('held_bills').orderBy(FieldPath.documentId()).limit(100);
  if (cursor) query = query.startAfter(cursor);
  const snapshot = await query.get();
  const records = snapshot.docs.filter(doc => resource === 'customers' || !unit || doc.get('type') === unit).map(doc => {
    const data = doc.data();
    if (resource === 'customers') return {
      uid: doc.id, role: 'CLIENT', displayName: text(data.displayName), email: text(data.email), phoneNumber: text(data.phoneNumber), loyaltyPoints: numeric(data.loyaltyPoints),
    };
    const tab: Record<string, unknown> = { id: doc.id };
    for (const key of tabFields) if (typeof data[key] === 'string') tab[key] = data[key];
    for (const key of ['total','discount','tip','tax','timestamp','servedAt']) if (typeof data[key] === 'number' && Number.isFinite(data[key])) tab[key] = data[key];
    tab.items = Array.isArray(data.items) ? data.items.map((item: Record<string, unknown>) => {
      const safe: Record<string, unknown> = {};
      for (const key of ['productId','name','category','notes','status']) if (typeof item?.[key] === 'string') safe[key] = item[key];
      for (const key of ['price','quantity','commission']) safe[key] = numeric(item?.[key]);
      return safe;
    }) : [];
    return tab;
  });
  return { records, nextCursor: snapshot.size === 100 ? snapshot.docs[snapshot.docs.length - 1].id : null };
}
