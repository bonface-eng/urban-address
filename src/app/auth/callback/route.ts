import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Supabase Auth redirect target for OAuth (Google), PKCE email confirmation,
 * magic links and password recovery.
 *
 *  - ?code=...                 -> exchangeCodeForSession (OAuth / PKCE)
 *  - ?token_hash=...&type=...  -> verifyOtp (email confirm / recovery)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const rawNext = searchParams.get('next') || '/';
  // Only allow same-site relative redirects.
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  const supabase = await createSupabaseServerClient();

  let errorMessage: string | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('[AUTH_CALLBACK] exchangeCodeForSession failed:', error.message);
      errorMessage = error.message;
    } else if (
      data?.session?.user &&
      (data.session.user.app_metadata?.terminal_staff_session || data.session.user.app_metadata?.terminalStaffSession)
    ) {
      try {
        const adminClient = getSupabaseAdminClient();
        await adminClient.auth.admin.updateUserById(data.session.user.id, {
          app_metadata: {
            ...(data.session.user.app_metadata || {}),
            terminal_staff_session: false,
            terminalStaffSession: false,
            terminal_device_id: null,
            terminalDeviceId: null,
          },
        });
        await supabase.auth.refreshSession();
      } catch {
        // Best effort clear on OAuth login
      }
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      console.error('[AUTH_CALLBACK] verifyOtp failed:', error.message);
      errorMessage = error.message;
    }
  } else {
    errorMessage = 'Missing authentication code.';
  }

  if (errorMessage) {
    const url = new URL('/login', origin);
    url.searchParams.set('error', errorMessage);
    return NextResponse.redirect(url);
  }

  const target = type === 'recovery' ? '/auth/reset-password' : next;
  return NextResponse.redirect(new URL(target, origin));
}
