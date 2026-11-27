import { NextRequest, NextResponse } from 'next/server';
import * as admin from '@/lib/db/admin';
import { getAdminApp, getDbAdmin } from '@/lib/db/admin';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { createPinHash, verifyPinHash, ROOT_ADMIN_EMAILS } from '@/lib/admin-auth';
import { notifyTelegramOperations } from '@/lib/telegram/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAFF_ROLES = new Set(['ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'STOREKEEPER', 'ATTENDANT', 'KITCHEN']);
const DEVICE_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function authenticatedStaff(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new Error('AUTH_REQUIRED');

  getAdminApp();
  const decoded = await admin.auth().verifyIdToken(token);
  const email = String(decoded.email || '').trim().toLowerCase();
  const db = getDbAdmin();
  const supaAdmin = getSupabaseAdminClient();
  const profileSnap = await db.collection('users').doc(decoded.uid).get();
  const profile = profileSnap.data() || {};
  if (profile.disabled === true) throw new Error('ACCOUNT_DISABLED');

  const role = String(profile.role || (ROOT_ADMIN_EMAILS.includes(email) ? 'ADMIN' : '')).toUpperCase();
  if (!STAFF_ROLES.has(role)) throw new Error('STAFF_REQUIRED');

  return { uid: decoded.uid, email, role, profile, db, supaAdmin };
}

function safeProfile(uid: string, profile: Record<string, any>, hasPin: boolean) {
  const { pin: _pin, pinHash: _pinHash, masterKey: _masterKey, password: _password, ...safe } = profile;
  return { ...safe, uid, hasPin, pinConfigured: hasPin };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body?.action || '');
    const { uid: actorUid, role: actorRole, profile: actorProfile, db, supaAdmin } = await authenticatedStaff(request);

    // Profile self-service optional PIN setup/change (from /settings without needing a terminal deviceId)
    if (action === 'set-own-pin') {
      const pin = String(body?.pin || '').trim();
      if (pin === '') {
        await supaAdmin.from('staff_pins').delete().eq('uid', actorUid);
        await supaAdmin.from('terminal_device_staff').update({ pin_salt: null, pin_hash: null }).eq('uid', actorUid);
        await supaAdmin.from('profiles').update({ has_pin: false, updated_at_ms: Date.now() }).eq('id', actorUid);
        return NextResponse.json({ success: true, hasPin: false });
      }
      if (!/^\d{4}$/.test(pin)) {
        return jsonError('Choose a 4-digit numeric PIN.', 400);
      }
      const { salt, hash } = createPinHash(pin);
      const nowIso = new Date().toISOString();
      await supaAdmin.from('staff_pins').upsert(
        { uid: actorUid, pin_salt: salt, pin_hash: hash, updated_at: nowIso },
        { onConflict: 'uid' }
      );
      await supaAdmin
        .from('terminal_device_staff')
        .update({ pin_salt: salt, pin_hash: hash, pin_updated_at: nowIso })
        .eq('uid', actorUid);
      await supaAdmin.from('profiles').update({ has_pin: true, updated_at_ms: Date.now() }).eq('id', actorUid);
      return NextResponse.json({ success: true, hasPin: true });
    }

    const deviceId = String(body?.deviceId || '');
    const targetUid = String(body?.targetUid || actorUid);
    if (!DEVICE_ID_PATTERN.test(deviceId) || !targetUid || targetUid.length > 128) {
      return jsonError('Invalid terminal or staff account.', 400);
    }

    const deviceRef = db.collection('terminal_devices').doc(deviceId);
    const memberRef = deviceRef.collection('staff_members').doc(targetUid);
    const [deviceState, stationState] = await Promise.all([
      deviceRef.get(),
      db.collection('pos_terminals').doc(deviceId).get(),
    ]);

    if (
      actorRole !== 'ADMIN' &&
      ((deviceState.exists && deviceState.data()?.disabled === true) ||
        (stationState.exists && (stationState.data()?.disabled === true || stationState.data()?.locked === true)))
    ) {
      return jsonError('This terminal has been locked or disabled by an administrator.', 423);
    }

    if (action === 'register') {
      if (actorUid !== targetUid && actorRole !== 'ADMIN') {
        return jsonError('Staff members must register their own account.', 403);
      }
      const userSnap = await db.collection('users').doc(targetUid).get();
      const profile = userSnap.exists ? userSnap.data() || {} : actorProfile;
      if (profile.disabled === true) return jsonError('This staff account has been deactivated.', 403);

      // Ensure parent terminal_devices row exists to satisfy foreign key on terminal_device_staff
      await supaAdmin
        .from('terminal_devices')
        .upsert({ id: deviceId, firebase_id: deviceId, updated_at_ms: Date.now() }, { onConflict: 'id' });

      const [{ data: globalPin }, existingMember] = await Promise.all([
        supaAdmin.from('staff_pins').select('pin_salt, pin_hash').eq('uid', targetUid).maybeSingle(),
        memberRef.get(),
      ]);

      const nowIso = new Date().toISOString();
      await supaAdmin.from('terminal_device_staff').upsert(
        {
          id: `${deviceId}_${targetUid}`,
          firebase_id: `${deviceId}_${targetUid}`,
          device_id: deviceId,
          uid: targetUid,
          display_name: String(profile.displayName || 'Staff member').slice(0, 120),
          email: String(profile.email || '').slice(0, 254),
          role: String(profile.role || actorRole || 'CASHIER').toUpperCase(),
          photo_url: typeof profile.photoURL === 'string' ? profile.photoURL.slice(0, 1000) : null,
          ...(globalPin?.pin_hash && globalPin?.pin_salt
            ? { pin_salt: globalPin.pin_salt, pin_hash: globalPin.pin_hash }
            : {}),
          registered_at: existingMember.exists ? existingMember.get('registeredAt') || nowIso : nowIso,
          last_seen_at: nowIso,
        },
        { onConflict: 'id' }
      );

      const hasPin = Boolean(globalPin?.pin_hash || existingMember.get('pinHash') || profile.hasPin);
      return NextResponse.json({
        profile: safeProfile(targetUid, profile, hasPin),
        hasPin,
      });
    }

    if (action === 'set-pin') {
      if (actorUid !== targetUid && actorRole !== 'ADMIN') {
        return jsonError('Only the account owner or an administrator can set its PIN.', 403);
      }
      const pin = String(body?.pin || '').trim();
      if (!/^\d{4}$/.test(pin)) return jsonError('Choose a 4-digit numeric PIN.', 400);

      const { salt, hash } = createPinHash(pin);
      const nowIso = new Date().toISOString();

      await supaAdmin
        .from('terminal_devices')
        .upsert({ id: deviceId, firebase_id: deviceId, updated_at_ms: Date.now() }, { onConflict: 'id' });

      await Promise.all([
        supaAdmin.from('staff_pins').upsert(
          { uid: targetUid, pin_salt: salt, pin_hash: hash, updated_at: nowIso },
          { onConflict: 'uid' }
        ),
        supaAdmin
          .from('terminal_device_staff')
          .update({ pin_salt: salt, pin_hash: hash, pin_updated_at: nowIso })
          .eq('uid', targetUid),
        supaAdmin.from('profiles').update({ has_pin: true, updated_at_ms: Date.now() }).eq('id', targetUid),
      ]);

      return NextResponse.json({ success: true, hasPin: true });
    }

    if (action === 'verify-pin') {
      const pin = String(body?.pin || '').trim();
      if (!/^\d{4}$/.test(pin)) return jsonError('Enter your 4-digit PIN.', 400);

      const targetProfileSnap = await db.collection('users').doc(targetUid).get();
      const targetProfile = targetProfileSnap.data() || {};
      if (!targetProfileSnap.exists || targetProfile.disabled === true) {
        return jsonError('This account is not active for staff access.', 403);
      }
      const targetRole = String(targetProfile.role || '').toUpperCase();
      if (!STAFF_ROLES.has(targetRole)) {
        return jsonError('This account is not authorized for staff terminal access.', 403);
      }

      const [{ data: globalPin }, memberSnap] = await Promise.all([
        supaAdmin.from('staff_pins').select('pin_salt, pin_hash').eq('uid', targetUid).maybeSingle(),
        memberRef.get(),
      ]);

      const salt = String(globalPin?.pin_salt || memberSnap.get('pinSalt') || '');
      const expectedHash = String(globalPin?.pin_hash || memberSnap.get('pinHash') || '');
      if (!salt || !expectedHash) {
        return jsonError('No PIN is set for this account yet. Sign in with password or ask an admin to set one.', 409);
      }

      if (!verifyPinHash(pin, salt, expectedHash)) {
        return jsonError('Incorrect PIN.', 401);
      }

      const customToken = await admin.auth().createCustomToken(targetUid, {
        deviceId,
        actorUid,
      });

      const staffName = String(targetProfile.displayName || targetProfile.email || targetUid).slice(0, 120);
      const signedInAt = Date.now();
      await db.collection('audit_logs').add({
        action: 'TERMINAL_PIN_SIGN_IN',
        userId: targetUid,
        actorId: actorUid,
        details: `${staffName} switched onto POS terminal using their 4-digit PIN.`,
        deviceId,
        role: targetRole,
        timestamp: signedInAt,
        severity: 'INFO',
      });

      const terminalName = String(
        deviceState.data()?.name || deviceState.data()?.terminalName || deviceState.data()?.label || deviceId
      ).slice(0, 80);
      void notifyTelegramOperations({
        type: 'SECURITY',
        title: `POS SIGN-IN | ${terminalName.toUpperCase()}`,
        message: `${staffName} (${targetRole}) switched in using a staff PIN on ${terminalName} (${deviceId}).`,
      }).catch(() => undefined);

      return NextResponse.json({ customToken });
    }

    return jsonError('Unsupported terminal action.', 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'AUTH_REQUIRED') return jsonError('Sign in is required.', 401);
    if (message === 'ACCOUNT_DISABLED') return jsonError('This staff account has been deactivated.', 403);
    if (message === 'STAFF_REQUIRED') return jsonError('A valid staff account is required.', 403);
    console.error('[TERMINAL_ACCESS]', error);
    return jsonError('Terminal authentication could not be completed.', 500);
  }
}
