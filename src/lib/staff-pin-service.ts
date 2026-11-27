import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { ROOT_ADMIN_EMAILS } from './admin-identity';
import type { Firestore } from 'firebase-admin/firestore';

export const PIN_ENROLLMENT_VERSION = 'staff-pin-2026-11-26-v1';
const STAFF_ROLES = new Set(['ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'STOREKEEPER', 'ATTENDANT', 'KITCHEN']);
export class PinError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}
function digest(pin: string, salt: string, pepper: string) {
  return scryptSync(pin, salt + pepper, 64);
}

/** UID is supplied exclusively by verified Firebase authentication, never request data. */
export async function staffPinOperation(db: Firestore, identity: { uid: string; auth_time: number; email?: string; email_verified?: boolean }, body: Record<string, unknown>, pepper: string, now = Date.now()) {
  if (!pepper) throw new PinError('PIN_CONFIGURATION', 503, 'PIN security is not configured. Contact your administrator.');
  const action = body.action;
  if (!['status', 'enroll', 'verify'].includes(String(action))) throw new PinError('INVALID_ACTION', 400, 'Invalid PIN operation.');
  if ('targetUid' in body || 'uid' in body) throw new PinError('SELF_ONLY', 403, 'PIN operations are restricted to your signed-in account.');
  const credential = db.collection('staff_pin_credentials').doc(identity.uid);
  const user = db.collection('users').doc(identity.uid);
  return db.runTransaction(async tx => {
    const profile = await tx.get(user);
    const role = profile.get('role');
    if (!profile.exists || profile.get('disabled') === true || profile.get('active') === false || profile.get('status') === 'DISABLED') {
      throw new PinError('STAFF_REQUIRED', 403, 'An active staff account is required.');
    }
    const hasStaffRole = typeof role === 'string' && STAFF_ROLES.has(role.toUpperCase());
    if (!hasStaffRole) {
      // Never use profile.email or request data for this privilege decision.
      // Email-based admin eligibility requires ownership verified by Firebase.
      const email = typeof identity.email === 'string' ? identity.email.toLowerCase().trim() : '';
      const safeEmail = email && !email.includes('/') && email.length <= 254;
      const rootAdmin = safeEmail && ROOT_ADMIN_EMAILS.includes(email);
      const registryAdmin = safeEmail && (await tx.get(db.collection('admins').doc(email))).exists;
      if (!rootAdmin && !registryAdmin) throw new PinError('STAFF_REQUIRED', 403, 'An active staff account is required.');
      if (identity.email_verified !== true) {
        throw new PinError('ADMIN_EMAIL_VERIFICATION_REQUIRED', 403, 'Verify your account email and sign in again to use administrator PIN setup.');
      }
    }
    const state = await tx.get(credential);
    const enrolled = state.exists && state.get('version') === PIN_ENROLLMENT_VERSION && typeof state.get('hash') === 'string' && typeof state.get('salt') === 'string';
    if (action === 'status') return { enrolled };
    const pin = body.pin;
    if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) throw new PinError('PIN_FORMAT', 400, 'Choose exactly four digits.');
    if (action === 'enroll') {
      if (typeof body.confirmPin !== 'string' || body.confirmPin !== pin) throw new PinError('PIN_MISMATCH', 400, 'The PIN entries do not match.');
      if (!Number.isFinite(identity.auth_time) || now / 1000 - identity.auth_time > 15 * 60 || identity.auth_time > now / 1000 + 60) {
        throw new PinError('RECENT_LOGIN_REQUIRED', 401, 'Sign out and sign in again before creating your new PIN.');
      }
      if (enrolled) throw new PinError('ALREADY_ENROLLED', 409, 'Your new PIN is already set. Use it to unlock this terminal.');
      const salt = randomBytes(16).toString('hex');
      tx.set(credential, { version: PIN_ENROLLMENT_VERSION, salt, hash: digest(pin, salt, pepper).toString('hex'), failures: 0, blockedUntil: 0, enrolledAt: now });
      return { enrolled: true, success: true };
    }
    if (!enrolled) throw new PinError('ENROLLMENT_REQUIRED', 409, 'Create your new four-digit PIN first.');
    if (Number(state.get('blockedUntil') || 0) > now) return { success: false, code: 'PIN_RATE_LIMIT', error: 'Too many attempts. Try again in 10 minutes.' };
    const expected = Buffer.from(state.get('hash'), 'hex');
    const actual = digest(pin, state.get('salt'), pepper);
    const valid = expected.length === actual.length && timingSafeEqual(expected, actual);
    const failures = Number(state.get('failures') || 0) + 1;
    tx.update(credential, valid ? { failures: 0, blockedUntil: 0 } : { failures: failures >= 5 ? 0 : failures, blockedUntil: failures >= 5 ? now + 10 * 60 * 1000 : 0 });
    return valid ? { success: true } : { success: false, code: failures >= 5 ? 'PIN_RATE_LIMIT' : 'INCORRECT_PIN', error: failures >= 5 ? 'Too many attempts. Try again in 10 minutes.' : 'Incorrect PIN.' };
  });
}
