import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { FieldPath } from 'firebase-admin/firestore';
import { getAdminApp, getDbAdmin } from '@/lib/firebase-admin';
import { ROOT_ADMIN_EMAILS } from '@/lib/admin-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const roles = new Set(['ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'STOREKEEPER', 'ATTENDANT', 'KITCHEN']);
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;

export async function GET(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ') || !header.slice(7)) return json({ code: 'INVENTORY_AUTH_REQUIRED' }, 401);
  try {
    let identity;
    try { identity = await getAuth(getAdminApp()!).verifyIdToken(header.slice(7), true); }
    catch { return json({ code: 'INVENTORY_AUTH_REQUIRED' }, 401); }
    const db = getDbAdmin();
    const profile = await db.collection('users').doc(identity.uid).get();
    const role = profile.get('role');
    if (!profile.exists || profile.get('disabled') === true || profile.get('active') === false || profile.get('status') === 'DISABLED') return json({ code: 'INVENTORY_STAFF_REQUIRED' }, 403);
    if (typeof role !== 'string' || !roles.has(role.toUpperCase())) {
      const email = typeof identity.email === 'string' ? identity.email.toLowerCase().trim() : '';
      if (!email || email.includes('/') || email.length > 254 || identity.email_verified !== true) return json({ code: 'INVENTORY_STAFF_REQUIRED' }, 403);
      if (!ROOT_ADMIN_EMAILS.includes(email) && !(await db.collection('admins').doc(email).get()).exists) return json({ code: 'INVENTORY_STAFF_REQUIRED' }, 403);
    }
    const cursor = request.nextUrl.searchParams.get('cursor');
    if (cursor && (cursor.includes('/') || cursor.length > 1500)) return json({ code: 'INVENTORY_INVALID_CURSOR' }, 400);
    // Document-ID ordering avoids excluding legacy records with a missing name.
    let query = db.collection('inventory').orderBy(FieldPath.documentId()).limit(250);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    const products = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id, name: typeof data.name === 'string' ? data.name : 'Unnamed item',
        category: typeof data.category === 'string' ? data.category : 'Other', unit: typeof data.unit === 'string' ? data.unit.toUpperCase() : '',
        price: number(data.price), costPrice: number(data.costPrice), stockLevel: number(data.stockLevel), minStock: number(data.minStock),
        barcode: typeof data.barcode === 'string' ? data.barcode : '', image: typeof data.image === 'string' ? data.image : '', archived: data.archived === true,
        size: number(data.size), sizeUnit: typeof data.sizeUnit === 'string' ? data.sizeUnit : '',
        commission: number(data.commission), commissionNightShift: number(data.commissionNightShift),
        lastCountedStock: typeof data.lastCountedStock === 'number' ? data.lastCountedStock : null,
        lastCountedAt: typeof data.lastCountedAt === 'number' ? data.lastCountedAt : null,
        lastCountedBy: typeof data.lastCountedBy === 'string' ? data.lastCountedBy : null,
      };
    });
    return json({ products, nextCursor: snapshot.size === 250 ? snapshot.docs[snapshot.docs.length - 1].id : null });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    const reference = code === 7 || code === 'permission-denied' ? 'INVENTORY_SERVER_ACCESS' : code === 9 || code === 'failed-precondition' ? 'INVENTORY_DATABASE_CONFIGURATION' : 'INVENTORY_SERVER_UNAVAILABLE';
    console.error('[STAFF_INVENTORY]', reference);
    return json({ code: reference }, 503);
  }
}
