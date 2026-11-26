import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { getAdminApp, getDbAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TelegramRole = 'OWNER' | 'MANAGER' | 'STAFF';

async function currentUser(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try { return await admin.auth(getAdminApp()).verifyIdToken(token); }
  catch { return null; }
}

function accessRole(profile: any, email?: string): TelegramRole | null {
  const role = String(profile?.role || '').toUpperCase();
  if (role === 'ADMIN' || ['urbanautoexpressnakuru@gmail.com','urbanaautoexpressnakuru@gmail.com','samuelkarani044@gmail.com','gmaina424@gmail.com','bonfacewana3072@gmail.com'].includes(String(email || '').toLowerCase())) return 'OWNER';
  if (role === 'MANAGER' || role === 'SUPERVISOR') return 'MANAGER';
  if (['CASHIER','STOREKEEPER','ATTENDANT','KITCHEN'].includes(role)) return 'STAFF';
  return null;
}

function codeHash(uid: string, telegramUserId: string, code: string) {
  return createHash('sha256').update(`${uid}:${telegramUserId}:${code}:${process.env.TELEGRAM_WEBHOOK_SECRET || process.env.TELEGRAM_BOT_TOKEN || 'urban-address-telegram-link'}`).digest();
}

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const db = getDbAdmin();
  const link = await db.collection('telegram_links').doc(user.uid).get();
  if (!link.exists) return NextResponse.json({ linked: false });
  const data = link.data()!;
  const access = await db.collection('telegram_user_access').doc(String(data.telegramUserId)).get();
  const active = access.exists && access.data()?.enabled !== false && access.data()?.linkedUid === user.uid;
  return NextResponse.json({
    linked: Boolean(active),
    telegramUserId: active ? String(data.telegramUserId) : null,
    role: active ? String(access.data()?.role || '') : null,
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const body = await request.json();
    const action = String(body.action || '');
    const db = getDbAdmin();
    const profileSnap = await db.collection('users').doc(user.uid).get();
    if (!profileSnap.exists) return NextResponse.json({ error: 'Your staff profile could not be found.' }, { status: 404 });
    const profile = profileSnap.data()!;
    const role = accessRole(profile, user.email);
    if (!role) return NextResponse.json({ error: 'Telegram linking is available to active staff accounts only.' }, { status: 403 });

    if (action === 'request') {
      const telegramUserId = String(body.telegramUserId || '').trim();
      if (!/^\d{1,20}$/.test(telegramUserId)) return NextResponse.json({ error: 'Enter the numeric Telegram ID shown by the Urban Address bot.' }, { status: 400 });
      const existingLink = await db.collection('telegram_links').doc(user.uid).get();
      const previousChallenge = await db.collection('telegram_link_challenges').doc(user.uid).get();
      if (previousChallenge.exists && Date.now() - Number(previousChallenge.data()?.createdAt || 0) < 30_000) return NextResponse.json({ error: 'Wait 30 seconds before requesting another code.' }, { status: 429 });
      if (existingLink.exists && existingLink.data()?.telegramUserId) return NextResponse.json({ error: 'A Telegram account is already linked. Contact an administrator to change it.' }, { status: 409 });
      const access = await db.collection('telegram_user_access').doc(telegramUserId).get();
      if (access.exists && access.data()?.linkedUid && access.data()?.linkedUid !== user.uid) return NextResponse.json({ error: 'That Telegram account is already linked to another staff account.' }, { status: 409 });
      const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
      if (!botToken) return NextResponse.json({ error: 'Telegram bot is not configured. Contact an administrator.' }, { status: 503 });
      const code = String(randomInt(100000, 1000000));
      const expiresAt = Date.now() + 5 * 60 * 1000;
      await db.collection('telegram_link_challenges').doc(user.uid).set({
        uid: user.uid, telegramUserId, codeHash: codeHash(user.uid, telegramUserId, code).toString('hex'),
        expiresAt, attempts: 0, createdAt: Date.now(),
      });
      const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramUserId,
          text: `URBAN ADDRESS ACCOUNT LINK\n\nYour verification code is: ${code}\n\nEnter this code in your staff profile to connect your Telegram account. It expires in 5 minutes. Do not share this code.`,
        }),
        cache: 'no-store', signal: AbortSignal.timeout(10000),
      });
      const telegramResult = await telegramResponse.json().catch(() => null);
      if (!telegramResponse.ok || !telegramResult?.ok) {
        await db.collection('telegram_link_challenges').doc(user.uid).delete().catch(() => undefined);
        const description = String(telegramResult?.description || '');
        return NextResponse.json({ error: description.includes('chat not found') || description.includes('bot was blocked') ? 'Open the Urban Address bot in Telegram and press Start, then try again.' : 'Telegram could not deliver the verification code. Check the ID and start the bot first.' }, { status: 400 });
      }
      return NextResponse.json({ ok: true, expiresAt, message: 'Verification code sent to your Telegram account.' });
    }

    if (action === 'confirm') {
      const telegramUserId = String(body.telegramUserId || '').trim();
      const code = String(body.code || '').trim();
      if (!/^\d{1,20}$/.test(telegramUserId) || !/^\d{6}$/.test(code)) return NextResponse.json({ error: 'Enter the Telegram ID and six-digit verification code.' }, { status: 400 });
      const challengeRef = db.collection('telegram_link_challenges').doc(user.uid);
      const challengeSnap = await challengeRef.get();
      if (!challengeSnap.exists) return NextResponse.json({ error: 'Request a new verification code first.' }, { status: 400 });
      const challenge = challengeSnap.data()!;
      if (challenge.telegramUserId !== telegramUserId || Number(challenge.expiresAt || 0) < Date.now()) {
        await challengeRef.delete();
        return NextResponse.json({ error: 'The verification code expired or does not match. Request a new code.' }, { status: 400 });
      }
      if (Number(challenge.attempts || 0) >= 5) {
        await challengeRef.delete();
        return NextResponse.json({ error: 'Too many attempts. Request a new verification code.' }, { status: 429 });
      }
      const supplied = codeHash(user.uid, telegramUserId, code);
      const expected = Buffer.from(String(challenge.codeHash || ''), 'hex');
      const matches = expected.length === supplied.length && timingSafeEqual(expected, supplied);
      if (!matches) {
        await challengeRef.update({ attempts: admin.firestore.FieldValue.increment(1), updatedAt: Date.now() });
        return NextResponse.json({ error: 'Incorrect verification code.' }, { status: 400 });
      }

      const accessRef = db.collection('telegram_user_access').doc(telegramUserId);
      const linkRef = db.collection('telegram_links').doc(user.uid);
      await db.runTransaction(async transaction => {
        const [accessSnap, linkSnap] = await Promise.all([transaction.get(accessRef), transaction.get(linkRef)]);
        const existing = accessSnap.data() || {};
        if (existing.linkedUid && existing.linkedUid !== user.uid) throw new Error('TELEGRAM_ACCOUNT_ALREADY_LINKED');
        if (linkSnap.exists && linkSnap.data()?.telegramUserId !== telegramUserId) throw new Error('STAFF_ACCOUNT_ALREADY_LINKED');
        if (String(existing.role || '').toUpperCase() === 'OWNER' && role !== 'OWNER') throw new Error('TELEGRAM_ACCOUNT_RESERVED');
        const branchIds = Array.isArray(profile.branchIds) ? profile.branchIds.filter((value: unknown) => typeof value === 'string').slice(0, 30) : (profile.activeBranchId ? [String(profile.activeBranchId)] : []);
        const name = String(profile.displayName || user.email || 'Staff member');
        const now = Date.now();
        transaction.set(accessRef, {
          telegramUserId, linkedUid: user.uid, email: user.email || null, role, name,
          branchIds, enabled: true, source: 'SELF_SERVICE', verifiedAt: now, updatedAt: now,
          createdAt: existing.createdAt || now,
        }, { merge: true });
        transaction.set(linkRef, { uid: user.uid, telegramUserId, role, linkedAt: now, verifiedAt: now });
        transaction.delete(challengeRef);
      });
      await db.collection('system_audit_logs').add({
        action: 'TELEGRAM_STAFF_SELF_LINKED', actorUid: user.uid, actorEmail: user.email || null,
        targetType: 'TELEGRAM_USER_ACCESS', targetId: telegramUserId, createdAt: Date.now(), details: { role },
      });
      return NextResponse.json({ ok: true, linked: true, telegramUserId, role });
    }
    return NextResponse.json({ error: 'Unsupported Telegram link action.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to link Telegram account.';
    const known = ['TELEGRAM_ACCOUNT_ALREADY_LINKED','STAFF_ACCOUNT_ALREADY_LINKED','TELEGRAM_ACCOUNT_RESERVED'].includes(message);
    return NextResponse.json({ error: known ? ({
      TELEGRAM_ACCOUNT_ALREADY_LINKED: 'That Telegram account is already linked to another staff member.',
      STAFF_ACCOUNT_ALREADY_LINKED: 'Your staff account is already linked to a different Telegram account.',
      TELEGRAM_ACCOUNT_RESERVED: 'That Telegram account is reserved for an owner-managed assignment.',
    } as Record<string,string>)[message] : 'Unable to link your Telegram account. Please try again.' }, { status: known ? 409 : 500 });
  }
}
