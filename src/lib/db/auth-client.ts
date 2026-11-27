'use client';

/**
 * src/lib/db/auth-client.ts
 *
 * Client-side Supabase Auth layer.
 * Wraps @supabase/supabase-js Auth methods and exposes a normalized User object
 * that supports both Supabase and existing application properties (.uid, .email,
 * .displayName, .photoURL, .emailVerified, .getIdToken, .getIdTokenResult, .reload).
 */

import type { SupabaseClient, User as SupabaseUser, Session } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase/config';

export interface User {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
  providerData: Array<{ providerId: string; uid: string; email: string | null; displayName: string | null }>;
  app_metadata: Record<string, any>;
  user_metadata: Record<string, any>;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
  getIdTokenResult: (forceRefresh?: boolean) => Promise<{ token: string; claims: Record<string, any> }>;
  reload: () => Promise<void>;
}

export interface UserCredential {
  user: User;
}

export type Auth = SupabaseClient;

export function adaptSupabaseUser(
  supaUser: SupabaseUser | null | undefined,
  session?: Session | null,
  client?: SupabaseClient
): User | null {
  if (!supaUser) return null;
  const supa = client || getSupabaseBrowserClient();
  const userMeta = supaUser.user_metadata || {};
  const appMeta = supaUser.app_metadata || {};

  const uid = String(appMeta.firebase_uid || supaUser.id);
  const displayName =
    userMeta.display_name ||
    userMeta.full_name ||
    userMeta.name ||
    (supaUser.email ? supaUser.email.split('@')[0] : null);
  const photoURL = userMeta.avatar_url || userMeta.photo_url || userMeta.picture || null;
  const emailVerified = Boolean(
    supaUser.email_confirmed_at ||
    userMeta.email_verified === true ||
    appMeta.email_verified === true
  );

  const providers: string[] = Array.isArray(appMeta.providers)
    ? appMeta.providers
    : appMeta.provider
      ? [String(appMeta.provider)]
      : ['email'];

  const providerData = providers.map(p => ({
    providerId: p === 'email' ? 'password' : p === 'google' ? 'google.com' : p,
    uid: supaUser.id,
    email: supaUser.email || null,
    displayName,
  }));

  return {
    id: supaUser.id,
    uid,
    email: supaUser.email || null,
    displayName,
    photoURL,
    phoneNumber: supaUser.phone || userMeta.phone_number || null,
    emailVerified,
    providerData,
    app_metadata: appMeta,
    user_metadata: userMeta,
    getIdToken: async (forceRefresh?: boolean) => {
      if (forceRefresh) {
        const { data } = await supa.auth.refreshSession();
        if (data?.session?.access_token) return data.session.access_token;
      }
      const { data } = await supa.auth.getSession();
      return data?.session?.access_token || session?.access_token || '';
    },
    getIdTokenResult: async (forceRefresh?: boolean) => {
      let currentUser = supaUser;
      let token = session?.access_token || '';
      if (forceRefresh) {
        const [{ data: sessionData }, { data: userData }] = await Promise.all([
          supa.auth.refreshSession(),
          supa.auth.getUser(),
        ]);
        if (sessionData?.session?.access_token) token = sessionData.session.access_token;
        if (userData?.user) currentUser = userData.user;
      } else {
        const { data } = await supa.auth.getSession();
        if (data?.session?.access_token) token = data.session.access_token;
      }
      const claims = {
        ...(currentUser.user_metadata || {}),
        ...(currentUser.app_metadata || {}),
        email: currentUser.email,
        sub: currentUser.id,
      };
      return { token, claims };
    },
    reload: async () => {
      await supa.auth.getUser();
    },
  };
}

let currentCachedUser: User | null = null;

export function getAuth(appOrClient?: any): Auth & { currentUser: User | null } {
  const client = (appOrClient && typeof appOrClient.auth === 'object' ? appOrClient : getSupabaseBrowserClient()) as Auth & {
    currentUser: User | null;
  };
  if (!('currentUser' in client)) {
    Object.defineProperty(client, 'currentUser', {
      get() {
        return currentCachedUser;
      },
      configurable: true,
    });
  }
  return client;
}

export function initializeApp(_config?: any, name?: string): SupabaseClient {
  if (name) {
    // Ephemeral secondary client (e.g. for terminal enrollment verification without overwriting current session)
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: `sb-${name}-auth-token`,
      },
    });
  }
  return getSupabaseBrowserClient();
}

export function getApps(): SupabaseClient[] {
  return [getSupabaseBrowserClient()];
}

export function getApp(): SupabaseClient {
  return getSupabaseBrowserClient();
}

export async function deleteApp(_app?: any): Promise<void> {
  // No-op for ephemeral Supabase client
}

export function onAuthStateChanged(
  auth: any,
  callback: (user: User | null) => void
): () => void {
  const client: SupabaseClient = auth && typeof auth.auth?.onAuthStateChange === 'function'
    ? auth
    : getSupabaseBrowserClient();

  let active = true;

  client.auth.getSession().then(({ data }) => {
    if (!active) return;
    const adapted = adaptSupabaseUser(data?.session?.user, data?.session, client);
    currentCachedUser = adapted;
    callback(adapted);
  }).catch(() => {
    if (active) callback(null);
  });

  const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
    if (!active) return;
    const adapted = adaptSupabaseUser(session?.user, session, client);
    currentCachedUser = adapted;
    callback(adapted);
  });

  return () => {
    active = false;
    subscription?.subscription?.unsubscribe();
  };
}

export async function signInWithEmailAndPassword(
  auth: any,
  email: string,
  password: string
): Promise<UserCredential> {
  const client: SupabaseClient = auth && typeof auth.auth?.signInWithPassword === 'function'
    ? auth
    : getSupabaseBrowserClient();

  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !data.user) {
    const err = new Error(error?.message || 'Invalid email or password.') as Error & { code?: string };
    const msg = (error?.message || '').toLowerCase();
    err.code = msg.includes('rate limit') || msg.includes('too many')
      ? 'auth/too-many-requests'
      : msg.includes('banned') || msg.includes('disabled')
        ? 'auth/user-disabled'
        : 'auth/invalid-credential';
    throw err;
  }

  let finalUser = data.user;
  let finalSession = data.session;

  // If this account previously used a terminal PIN switch, clear the restricted
  // terminal_staff_session claim now that the staff member proved their password.
  if (
    typeof window !== 'undefined' &&
    typeof fetch === 'function' &&
    finalSession?.access_token &&
    (finalUser.app_metadata?.terminal_staff_session || finalUser.app_metadata?.terminalStaffSession)
  ) {
    try {
      const clearRes = await fetch('/api/auth/clear-terminal-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${finalSession.access_token}` },
      });
      if (clearRes.ok) {
        const refreshed = await client.auth.refreshSession();
        if (refreshed.data?.session) {
          finalSession = refreshed.data.session;
          finalUser = refreshed.data.session.user;
        }
      }
    } catch {
      // Non-fatal in offline/test environments
    }
  }

  const adapted = adaptSupabaseUser(finalUser, finalSession, client)!;
  currentCachedUser = adapted;
  return { user: adapted };
}

export async function createUserWithEmailAndPassword(
  auth: any,
  email: string,
  password: string
): Promise<UserCredential> {
  const client: SupabaseClient = auth && typeof auth.auth?.signUp === 'function'
    ? auth
    : getSupabaseBrowserClient();

  const { data, error } = await client.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !data.user) {
    const err = new Error(error?.message || 'Could not create account.') as Error & { code?: string };
    const msg = (error?.message || '').toLowerCase();
    err.code = msg.includes('already registered') || msg.includes('already exists')
      ? 'auth/email-already-in-use'
      : msg.includes('password')
        ? 'auth/weak-password'
        : msg.includes('email')
          ? 'auth/invalid-email'
          : 'auth/operation-not-allowed';
    throw err;
  }

  let finalUser = data.user;
  let finalSession = data.session;

  // If this account previously used a terminal PIN switch, clear the restricted
  // terminal_staff_session claim now that the staff member proved their password.
  if (
    typeof window !== 'undefined' &&
    typeof fetch === 'function' &&
    finalSession?.access_token &&
    (finalUser.app_metadata?.terminal_staff_session || finalUser.app_metadata?.terminalStaffSession)
  ) {
    try {
      const clearRes = await fetch('/api/auth/clear-terminal-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${finalSession.access_token}` },
      });
      if (clearRes.ok) {
        const refreshed = await client.auth.refreshSession();
        if (refreshed.data?.session) {
          finalSession = refreshed.data.session;
          finalUser = refreshed.data.session.user;
        }
      }
    } catch {
      // Non-fatal in offline/test environments
    }
  }

  const adapted = adaptSupabaseUser(finalUser, finalSession, client)!;
  currentCachedUser = adapted;
  return { user: adapted };
}

export class GoogleAuthProvider {
  private params: Record<string, string> = {};
  setCustomParameters(params: Record<string, string>) {
    this.params = { ...this.params, ...params };
  }
  getCustomParameters() {
    return this.params;
  }
}

export async function signInWithPopup(
  auth: any,
  provider?: GoogleAuthProvider
): Promise<UserCredential> {
  const client: SupabaseClient = auth && typeof auth.auth?.signInWithOAuth === 'function'
    ? auth
    : getSupabaseBrowserClient();

  const redirectTo = typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : undefined;

  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: provider?.getCustomParameters?.() || { prompt: 'select_account' },
    },
  });

  if (error) {
    const err = new Error(error.message) as Error & { code?: string };
    err.code = 'auth/operation-not-allowed';
    throw err;
  }

  const { data } = await client.auth.getSession();
  if (data?.session?.user) {
    const adapted = adaptSupabaseUser(data.session.user, data.session, client)!;
    currentCachedUser = adapted;
    return { user: adapted };
  }

  // OAuth redirect initiated; throw popup-closed code so caller doesn't show an error toast before navigation completes
  const redirectSignal = new Error('Redirecting to Google Sign-In...') as Error & { code?: string };
  redirectSignal.code = 'auth/popup-closed-by-user';
  throw redirectSignal;
}

/**
 * Establishes a Supabase session for POS Terminal PIN switching.
 * Accepts either a JSON-encoded `{ access_token, refresh_token }` token string
 * returned by `/api/terminal/pin` or a legacy custom token string.
 */
export async function signInWithCustomToken(
  auth: any,
  customToken: string
): Promise<UserCredential> {
  const client: SupabaseClient = auth && typeof auth.auth?.setSession === 'function'
    ? auth
    : getSupabaseBrowserClient();

  let parsed: { access_token?: string; refresh_token?: string } | null = null;
  try {
    parsed = JSON.parse(customToken);
  } catch {
    // If token is a base64url-encoded JSON payload
    try {
      parsed = JSON.parse(atob(customToken));
    } catch {
      parsed = null;
    }
  }

  if (parsed?.access_token && parsed?.refresh_token) {
    const { data, error } = await client.auth.setSession({
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
    });
    if (error || !data.user) {
      throw new Error(error?.message || 'Failed to establish terminal PIN session.');
    }
    const adapted = adaptSupabaseUser(data.user, data.session, client)!;
    currentCachedUser = adapted;
    return { user: adapted };
  }

  const { data } = await client.auth.getUser();
  if (data?.user) {
    const adapted = adaptSupabaseUser(data.user, null, client)!;
    currentCachedUser = adapted;
    return { user: adapted };
  }

  throw new Error('Invalid terminal session token.');
}

export async function signOut(auth?: any): Promise<void> {
  const client: SupabaseClient = auth && typeof auth.auth?.signOut === 'function'
    ? auth
    : getSupabaseBrowserClient();
  currentCachedUser = null;
  await client.auth.signOut();
}

export async function updateProfile(
  user: User,
  profile: { displayName?: string | null; photoURL?: string | null }
): Promise<void> {
  const client = getSupabaseBrowserClient();
  await client.auth.updateUser({
    data: {
      ...(profile.displayName !== undefined ? { display_name: profile.displayName, full_name: profile.displayName } : {}),
      ...(profile.photoURL !== undefined ? { avatar_url: profile.photoURL, photo_url: profile.photoURL } : {}),
    },
  });
  if (profile.displayName !== undefined) user.displayName = profile.displayName;
  if (profile.photoURL !== undefined) user.photoURL = profile.photoURL;
}

export class EmailAuthProvider {
  static credential(email: string, password: string) {
    return { providerId: 'password', email, password };
  }
}

export async function reauthenticateWithCredential(
  user: User,
  credential: { email: string; password: string }
): Promise<UserCredential> {
  return signInWithEmailAndPassword(getSupabaseBrowserClient(), credential.email || user.email || '', credential.password);
}

export async function updatePassword(_user: User, newPassword: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) {
    const err = new Error(error.message) as Error & { code?: string };
    err.code = error.message.toLowerCase().includes('weak') ? 'auth/weak-password' : 'auth/requires-recent-login';
    throw err;
  }
}

export async function verifyPasswordResetCode(_auth: any, code: string): Promise<string> {
  const client = getSupabaseBrowserClient();
  // If user already has an active recovery session from Supabase link, return their email
  const { data: sessionData } = await client.auth.getSession();
  if (sessionData?.session?.user?.email) {
    return sessionData.session.user.email;
  }
  // Exchange token_hash or PKCE code from URL
  const { data, error } = await client.auth.verifyOtp({
    token_hash: code,
    type: 'recovery',
  });
  if (error || !data?.user?.email) {
    throw new Error(error?.message || 'Invalid or expired password reset code.');
  }
  return data.user.email;
}

export async function confirmPasswordReset(_auth: any, _code: string, newPassword: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) {
    throw new Error(error.message || 'Could not update password.');
  }
}

export async function applyActionCode(_auth: any, code: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { error } = await client.auth.verifyOtp({
    token_hash: code,
    type: 'email',
  });
  if (error) {
    throw new Error(error.message || 'Verification link expired.');
  }
}
