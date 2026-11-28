import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server';
import { getRoleHomeRoute } from '@/lib/role-routing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TERMS_VERSION = '2024-08';

function getPasswordStrengthScore(password: string): number {
  let strength = 0;
  if (password.length >= 8) strength += 25;
  if (/[A-Z]/.test(password)) strength += 25;
  if (/[0-9]/.test(password)) strength += 25;
  if (/[^A-Za-z0-9]/.test(password)) strength += 25;
  return strength;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
    }

    const fullName = String(body.fullName ?? body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';
    const acceptTerms = body.acceptTerms === true;
    const marketingOptIn = body.marketingOptIn === true;

    if (!fullName || fullName.length < 2 || fullName.length > 100) {
      return NextResponse.json(
        { error: 'Please enter your full name (2–100 characters).', field: 'fullName' },
        { status: 400 }
      );
    }

    if (!email || !EMAIL_PATTERN.test(email) || email.length > 254) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.', field: 'email' },
        { status: 400 }
      );
    }

    if (password.length < 8 || password.length > 128 || getPasswordStrengthScore(password) < 50) {
      return NextResponse.json(
        {
          error: 'Password must be at least 8 characters and include an uppercase letter, number, or symbol.',
          field: 'password',
        },
        { status: 400 }
      );
    }

    if (confirmPassword !== password) {
      return NextResponse.json(
        { error: 'Passwords do not match.', field: 'confirmPassword' },
        { status: 400 }
      );
    }

    if (!acceptTerms) {
      return NextResponse.json(
        { error: 'Please accept the Terms and Conditions to create an account.', field: 'acceptTerms' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          display_name: fullName,
        },
      },
    });

    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('already exists')) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please sign in instead.', field: 'email' },
          { status: 409 }
        );
      }
      if (msg.includes('password') || msg.includes('weak')) {
        return NextResponse.json(
          { error: 'Please choose a stronger password with at least 8 characters, an uppercase letter, a number, or a symbol.', field: 'password' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Could not complete registration right now. Please try again.' },
        { status: 400 }
      );
    }

    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in instead.', field: 'email' },
        { status: 409 }
      );
    }

    let activeUser = data.user;
    let activeSession = data.session;

    if (!activeSession && activeUser) {
      const supaAdmin = getSupabaseAdminClient();
      await supaAdmin.auth.admin.updateUserById(activeUser.id, { email_confirm: true }).catch(() => undefined);
      const signInRes = await supabase.auth.signInWithPassword({ email, password });
      if (signInRes.data.session && signInRes.data.user) {
        activeSession = signInRes.data.session;
        activeUser = signInRes.data.user;
      }
    }

    if (!activeUser) {
      return NextResponse.json(
        { error: 'Could not create your account. Please try again.' },
        { status: 500 }
      );
    }

    const supaAdmin = getSupabaseAdminClient();
    const now = Date.now();
    const displayName = fullName || email.split('@')[0] || 'Urban Member';

    const { data: existingProfile } = await supaAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', activeUser.id)
      .maybeSingle();

    const resolvedRole = existingProfile?.role || 'CLIENT';
    if (existingProfile) {
      await supaAdmin
        .from('profiles')
        .update({
          display_name: displayName,
          terms_accepted_at: now,
          terms_version: TERMS_VERSION,
          marketing_opt_in: marketingOptIn,
          marketing_consent: marketingOptIn,
          ...(marketingOptIn ? { marketing_consent_updated_at: now, marketing_consent_source: 'signup' } : {}),
        })
        .eq('id', activeUser.id);
    } else {
      await supaAdmin.from('profiles').insert({
        id: activeUser.id,
        uid: activeUser.id,
        firebase_id: activeUser.id,
        email,
        display_name: displayName,
        role: 'CLIENT',
        account_type: 'CLIENT',
        loyalty_points: 0,
        total_spent: 0,
        terms_accepted_at: now,
        terms_version: TERMS_VERSION,
        marketing_opt_in: marketingOptIn,
        marketing_consent: marketingOptIn,
        ...(marketingOptIn ? { marketing_consent_updated_at: now, marketing_consent_source: 'signup' } : {}),
        created_at_ms: now,
      });
    }

    const redirectTo = getRoleHomeRoute({ role: resolvedRole, email });

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: activeUser.id,
          email: activeUser.email || email,
          displayName,
        },
        redirectTo,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API_AUTH_SIGNUP]', error);
    return NextResponse.json(
      { error: 'We could not process your registration right now. Please try again.' },
      { status: 500 }
    );
  }
}
