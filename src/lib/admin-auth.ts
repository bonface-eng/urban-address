import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import * as admin from '@/lib/db/admin';
import { getAdminApp, getDbAdmin } from '@/lib/db/admin';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const ROOT_ADMIN_EMAILS = [
  'gackstoneb@gmail.com',
  'bonfacewana3072@gmail.com',
  'urbanautoexpressnakuru@gmail.com',
  'urbanaautoexpressnakuru@gmail.com',
  'samuelkarani044@gmail.com',
  'gmaina424@gmail.com',
];

export const VALID_STAFF_ROLES = [
  'ADMIN',
  'MANAGER',
  'SUPERVISOR',
  'CASHIER',
  'STOREKEEPER',
  'ATTENDANT',
  'KITCHEN',
] as const;

export interface VerifiedAdminCaller {
  uid: string;
  email: string;
  role: string;
  isSuperAdmin: boolean;
  app: admin.app.App;
  auth: admin.auth.Auth;
  db: admin.firestore.Firestore;
}

function getPinPepper(): string {
  const configured = process.env.STAFF_PIN_PEPPER?.trim();
  if (configured && configured !== '[SENSITIVE]') return configured;
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (fallback) return fallback;
  return 'uax-terminal-pin-v2';
}

export function createPinHash(pin: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pin, salt + getPinPepper(), 64).toString('hex');
  return { salt, hash };
}

export function verifyPinHash(pin: string, salt: string, expectedHash: string): boolean {
  if (!salt || !expectedHash) return false;
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = scryptSync(pin, salt + getPinPepper(), 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Verifies a caller's identity via Bearer access token (or SSR session cookie fallback)
 * and checks ADMIN (or optional MANAGER/SUPERVISOR) authorization against Supabase
 * `public.profiles` and `public.admins` — with NO daily OTP or legacy claim blockers.
 */
export async function verifyAdminCaller(
  tokenOrNull?: string | null,
  options?: { allowManagers?: boolean }
): Promise<VerifiedAdminCaller> {
  const app = getAdminApp();
  const auth = admin.auth(app);
  const db = getDbAdmin();
  const supaAdmin = getSupabaseAdminClient();

  let uid = '';
  let email = '';

  const cleanToken = typeof tokenOrNull === 'string' ? tokenOrNull.trim() : '';
  if (cleanToken) {
    const decoded = await auth.verifyIdToken(cleanToken);
    uid = decoded.uid;
    email = String(decoded.email || '').trim().toLowerCase();
  } else {
    const serverSupa = await createSupabaseServerClient();
    const { data, error } = await serverSupa.auth.getUser();
    if (error || !data?.user) {
      throw new Error('ADMIN_AUTH_TOKEN_REQUIRED');
    }
    uid = data.user.id;
    email = String(data.user.email || '').trim().toLowerCase();
  }

  const [{ data: profileRow }, { data: adminRow }] = await Promise.all([
    supaAdmin
      .from('profiles')
      .select('id, uid, email, role, is_super_admin, disabled')
      .or(`id.eq.${uid},uid.eq.${uid}`)
      .maybeSingle(),
    email
      ? supaAdmin.from('admins').select('email, is_root').ilike('email', email).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (profileRow?.disabled === true) {
    throw new Error('ACCOUNT_DISABLED');
  }

  const role = String(profileRow?.role || '').toUpperCase();
  const isSuperAdmin =
    email === 'gackstoneb@gmail.com' ||
    profileRow?.is_super_admin === true ||
    ROOT_ADMIN_EMAILS.includes(email) ||
    Boolean(adminRow?.email);

  const isAdmin = isSuperAdmin || role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isManager = options?.allowManagers && (role === 'MANAGER' || role === 'SUPERVISOR');

  if (!isAdmin && !isManager) {
    throw new Error('ADMIN_PRIVILEGES_REQUIRED');
  }

  return {
    uid,
    email,
    role: isAdmin ? 'ADMIN' : role,
    isSuperAdmin,
    app,
    auth,
    db,
  };
}

export async function authorizeAdminRequest(
  request: NextRequest,
  options?: { allowManagers?: boolean }
): Promise<VerifiedAdminCaller | null> {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  try {
    return await verifyAdminCaller(token || null, options);
  } catch {
    return null;
  }
}
