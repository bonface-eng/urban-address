import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';
import { getAdminApp, getDbAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 });

    const app = getAdminApp();
    const decoded = await admin.auth(app).verifyIdToken(token);
    const user = await admin.auth(app).getUser(decoded.uid);
    if (!user.email) return NextResponse.json({ error: 'An account email is required.' }, { status: 400 });

    const body = await request.json();
    if (typeof body?.marketingOptIn !== 'boolean') {
      return NextResponse.json({ error: 'A valid marketing preference is required.' }, { status: 400 });
    }

    const email = user.email.trim().toLowerCase();
    const emailHash = createHash('sha256').update(email).digest('hex');
    const db = getDbAdmin();
    const optedIn = body.marketingOptIn === true;
    const now = Date.now();

    await db.runTransaction(async transaction => {
      const userRef = db.collection('users').doc(decoded.uid);
      const preferenceRef = db.collection('email_preferences').doc(emailHash);
      transaction.set(userRef, {
        marketingOptIn: optedIn,
        marketingConsent: optedIn,
        marketingConsentUpdatedAt: now,
        marketingConsentSource: 'authenticated_client_profile',
      }, { merge: true });
      transaction.set(preferenceRef, {
        email,
        marketingUnsubscribed: !optedIn,
        marketingPreferenceUpdatedAt: now,
        source: 'authenticated_client_profile',
      }, { merge: true });
    });

    await db.collection('audit_logs').add({
      action: 'MARKETING_EMAIL_PREFERENCE_UPDATED',
      userId: decoded.uid,
      details: optedIn ? 'Customer opted in to promotional email.' : 'Customer opted out of promotional email.',
      timestamp: now,
      severity: 'INFO',
    });

    return NextResponse.json({ ok: true, marketingOptIn: optedIn });
  } catch (error) {
    console.error('[EMAIL_PREFERENCE_UPDATE]', error);
    return NextResponse.json({ error: 'We could not update your email preference. Please try again.' }, { status: 500 });
  }
}
