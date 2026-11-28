import { NextRequest, NextResponse } from 'next/server';
import * as admin from '@/lib/db/admin';
import { createClient } from '@supabase/supabase-js';
import { getAdminApp } from '@/lib/db/admin';
import { sendTransactionalEmail } from '@/lib/resend';
import { passwordResetEmail } from '@/lib/email/templates';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function appOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (productionHost) return `https://${productionHost}`;
  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }

    getAdminApp();

    try {
      const user = await admin.auth().getUserByEmail(email);
      if (user.email && !user.disabled) {
        const origin = appOrigin(request);
        if (process.env.RESEND_API_KEY) {
          const resetLink = await admin.auth().generatePasswordResetLink(user.email, {
            url: `${origin}/auth/reset-password`,
            handleCodeInApp: false,
          });
          const code = new URL(resetLink).searchParams.get('oobCode');
          if (!code) throw new Error('No password reset code was returned.');

          const resetUrl = new URL('/auth/reset-password', origin);
          resetUrl.searchParams.set('oobCode', code);
          const emailContent = passwordResetEmail({ email: user.email, resetUrl: resetUrl.toString() });
          await sendTransactionalEmail({ sender: 'auth', to: user.email, ...emailContent });
        } else {
          // Fallback to Supabase Auth's native reset email when Resend is not configured.
          const pubClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          await pubClient.auth.resetPasswordForEmail(user.email, {
            redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
          });
        }
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
