import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp, getDbAdmin } from '@/lib/firebase-admin';
import { PinError, staffPinOperation } from '@/lib/staff-pin-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ') || !authorization.slice(7)) return json({ error: 'Sign in with your staff account first.', code: 'AUTH_REQUIRED' }, 401);
  try {
    const auth = getAuth(getAdminApp()!);
    let identity;
    try { identity = await auth.verifyIdToken(authorization.slice(7), true); }
    catch { return json({ error: 'Your session has expired. Sign in again.', code: 'AUTH_REQUIRED' }, 401); }
    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'Invalid PIN request.', code: 'INVALID_REQUEST' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid PIN request.', code: 'INVALID_REQUEST' }, 400);
    const result = await staffPinOperation(getDbAdmin(), { uid: identity.uid, auth_time: identity.auth_time, email: identity.email, email_verified: identity.email_verified }, body, process.env.STAFF_PIN_PEPPER || '');
    const status = result.code === 'PIN_RATE_LIMIT' ? 429 : result.success === false ? 401 : 200;
    return json(result, status);
  } catch (error) {
    if (error instanceof PinError) return json({ error: error.message, code: error.code }, error.status);
    console.error('[STAFF_PIN] Operation failed.');
    return json({ error: 'PIN service is unavailable. Please retry or contact your administrator.', code: 'PIN_UNAVAILABLE' }, 503);
  }
}
