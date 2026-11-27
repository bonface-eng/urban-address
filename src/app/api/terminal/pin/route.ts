import { NextRequest, NextResponse } from 'next/server';
import * as admin from '@/lib/db/admin';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getAdminApp, getDbAdmin } from '@/lib/db/admin';
import { notifyTelegramOperations } from '@/lib/telegram/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAFF_ROLES = new Set(['ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'STOREKEEPER', 'ATTENDANT', 'KITCHEN']);
const DEVICE_ID_PATTERN = /^[a-zA-Z0-9_-]{16,80}$/;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function authenticatedStaff(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new Error('AUTH_REQUIRED');

  getAdminApp();
  const decoded = await admin.auth().verifyIdToken(token);
  const db = getDbAdmin();
  const profileSnap = await db.collection('users').doc(decoded.uid).get();
  if (!profileSnap.exists) throw new Error('STAFF_REQUIRED');
  const profile = profileSnap.data() || {};
  const role = String(profile.role || '').toUpperCase();
  if (!STAFF_ROLES.has(role)) throw new Error('STAFF_REQUIRED');
  return { uid: decoded.uid, profile, db };
}

function hashPin(pin: string, salt: string) {
  const pepper = process.env.STAFF_PIN_PEPPER;
  if (!pepper) throw new Error('STAFF_PIN_PEPPER_REQUIRED');
  return scryptSync(pin, salt + pepper, 64).toString('hex');
}

function safeProfile(uid: string, profile: Record<string, any>) {
  const { pin: _pin, pinHash: _pinHash, masterKey: _masterKey, password: _password, ...safe } = profile;
  return { ...safe, uid };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body?.action || '');
    const deviceId = String(body?.deviceId || '');
    const targetUid = String(body?.targetUid || '');
    if (!DEVICE_ID_PATTERN.test(deviceId) || !targetUid || targetUid.length > 128) {
      return jsonError('Invalid terminal or staff account.', 400);
    }

    const { uid: actorUid, db } = await authenticatedStaff(request);
    const deviceRef = db.collection('terminal_devices').doc(deviceId);
    const memberRef = deviceRef.collection('staff_members').doc(targetUid);
    const [deviceState, stationState] = await Promise.all([
      deviceRef.get(),
      db.collection('pos_terminals').doc(deviceId).get(),
    ]);
    if ((deviceState.exists && deviceState.data()?.disabled === true) ||
        (stationState.exists && (stationState.data()?.disabled === true || stationState.data()?.locked === true))) {
      return jsonError('This terminal has been locked or disabled by an administrator.', 423);
    }

    if (action === 'register') {
      if (actorUid !== targetUid) return jsonError('Staff members must register their own account.', 403);
      const userSnap = await db.collection('users').doc(targetUid).get();
      if (!userSnap.exists) return jsonError('Staff profile not found.', 404);
      const profile = userSnap.data() || {};
      // Remove legacy credentials from the public staff profile once the owner
      // has proven control of this Supabase account.
      await db.collection('users').doc(targetUid).update({
        pin: admin.firestore.FieldValue.delete(),
        masterKey: admin.firestore.FieldValue.delete(),
      });
      await db.runTransaction(async transaction => {
        const existing = await transaction.get(memberRef);
        transaction.set(memberRef, {
          uid: targetUid,
          displayName: String(profile.displayName || 'Staff member').slice(0, 120),
          email: String(profile.email || '').slice(0, 254),
          role: String(profile.role || '').toUpperCase(),
          photoURL: typeof profile.photoURL === 'string' ? profile.photoURL.slice(0, 1000) : null,
          registeredAt: existing.exists ? existing.get('registeredAt') : admin.firestore.FieldValue.serverTimestamp(),
          lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      });
      const memberSnap = await memberRef.get();
      return NextResponse.json({ profile: safeProfile(targetUid, profile), hasPin: Boolean(memberSnap.get('pinHash')), disclaimerAcknowledged: memberSnap.get('disclaimerVersion') === 'terminal-pin-v1' });
    }

    if (action === 'acknowledge-disclaimer') {
      if (actorUid !== targetUid) return jsonError('Only the account owner can acknowledge this notice.', 403);
      const membership = await memberRef.get();
      if (!membership.exists) return jsonError('Register this staff account on the device first.', 404);
      await memberRef.set({ disclaimerAcknowledgedAt: admin.firestore.FieldValue.serverTimestamp(), disclaimerVersion: 'terminal-pin-v1' }, { merge: true });
      return NextResponse.json({ success: true });
    }

    if (action === 'set-pin') {
      if (actorUid !== targetUid) return jsonError('Only the account owner can create its PIN.', 403);
      const pin = String(body?.pin || '');
      if (!/^\d{4,6}$/.test(pin)) return jsonError('Choose a 4 to 6 digit PIN.', 400);
      const memberSnap = await memberRef.get();
      if (!memberSnap.exists) return jsonError('Register this staff account on the device first.', 404);
      if (!memberSnap.get('disclaimerAcknowledgedAt')) return jsonError('Read and acknowledge the terminal security update before setting a PIN.', 409);
      const salt = randomBytes(16).toString('hex');
      await memberRef.update({
        pinSalt: salt,
        pinHash: hashPin(pin, salt),
        pinUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'verify-pin') {
      const pin = String(body?.pin || '');
      if (!/^\d{4,6}$/.test(pin)) return jsonError('Invalid PIN.', 400);
      const targetProfileSnap = await db.collection('users').doc(targetUid).get();
      const targetRole = String(targetProfileSnap.get('role') || '').toUpperCase();
      if (!targetProfileSnap.exists || !STAFF_ROLES.has(targetRole)) return jsonError('This account is no longer authorized for staff access.', 403);
      const memberSnap = await memberRef.get();
      if (!memberSnap.exists || !memberSnap.get('pinHash') || !memberSnap.get('pinSalt')) {
        return jsonError('This staff account has not enrolled a device PIN. Sign in to add the account and set one.', 409);
      }

      // Rate-limit by staff UID rather than the browser-supplied device ID so
      // clearing local storage cannot reset the PIN attempt counter.
      const attemptRef = db.collection('terminal_pin_attempts').doc(targetUid);
      const expected = Buffer.from(String(memberSnap.get('pinHash')), 'hex');
      const actual = Buffer.from(hashPin(pin, String(memberSnap.get('pinSalt'))), 'hex');
      const valid = expected.length === actual.length && timingSafeEqual(expected, actual);
      let blocked = false;

      await db.runTransaction(async transaction => {
        blocked = false;
        const snap = await transaction.get(attemptRef);
        const now = Date.now();
        const blockedUntil = Number(snap.get('blockedUntil') || 0);
        if (blockedUntil > now) {
          blocked = true;
          return;
        }
        if (valid) {
          transaction.delete(attemptRef);
          return;
        }
        const failures = Number(snap.get('failures') || 0) + 1;
        blocked = failures >= 5;
        transaction.set(attemptRef, {
          failures: blocked ? 0 : failures,
          blockedUntil: blocked ? now + 10 * 60 * 1000 : 0,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      });

      if (blocked) return jsonError('Too many attempts. Try again in 10 minutes.', 429);
      if (!valid) return jsonError('Incorrect PIN.', 401);

      const customToken = await admin.auth().createCustomToken(targetUid, {
        terminalDeviceId: deviceId,
        terminalStaffSession: true,
        actorUid,
      });
      const targetProfile = targetProfileSnap.data() || {};
      const staffName = String(targetProfile.displayName || targetProfile.email || targetUid).slice(0, 120);
      const staffRole = targetRole;
      const signedInAt = Date.now();
      await db.collection('audit_logs').add({
        action: 'TERMINAL_PIN_SIGN_IN',
        userId: targetUid,
        actorId: actorUid,
        details: `${staffName} signed in to a POS terminal using their staff PIN.`,
        deviceId,
        role: staffRole,
        timestamp: signedInAt,
        severity: 'INFO',
      });
      const terminalName = String(deviceState.data()?.name || deviceState.data()?.terminalName || deviceState.data()?.label || deviceId).slice(0, 80);
      void notifyTelegramOperations({
        type: 'SECURITY',
        title: `POS SIGN-IN | ${terminalName.toUpperCase()}`,
        message: `${staffName} (${staffRole}) signed in using a staff PIN. POS station: ${terminalName} (${deviceId}). Time: ${new Date(signedInAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}.`,
      }).catch(error => console.error('[TELEGRAM_PIN_SIGN_IN]', error));
      return NextResponse.json({ customToken });
    }

    return jsonError('Unsupported terminal action.', 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'AUTH_REQUIRED') return jsonError('Sign in is required.', 401);
    if (message === 'STAFF_REQUIRED') return jsonError('A valid staff account is required.', 403);
    console.error('[TERMINAL_ACCESS]', error);
    return jsonError('Terminal authentication could not be completed.', 500);
  }
}
