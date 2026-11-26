import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';
import { getAdminApp, getDbAdmin } from '@/lib/firebase-admin';
import { sendTransactionalEmail } from '@/lib/resend';
import { passwordResetEmail } from '@/lib/email/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function appOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (productionHost) return `https://${productionHost}`;
  return request.nextUrl.origin;
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

async function isRateLimited(email: string, ip: string) {
  const db = getDbAdmin();
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const emailRef = db.collection('email_rate_limits').doc(hash(`password-reset:email:${email}`));
  const ipRef = db.collection('email_rate_limits').doc(hash(`password-reset:ip:${ip}`));

  return db.runTransaction(async (transaction) => {
    const [emailSnap, ipSnap] = await Promise.all([
      transaction.get(emailRef),
      transaction.get(ipRef),
    ]);
    const emailWindow = Number(emailSnap.get('windowStartedAt') || 0);
    const ipWindow = Number(ipSnap.get('windowStartedAt') || 0);
    const emailCount = emailWindow > now - windowMs ? Number(emailSnap.get('count') || 0) : 0;
    const ipCount = ipWindow > now - windowMs ? Number(ipSnap.get('count') || 0) : 0;

    if (emailCount >= 3 || ipCount >= 10) return true;

    transaction.set(emailRef, {
      count: emailCount + 1,
      windowStartedAt: emailCount ? emailWindow : now,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(ipRef, {
      count: ipCount + 1,
      windowStartedAt: ipCount ? ipWindow : now,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return false;
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }

    getAdminApp();
    const forwardedFor = request.headers.get('x-forwarded-for') || '';
    const ip = (forwardedFor.split(',')[0] || request.headers.get('x-real-ip') || 'unknown').trim().slice(0, 80);
    if (await isRateLimited(email, ip)) {
      return NextResponse.json({ ok: true, message: 'If an account exists for that address, a reset link will be sent.' });
    }

    try {
      const user = await admin.auth().getUserByEmail(email);
      if (user.email && !user.disabled) {
        const origin = appOrigin(request);
        const firebaseLink = await admin.auth().generatePasswordResetLink(user.email, {
          url: `${origin}/auth/reset-password`,
          handleCodeInApp: false,
        });
        const code = new URL(firebaseLink).searchParams.get('oobCode');
        if (!code) throw new Error('Firebase did not return a password reset code.');

        const resetUrl = new URL('/auth/reset-password', origin);
        resetUrl.searchParams.set('oobCode', code);
        const emailContent = passwordResetEmail({ email: user.email, resetUrl: resetUrl.toString() });
        await sendTransactionalEmail({ sender: 'auth', to: user.email, ...emailContent });
      }
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== 'auth/user-not-found') {
        console.error('[PASSWORD_RESET_EMAIL]', error);
      }
    }

    // Same response whether or not the account exists, to prevent account enumeration.
    return NextResponse.json({ ok: true, message: 'If an account exists for that address, a reset link will be sent.' });
  } catch (error) {
    console.error('[PASSWORD_RESET_REQUEST]', error);
    return NextResponse.json({ error: 'We could not process your request right now. Please try again.' }, { status: 503 });
  }
}
