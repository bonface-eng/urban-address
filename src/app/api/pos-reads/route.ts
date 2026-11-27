import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp, getDbAdmin } from '@/lib/firebase-admin';
import { PosReadError, readPosData } from '@/lib/pos-read-service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ') || !header.slice(7)) return json({ code: 'POS_AUTH_REQUIRED' },401);
  try {
    let identity;
    try { identity = await getAuth(getAdminApp()!).verifyIdToken(header.slice(7), true); }
    catch { return json({ code: 'POS_AUTH_REQUIRED' },401); }
    return json(await readPosData(getDbAdmin(), { uid: identity.uid, email: identity.email, email_verified: identity.email_verified }, request.nextUrl.searchParams));
  } catch (error) {
    if (error instanceof PosReadError) return json({ code: error.code },error.status);
    console.error('[POS_READS] Service unavailable.');
    return json({ code: 'POS_READ_UNAVAILABLE' },503);
  }
}
