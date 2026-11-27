import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './config';

/** Staff / authenticated-only areas. Role checks happen in the app shell, RLS and API routes. */
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/admin',
  '/inventory',
  '/finance',
  '/employees',
  '/reports',
  '/settings',
  '/sales-history',
  '/suppliers',
  '/customers',
  '/attendants',
  '/kds',
  '/store',
  '/lounge',
  '/carwash',
  '/staff',
  '/setup-profile',
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/**
 * Refreshes the Supabase Auth session cookie on every request and redirects
 * signed-out visitors away from protected routes.
 */
export async function updateSupabaseSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return supabaseResponse;
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // getUser() validates the JWT with Supabase Auth and refreshes it if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  const { pathname } = request.nextUrl;
  if (!user && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', pathname);
    const redirect = NextResponse.redirect(url);
    // Preserve any refreshed/cleared auth cookies.
    supabaseResponse.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  if (user && isProtected(pathname)) {
    const isBanned = user.banned_until && new Date(user.banned_until) > new Date();
    if (isBanned) {
      await supabase.auth.signOut().catch(() => undefined);
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '?error=suspended';
      const redirect = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      return redirect;
    }
  }

  return supabaseResponse;
}
