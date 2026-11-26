import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getDbAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONSENT_VERSION = 1;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ConsentAction = 'accepted_all' | 'rejected_optional' | 'customized';

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 4096) {
      return NextResponse.json({ error: 'Consent request is too large.' }, { status: 413 });
    }

    const origin = request.headers.get('origin');
    if (origin) {
      try {
        if (new URL(origin).host !== request.headers.get('host')) {
          return NextResponse.json({ error: 'Cross-origin consent requests are not allowed.' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
      }
    }

    const body = await request.json();
    const consentId = typeof body?.consentId === 'string' ? body.consentId : '';
    const action = body?.action as ConsentAction;
    const categories = body?.categories;

    if (!UUID_PATTERN.test(consentId) || body?.version !== CONSENT_VERSION) {
      return NextResponse.json({ error: 'Invalid consent reference or policy version.' }, { status: 400 });
    }

    if (!['accepted_all', 'rejected_optional', 'customized'].includes(action)) {
      return NextResponse.json({ error: 'Invalid consent action.' }, { status: 400 });
    }

    if (
      categories?.essential !== true ||
      typeof categories?.analytics !== 'boolean' ||
      typeof categories?.marketing !== 'boolean'
    ) {
      return NextResponse.json({ error: 'Please provide valid cookie category choices.' }, { status: 400 });
    }

    if (action === 'accepted_all' && (!categories.analytics || !categories.marketing)) {
      return NextResponse.json({ error: 'Accept-all must include all optional categories.' }, { status: 400 });
    }

    if (action === 'rejected_optional' && (categories.analytics || categories.marketing)) {
      return NextResponse.json({ error: 'Reject-optional must disable optional categories.' }, { status: 400 });
    }

    const db = getDbAdmin();
    const consentRef = db.collection('privacyConsent').doc(consentId);
    await db.runTransaction(async transaction => {
      const existing = await transaction.get(consentRef);
      transaction.set(consentRef, {
        policyVersion: CONSENT_VERSION,
        categories: {
          essential: true,
          analytics: categories.analytics,
          marketing: categories.marketing,
        },
        action,
        source: 'website_cookie_banner',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(existing.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
      }, { merge: true });
    });

    return NextResponse.json({ success: true, policyVersion: CONSENT_VERSION }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[COOKIE_CONSENT_SAVE_FAILED]', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Cookie preferences could not be saved right now. Please try again.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
