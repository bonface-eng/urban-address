import type { Firestore } from 'firebase-admin/firestore';
import { ROOT_ADMIN_EMAILS } from './admin-identity';

export class InventoryUpdateError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}
const writers = new Set(['ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'STOREKEEPER', 'ATTENDANT']);
const fail = (code: string, status: number, message: string): never => { throw new InventoryUpdateError(code, status, message); };

/** Identity must come from a revocation-checked Firebase token. No user-supplied roles. */
export async function updateInventory(db: Firestore, identity: { uid: string; email?: string; email_verified?: boolean }, body: Record<string, unknown>) {
  if (Object.keys(body).some(key => !['id', 'action', 'delta', 'expectedStock', 'changes'].includes(key))) fail('INVENTORY_INVALID_UPDATE', 400, 'Unsupported update fields.');
  if (typeof body.id !== 'string' || !body.id || body.id.includes('/') || body.id.length > 1500) fail('INVENTORY_INVALID_UPDATE', 400, 'Invalid item reference.');
  if (!['edit', 'adjust'].includes(String(body.action))) fail('INVENTORY_INVALID_UPDATE', 400, 'Invalid update operation.');
  const id = body.id as string;
  const profileRef = db.collection('users').doc(identity.uid);
  const itemRef = db.collection('inventory').doc(id);
  const auditRef = db.collection('audit_logs').doc();
  return db.runTransaction(async tx => {
    const profile = await tx.get(profileRef);
    if (!profile.exists || profile.get('disabled') === true || profile.get('active') === false || profile.get('status') === 'DISABLED') fail('INVENTORY_WRITE_DENIED', 403, 'An active inventory operator account is required.');
    const role = profile.get('role');
    if (typeof role !== 'string' || !writers.has(role.toUpperCase())) {
      // Kitchen accounts stay read-only even if another legacy policy identifies them as staff.
      if (typeof role === 'string' && role.toUpperCase() === 'KITCHEN') fail('INVENTORY_WRITE_DENIED', 403, 'This account has read-only inventory access.');
      const email = typeof identity.email === 'string' ? identity.email.toLowerCase().trim() : '';
      if (!email || email.includes('/') || email.length > 254 || identity.email_verified !== true) fail('INVENTORY_WRITE_DENIED', 403, 'Inventory update access could not be verified.');
      if (!ROOT_ADMIN_EMAILS.includes(email) && !(await tx.get(db.collection('admins').doc(email))).exists) fail('INVENTORY_WRITE_DENIED', 403, 'Inventory update access could not be verified.');
    }
    const item = await tx.get(itemRef);
    if (!item.exists) fail('INVENTORY_ITEM_MISSING', 404, 'This item no longer exists. Refresh inventory.');
    const existingStock = item.get('stockLevel');
    const currentStock = typeof existingStock === 'number' && Number.isFinite(existingStock) ? existingStock : 0;
    const changes: Record<string, unknown> = {};
    if (body.action === 'adjust') {
      if (body.delta !== 1 && body.delta !== -1) fail('INVENTORY_INVALID_UPDATE', 400, 'Stock adjustment must be +1 or -1.');
      changes.stockLevel = Math.max(0, currentStock + (body.delta as number));
    } else {
      if (!body.changes || typeof body.changes !== 'object' || Array.isArray(body.changes)) fail('INVENTORY_INVALID_UPDATE', 400, 'Invalid item changes.');
      const input = body.changes as Record<string, unknown>;
      const allowed = new Set(['name', 'category', 'price', 'costPrice', 'stockLevel', 'minStock', 'barcode', 'unit', 'image', 'commission', 'commissionNightShift']);
      if (!Object.keys(input).length || Object.keys(input).some(key => !allowed.has(key))) fail('INVENTORY_INVALID_UPDATE', 400, 'Unsupported item changes.');
      for (const [key, value] of Object.entries(input)) {
        if (['price', 'costPrice', 'stockLevel', 'minStock', 'commission', 'commissionNightShift'].includes(key)) {
          if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e12) fail('INVENTORY_INVALID_UPDATE', 400, 'Amounts and stock values must be valid non-negative numbers.');
          if (['commission', 'commissionNightShift'].includes(key) && (value as number) > 100) fail('INVENTORY_INVALID_UPDATE', 400, 'Commission must be between 0 and 100.');
          changes[key] = value;
        } else if (key === 'unit') {
          if (!['STORE', 'LOUNGE', 'CARWASH'].includes(String(value))) fail('INVENTORY_INVALID_UPDATE', 400, 'Invalid department.');
          changes[key] = value;
        } else if (key === 'image' || key === 'barcode') {
          if (value !== null && (typeof value !== 'string' || value.length > (key === 'image' ? 2048 : 150))) fail('INVENTORY_INVALID_UPDATE', 400, 'Invalid image or barcode.');
          if (key === 'image' && typeof value === 'string' && value && !/^https:\/\//.test(value) && !value.startsWith('/')) fail('INVENTORY_INVALID_UPDATE', 400, 'Use a secure image URL.');
          changes[key] = value;
        } else {
          if (typeof value !== 'string' || !value.trim() || value.length > 200) fail('INVENTORY_INVALID_UPDATE', 400, 'Name and category are required and must be under 200 characters.');
          changes[key] = (value as string).trim();
        }
      }
      if ('stockLevel' in changes) {
        if (typeof body.expectedStock !== 'number' || !Number.isFinite(body.expectedStock)) fail('INVENTORY_INVALID_UPDATE', 400, 'Refresh this item before updating stock.');
        if (body.expectedStock !== currentStock) fail('INVENTORY_STOCK_CONFLICT', 409, 'Stock changed since you opened this item. Refresh and reopen it before saving.');
      }
    }
    const now = Date.now();
    tx.update(itemRef, { ...changes, updatedAt: now });
    tx.set(auditRef, {
      action: body.action === 'adjust' ? 'STOCK_ADJUSTMENT' : 'INVENTORY_ITEM_UPDATE', userId: identity.uid,
      productId: id, timestamp: now, severity: 'INFO', changedFields: Object.keys(changes),
      stockBefore: currentStock, stockAfter: changes.stockLevel ?? currentStock,
    });
    return { success: true, stockLevel: changes.stockLevel ?? currentStock };
  });
}
