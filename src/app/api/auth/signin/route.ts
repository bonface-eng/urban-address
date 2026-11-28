import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server';
import { getRoleHomeRoute } from '@/lib/role-routing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROOT_ADMINS = [
  'gackstoneb@gmail.com',
  'bonfacewana3072@gmail.com',
  'urbanautoexpressnakuru@gmail.com',
  'urbanaautoexpressnakuru@gmail.com',
  'samuelkarani044@gmail.com',
  'gmaina424@gmail.com',
];

function resolveSafeNext(
  rawNext: string | null | undefined,
  rawRedirect: string | null | undefined,
  upperRole: string,
  isRoot: boolean,
  roleHome: string
): string {
  if (
    rawNext &&
    rawNext.startsWith('/') &&
    !rawNext.startsWith('//') &&
    !rawNext.includes('\\')
  ) {
    if (upperRole === 'CLIENT' && !isRoot) {
      if (rawNext === '/' || rawNext.startsWith('/client/')) {
        return rawNext;
      }
      return '/';
    }
    if (rawNext === '/dashboard' && roleHome !== '/dashboard') {
      return roleHome;
    }
    return rawNext;
  }

  if (
    rawRedirect &&
    rawRedirect.startsWith('/client/') &&
    !rawRedirect.startsWith('//') &&
    !rawRedirect.includes('\\')
  ) {
    return rawRedirect;
  }

  return roleHome;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
    }

    const email = String(body.email ?? '').trim().toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const nextParam = typeof body.next === 'string' ? body.next : null;
    const redirectParam = typeof body.redirect === 'string' ? body.redirect : null;

    if (!email || !EMAIL_PATTERN.test(email) || email.length > 254) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.', field: 'email' },
        { status: 400 }
      );
    }

    if (!password || password.length > 128) {
      return NextResponse.json(
        { error: 'Please enter your password.', field: 'password' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      const msg = (error?.message || '').toLowerCase();
      if (msg.includes('banned') || msg.includes('disabled')) {
        return NextResponse.json(
          { error: 'This account has been suspended. Please contact an administrator.' },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const supaAdmin = getSupabaseAdminClient();
    const { data: profileRow } = await supaAdmin
      .from('profiles')
      .select('id, email, display_name, role, is_super_admin, assigned_units, disabled, status')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileRow?.disabled === true || profileRow?.status === 'suspended') {
      await supabase.auth.signOut().catch(() => undefined);
      return NextResponse.json(
        { error: 'This account has been suspended. Please contact an administrator.' },
        { status: 403 }
      );
    }

    const isRoot = ROOT_ADMINS.includes(email) || profileRow?.is_super_admin === true;
    const upperRole = String(profileRow?.role || (isRoot ? 'ADMIN' : 'CLIENT')).toUpperCase();
    const displayName =
      profileRow?.display_name ||
      data.user.user_metadata?.display_name ||
      data.user.user_metadata?.full_name ||
      email.split('@')[0] ||
      'Urban Member';

    if (!profileRow && !isRoot) {
      const { error: insertError } = await supaAdmin.from('profiles').insert({
        id: data.user.id,
        uid: data.user.id,
        firebase_id: data.user.id,
        email,
        display_name: displayName,
        role: 'CLIENT',
        account_type: 'CLIENT',
        loyalty_points: 0,
        total_spent: 0,
        created_at_ms: Date.now(),
      });
      if (insertError) {
        console.warn('[API_AUTH_SIGNIN] fallback profile insert warning:', insertError.message);
      }
    }

    const roleHome = getRoleHomeRoute({
      role: upperRole,
      email,
      isSuperAdmin: isRoot,
      assignedUnits: Array.isArray(profileRow?.assigned_units) ? profileRow.assigned_units : undefined,
    });

    const redirectTo = resolveSafeNext(nextParam, redirectParam, upperRole, isRoot, roleHome);

    return NextResponse.json({
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email || email,
        displayName,
      },
      redirectTo,
    });
  } catch (error) {
    console.error('[API_AUTH_SIGNIN]', error);
    return NextResponse.json(
      { error: 'We could not sign you in right now. Please try again.' },
      { status: 500 }
    );
  }
}
