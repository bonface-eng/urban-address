import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getAdminApp, getDbAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROOT_ADMINS = [
  'urbanautoexpressnakuru@gmail.com',
  'urbanaautoexpressnakuru@gmail.com',
  'samuelkarani044@gmail.com',
  'gmaina424@gmail.com',
  'bonfacewana3072@gmail.com',
];

export async function POST(request: NextRequest) {
  try {
    const header = request.headers.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const decoded = await admin.auth(getAdminApp()).verifyIdToken(token);
    const db = getDbAdmin();
    const [profileSnap, adminSnap] = await Promise.all([
      db.collection('users').doc(decoded.uid).get(),
      decoded.email ? db.collection('admins').doc(decoded.email.toLowerCase().trim()).get() : Promise.resolve(null),
    ]);
    const profile = profileSnap.data() || {};
    const rawRole = String(profile.role || 'CLIENT').toUpperCase();
    const isAdmin = ROOT_ADMINS.includes(String(decoded.email || '').toLowerCase()) || !!adminSnap?.exists || rawRole === 'ADMIN';
    const role = isAdmin ? 'ADMIN' : rawRole;
    const category = isAdmin ? 'ADMIN' : role === 'CLIENT' ? 'CUSTOMER' : 'STAFF';
    const now = Date.now();

    await db.collection('telegram_presence').doc(decoded.uid).set({
      uid: decoded.uid,
      email: String(decoded.email || '').slice(0, 254),
      displayName: String(profile.displayName || decoded.name || decoded.email || 'Unnamed account').replace(/[<>\r\n]/g, ' ').slice(0, 100),
      role,
      category,
      lastSeenAt: now,
      updatedAt: now,
    }, { merge: true });

    return NextResponse.json({ ok: true, category, lastSeenAt: now });
  } catch {
    return NextResponse.json({ error: 'Unable to record active session.' }, { status: 401 });
  }
}
