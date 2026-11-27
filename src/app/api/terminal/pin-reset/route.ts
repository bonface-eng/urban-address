import { NextRequest, NextResponse } from 'next/server';
import * as admin from '@/lib/db/admin';
import { timingSafeEqual } from 'node:crypto';
import { getDbAdmin } from '@/lib/db/admin';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { createPinHash } from '@/lib/admin-auth';
import { createOtp, hashOtp } from '@/lib/otp-security';
import { customerNotificationEmail } from '@/lib/email/templates';
import { sendTransactionalEmail } from '@/lib/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAFF_ROLES = new Set(['ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'STOREKEEPER', 'ATTENDANT', 'KITCHEN']);
const DEVICE_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function safeEqualHex(left: string, right: string) {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body?.action || '');
    const targetUid = String(body?.targetUid || '');
    const deviceId = String(body?.deviceId || '');

    if (!targetUid || targetUid.length > 128 || !DEVICE_ID_PATTERN.test(deviceId)) {
      return jsonError('Invalid staff account or terminal.', 400);
    }

    const db = getDbAdmin();
    const supaAdmin = getSupabaseAdminClient();
    const userRef = db.collection('users').doc(targetUid);
    const otpRef = db.collection('terminal_pin_reset_otps').doc(targetUid);
    const profileSnap = await userRef.get();
    if (!profileSnap.exists) return jsonError('Unable to verify this staff account.', 404);
    const profile = profileSnap.data() || {};
    if (profile.disabled === true) return jsonError('This staff account has been deactivated.', 403);
    const role = String(profile.role || '').toUpperCase();
    const email = String(profile.email || '').trim().toLowerCase();
    if (!STAFF_ROLES.has(role) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonError('This staff account cannot use email PIN recovery.', 403);
    }

    if (action === 'request') {
      const code = createOtp();
      const now = Date.now();
      const state = await db.runTransaction(async (tx) => {
        const snap = await tx.get(otpRef);
        const previous = snap.data() || {};
        const hour = Math.floor(now / 3_600_000);
        if (Number(previous.lastSentAt || 0) && now - Number(previous.lastSentAt) < 60_000) {
          return 'cooldown' as const;
        }
        const hourlyCount = previous.hour === hour ? Number(previous.hourlyCount || 0) : 0;
        if (hourlyCount >= 5) return 'limited' as const;
        tx.set(otpRef, {
          codeHash: hashOtp(targetUid, 'terminal-pin-reset', code),
          deviceId,
          createdAt: now,
          lastSentAt: now,
          expiresAt: now + 10 * 60_000,
          attempts: 0,
          consumedAt: null,
          hour,
          hourlyCount: hourlyCount + 1,
        });
        return 'sent' as const;
      });
      if (state === 'cooldown') return jsonError('Wait 60 seconds before requesting another code.', 429);
      if (state === 'limited') return jsonError('You have reached the limit of five PIN reset emails this hour.', 429);

      const content = customerNotificationEmail({
        email,
        name: String(profile.displayName || profile.name || 'team member'),
        subject: 'Your Urban Auto Express staff PIN reset code',
        heading: 'Reset your terminal PIN',
        message: `Your six-digit PIN reset code is ${code}. It expires in 10 minutes. If you did not request this reset, ignore this email.`,
      });
      try {
        await sendTransactionalEmail({ sender: 'auth', to: email, ...content });
      } catch (error) {
        console.error('[TERMINAL_PIN_RESET_EMAIL]', error);
        return jsonError('The reset email could not be sent. Sign in with your password or ask an administrator to update your PIN.', 503);
      }
      return NextResponse.json({ ok: true, expiresInSeconds: 600, destination: email.replace(/^(.).+(@.*)$/, '$1••••$2') });
    }

    if (action === 'confirm') {
      const code = String(body?.code || '').trim();
      const pin = String(body?.pin || '').trim();
      if (!/^\d{6}$/.test(code) || !/^\d{4}$/.test(pin)) {
        return jsonError('Enter the six-digit email code and a new four-digit PIN.', 400);
      }
      const { salt, hash } = createPinHash(pin);
      const now = Date.now();
      const state = await db.runTransaction(async (tx) => {
        const otpSnap = await tx.get(otpRef);
        if (!otpSnap.exists) return 'missing' as const;
        const otp = otpSnap.data() || {};
        if (otp.consumedAt) return 'consumed' as const;
        if (Number(otp.expiresAt || 0) <= now) return 'expired' as const;
        if (Number(otp.attempts || 0) >= 5) return 'locked' as const;
        const expected = hashOtp(targetUid, 'terminal-pin-reset', code);
        if (!safeEqualHex(String(otp.codeHash || ''), expected)) {
          tx.update(otpRef, { attempts: admin.firestore.FieldValue.increment(1), lastAttemptAt: now });
          return 'invalid' as const;
        }
        tx.update(otpRef, { consumedAt: now, codeHash: null });
        return 'success' as const;
      });
      if (state === 'success') {
        const nowIso = new Date().toISOString();
        await Promise.all([
          supaAdmin.from('staff_pins').upsert(
            { uid: targetUid, pin_salt: salt, pin_hash: hash, updated_at: nowIso },
            { onConflict: 'uid' }
          ),
          supaAdmin
            .from('terminal_device_staff')
            .update({ pin_salt: salt, pin_hash: hash, pin_updated_at: nowIso, pin_reset_at: nowIso })
            .eq('uid', targetUid),
          supaAdmin.from('profiles').update({ has_pin: true, updated_at_ms: Date.now() }).eq('id', targetUid),
        ]);
        return NextResponse.json({ ok: true });
      }
      if (state === 'invalid') return jsonError('The email code is incorrect. Check it and try again.', 400);
      if (state === 'expired') return jsonError('The email code has expired. Request a new one.', 410);
      if (state === 'locked') return jsonError('Too many incorrect codes. Request a new reset email.', 429);
      if (state === 'consumed') return jsonError('This reset code has already been used. Request a new one.', 409);
      return jsonError('The PIN reset request is no longer valid. Request a new code.', 400);
    }

    return jsonError('Unsupported PIN recovery action.', 400);
  } catch (error) {
    console.error('[TERMINAL_PIN_RESET]', error);
    return jsonError('PIN recovery could not be completed. Please try again.', 500);
  }
}
