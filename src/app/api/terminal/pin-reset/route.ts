import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getAdminApp, getDbAdmin } from '@/lib/firebase-admin';
import { createOtp, hashOtp } from '@/lib/otp-security';
import { customerNotificationEmail } from '@/lib/email/templates';
import { sendTransactionalEmail } from '@/lib/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAFF_ROLES = new Set(['ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'STOREKEEPER', 'ATTENDANT', 'KITCHEN']);
const DEVICE_ID_PATTERN = /^[a-zA-Z0-9_-]{16,80}$/;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function hashPin(pin: string, salt: string) {
  const pepper = process.env.STAFF_PIN_PEPPER;
  if (!pepper) throw new Error('STAFF_PIN_PEPPER_REQUIRED');
  return scryptSync(pin, salt + pepper, 64).toString('hex');
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
    const userRef = db.collection('users').doc(targetUid);
    const memberRef = db.collection('terminal_devices').doc(deviceId).collection('staff_members').doc(targetUid);
    const otpRef = db.collection('terminal_pin_reset_otps').doc(targetUid);
    const profileSnap = await userRef.get();
    if (!profileSnap.exists) return jsonError('Unable to verify this staff account.', 404);
    const profile = profileSnap.data() || {};
    const role = String(profile.role || '').toUpperCase();
    const email = String(profile.email || '').trim().toLowerCase();
    if (!STAFF_ROLES.has(role) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonError('This staff account cannot use email PIN recovery.', 403);
    }
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) return jsonError('Add this staff account to the terminal before resetting its PIN.', 409);

    if (action === 'request') {
      const code = createOtp();
      const now = Date.now();
      const state = await db.runTransaction(async tx => {
        const snap = await tx.get(otpRef);
        const previous = snap.data() || {};
        const hour = Math.floor(now / 3_600_000);
        if (previous.deviceId && previous.deviceId !== deviceId && Number(previous.expiresAt || 0) > now) {
          return 'active' as const;
        }
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
      if (state === 'active') return jsonError('A PIN reset is already active on another terminal. Try again after it expires.', 409);

      const content = customerNotificationEmail({
        email,
        name: String(profile.displayName || profile.name || 'team member'),
        subject: 'Your Urban Auto Express staff PIN reset code',
        heading: 'Reset your terminal PIN',
        message: `Your six-digit PIN reset code is ${code}. It expires in 10 minutes. If you did not request this reset, ignore this email. Never share this code with anyone.`,
      });
      try {
        await sendTransactionalEmail({ sender: 'auth', to: email, ...content });
      } catch (error) {
        console.error('[TERMINAL_PIN_RESET_EMAIL]', error);
        return jsonError('The reset email could not be sent. Check the account email and try again shortly.', 503);
      }
      return NextResponse.json({ ok: true, expiresInSeconds: 600, destination: email.replace(/^(.).+(@.*)$/, '$1••••$2') });
    }

    if (action === 'confirm') {
      const code = String(body?.code || '').trim();
      const pin = String(body?.pin || '');
      if (!/^\d{6}$/.test(code) || !/^\d{4}$/.test(pin)) {
        return jsonError('Enter the six-digit email code and a new four-digit PIN.', 400);
      }
      const salt = randomBytes(16).toString('hex');
      const pinHash = hashPin(pin, salt);
      const now = Date.now();
      const state = await db.runTransaction(async tx => {
        const [otpSnap, currentMember] = await Promise.all([tx.get(otpRef), tx.get(memberRef)]);
        if (!currentMember.exists) return 'not_registered' as const;
        if (!otpSnap.exists) return 'missing' as const;
        const otp = otpSnap.data() || {};
        if (otp.deviceId !== deviceId) return 'wrong_device' as const;
        if (otp.consumedAt) return 'consumed' as const;
        if (Number(otp.expiresAt || 0) <= now) return 'expired' as const;
        if (Number(otp.attempts || 0) >= 5) return 'locked' as const;
        const expected = hashOtp(targetUid, 'terminal-pin-reset', code);
        if (!safeEqualHex(String(otp.codeHash || ''), expected)) {
          tx.update(otpRef, { attempts: admin.firestore.FieldValue.increment(1), lastAttemptAt: now });
          return 'invalid' as const;
        }
        tx.update(memberRef, {
          pinSalt: salt,
          pinHash,
          pinUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          pinResetAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.update(otpRef, { consumedAt: now, codeHash: null });
        return 'success' as const;
      });
      if (state === 'success') {
        await db.collection('terminal_pin_attempts').doc(targetUid).delete().catch(() => undefined);
        return NextResponse.json({ ok: true });
      }
      if (state === 'invalid') return jsonError('The email code is incorrect. Check it and try again.', 400);
      if (state === 'expired') return jsonError('The email code has expired. Request a new one.', 410);
      if (state === 'locked') return jsonError('Too many incorrect codes. Request a new reset email.', 429);
      if (state === 'wrong_device') return jsonError('This code was requested for a different terminal.', 409);
      if (state === 'consumed') return jsonError('This reset code has already been used. Request a new one.', 409);
      return jsonError('The PIN reset request is no longer valid. Request a new code.', 400);
    }

    return jsonError('Unsupported PIN recovery action.', 400);
  } catch (error) {
    console.error('[TERMINAL_PIN_RESET]', error);
    const message = error instanceof Error ? error.message : '';
    if (message === 'STAFF_PIN_PEPPER_REQUIRED') return jsonError('PIN security is not configured on the server.', 503);
    return jsonError('PIN recovery could not be completed. Please try again.', 500);
  }
}
