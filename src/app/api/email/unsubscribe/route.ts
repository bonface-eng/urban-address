import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/db/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function verifyToken(token: string) {
  const [payload, suppliedSignature, extra] = token.split('.');
  const secret = process.env.RESEND_API_KEY;
  if (!secret || !payload || !suppliedSignature || extra) return null;

  const expected = createHmac('sha256', secret).update(payload).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(suppliedSignature, 'base64url');
  } catch {
    return null;
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const email = Buffer.from(payload, 'base64url').toString('utf8').trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  } catch {
    return null;
  }
}

function confirmationPage(token: string, message = 'Confirm that you want to stop receiving promotional emails from Urban Auto Express.') {
  return new NextResponse(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email preferences | Urban Auto Express</title><body style="margin:0;padding:32px 16px;background:#f5f6f8;font-family:Arial,sans-serif;color:#202124"><main style="max-width:480px;margin:8vh auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden"><div style="height:5px;background:#FF6A00"></div><div style="padding:32px"><img src="https://urbanautoexpress.com/assets/logo.png" alt="Urban Auto Express" width="150" style="max-width:70%;height:auto"><h1 style="font-size:23px;margin:28px 0 12px">Email preferences</h1><p style="line-height:1.7;color:#555">${message}</p><form method="post" action="/api/email/unsubscribe"><input type="hidden" name="token" value="${token}"><button type="submit" style="background:#FF6A00;color:white;border:0;border-radius:6px;padding:13px 18px;font-weight:700;cursor:pointer">Confirm unsubscribe</button></form><p style="font-size:12px;line-height:1.6;color:#777;margin-top:22px">This affects promotional emails only. Essential account, security and transaction messages may still be sent.</p></div></main></body></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';
  if (!verifyToken(token)) return new NextResponse('This unsubscribe link is invalid or has expired.', { status: 400 });
  return confirmationPage(token);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = String(form.get('token') || '');
  const email = verifyToken(token);
  if (!email) return new NextResponse('This unsubscribe link is invalid or has expired.', { status: 400 });

  const emailHash = createHash('sha256').update(email).digest('hex');
  const db = getDbAdmin();
  await db.collection('email_preferences').doc(emailHash).set({
    email,
    marketingUnsubscribed: true,
    unsubscribedAt: new Date().toISOString(),
    source: 'email_footer',
  }, { merge: true });
  const matchingUsers = await db.collection('users').where('email', '==', email).get();
  const batch = db.batch();
  matchingUsers.docs.forEach(userDoc => batch.set(userDoc.ref, {
    marketingOptIn: false,
    marketingConsent: false,
    marketingConsentUpdatedAt: Date.now(),
    marketingConsentSource: 'email_unsubscribe',
  }, { merge: true }));
  if (!matchingUsers.empty) await batch.commit();

  return confirmationPage(token, 'You have been unsubscribed from promotional emails. Essential account, security and transaction messages will continue when necessary.');
}
