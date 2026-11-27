import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Clears `terminal_staff_session` / `terminal_device_id` in Supabase `app_metadata`
 * ONLY when the bearer token proves a full password or OAuth authentication (`amr`).
 * PIN-switched magic-link tokens carry `amr: [{ method: 'otp' }]` and are rejected.
 */
export async function POST(request: NextRequest) {
  try {
    const header = request.headers.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const adminClient = getSupabaseAdminClient();
    const { data, error } = await adminClient.auth.getUser(token);
    if (error || !data?.user) {
      return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
    }

    const appMeta = data.user.app_metadata || {};
    if (!appMeta.terminal_staff_session && !appMeta.terminalStaffSession) {
      return NextResponse.json({ ok: true, cleared: false });
    }

    const jwtPayload = decodeJwtPayload(token);
    const amrMethods = Array.isArray(jwtPayload?.amr)
      ? jwtPayload.amr.map((entry: any) => String(entry?.method || '').toLowerCase())
      : [];

    const isFullLogin = amrMethods.some((m) => m === 'password' || m === 'oauth' || m === 'sso/saml');
    if (!isFullLogin) {
      return NextResponse.json(
        { error: 'Full password or Google sign-in is required to clear a terminal PIN restriction.' },
        { status: 403 }
      );
    }

    const { error: updateErr } = await adminClient.auth.admin.updateUserById(data.user.id, {
      app_metadata: {
        ...appMeta,
        terminal_staff_session: false,
        terminalStaffSession: false,
        terminal_device_id: null,
        terminalDeviceId: null,
      },
    });
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, cleared: true });
  } catch (err: any) {
    console.error('[CLEAR_TERMINAL_SESSION]', err);
    return NextResponse.json({ error: 'Could not update session state.' }, { status: 500 });
  }
}
