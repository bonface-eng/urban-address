import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp, getDbAdmin } from '@/lib/firebase-admin';
import { InventoryUpdateError, updateInventory } from '@/lib/inventory-update';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function POST(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ') || !header.slice(7)) return json({ code: 'INVENTORY_AUTH_REQUIRED', error: 'Sign in again before updating inventory.' }, 401);
  try {
    let identity;
    try { identity = await getAuth(getAdminApp()!).verifyIdToken(header.slice(7), true); }
    catch { return json({ code: 'INVENTORY_AUTH_REQUIRED', error: 'Your session expired. Sign in again.' }, 401); }
    let body;
    try { body = await request.json(); } catch { return json({ code: 'INVENTORY_INVALID_UPDATE', error: 'Invalid update request.' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ code: 'INVENTORY_INVALID_UPDATE', error: 'Invalid update request.' }, 400);
    const result = await updateInventory(getDbAdmin(), { uid: identity.uid, email: identity.email, email_verified: identity.email_verified }, body);
    return json(result);
  } catch (error) {
    if (error instanceof InventoryUpdateError) return json({ code: error.code, error: error.message }, error.status);
    console.error('[INVENTORY_UPDATE] Transaction failed.');
    return json({ code: 'INVENTORY_UPDATE_UNAVAILABLE', error: 'The update could not be confirmed. Refresh inventory before retrying to check whether it was saved.' }, 503);
  }
}
