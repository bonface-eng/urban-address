import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';
import { getAdminApp, getDbAdmin } from '@/lib/firebase-admin';
import { sendTransactionalEmail } from '@/lib/resend';
import { adminCommunicationEmail, type AdminEmailKind } from '@/lib/email/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROOT_ADMINS = [
  'urbanautoexpressnakuru@gmail.com',
  'urbanaautoexpressnakuru@gmail.com',
  'samuelkarani044@gmail.com',
  'gmaina424@gmail.com',
  'bonfacewana3072@gmail.com',
];
const KINDS: AdminEmailKind[] = ['DISMISSAL', 'PURCHASE_ORDER', 'WARNING_LETTER', 'OFFICIAL_COMMUNICATION', 'MARKETING', 'GENERAL'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashEmail(email: string) {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

async function authorize(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    const app = getAdminApp();
    const decoded = await admin.auth(app).verifyIdToken(token);
    const email = String(decoded.email || '').toLowerCase().trim();
    const db = getDbAdmin();
    const [profile, whitelist] = await Promise.all([
      db.collection('users').doc(decoded.uid).get(),
      email ? db.collection('admins').doc(email).get() : Promise.resolve(null),
    ]);
    const isAdmin = ROOT_ADMINS.includes(email) || !!whitelist?.exists || String(profile.data()?.role || '').toUpperCase() === 'ADMIN';
    const verifiedToday = decoded.adminOtpVerifiedDate === new Date().toISOString().slice(0, 10);
    return isAdmin && verifiedToday ? { uid: decoded.uid, email, db } : null;
  } catch {
    return null;
  }
}

function validEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value.trim());
}

export async function POST(request: NextRequest) {
  const actor = await authorize(request);
  if (!actor) return NextResponse.json({ error: 'Super administrator access required.' }, { status: 403 });

  try {
    const body = await request.json();
    const kind = String(body?.kind || '') as AdminEmailKind;
    const audience = String(body?.audience || 'CUSTOM');
    const subject = String(body?.subject || '').trim().slice(0, 180);
    const heading = String(body?.heading || '').trim().slice(0, 180);
    const message = String(body?.message || '').trim().slice(0, 12000);
    const reference = String(body?.reference || '').trim().slice(0, 120);
    const actionUrl = String(body?.actionUrl || '').trim().slice(0, 1000);
    const actionLabel = String(body?.actionLabel || '').trim().slice(0, 80);
    const logoUrl = String(body?.logoUrl || '').trim().slice(0, 1000);
    const imageUrl = String(body?.imageUrl || '').trim().slice(0, 1000);
    const r2PublicUrlValue = String(process.env.R2_PUBLIC_URL || '');
    const r2PublicUrl = r2PublicUrlValue.endsWith('/') ? r2PublicUrlValue.slice(0, -1) : r2PublicUrlValue;
    if ([logoUrl, imageUrl].some(url => url && (!/^https:\/\//i.test(url) || !r2PublicUrl || !url.startsWith(`${r2PublicUrl}/`)))) {
      return NextResponse.json({ error: 'Email images must use the configured public Cloudflare R2 URL.' }, { status: 400 });
    }

    if (!KINDS.includes(kind) || !subject || !heading || !message) {
      return NextResponse.json({ error: 'Choose a valid template and provide a subject, heading and message.' }, { status: 400 });
    }
    if (actionUrl && (!/^https:\/\//i.test(actionUrl) || !actionLabel)) {
      return NextResponse.json({ error: 'Action links must use HTTPS and include a button label.' }, { status: 400 });
    }
    if (['DISMISSAL', 'WARNING_LETTER'].includes(kind) && audience !== 'CUSTOM') {
      return NextResponse.json({ error: 'Employment notices must be addressed to one specific recipient.' }, { status: 400 });
    }
    if (kind === 'PURCHASE_ORDER' && audience !== 'CUSTOM') {
      return NextResponse.json({ error: 'Purchase orders must be addressed to a specific supplier.' }, { status: 400 });
    }
    if (audience === 'ALL_CLIENTS') {
      return NextResponse.json({ error: 'Customer-wide email requires recorded marketing consent. Use the marketing broadcast template.' }, { status: 400 });
    }
    if (kind === 'MARKETING' && audience !== 'MARKETING_CONSENTED') {
      return NextResponse.json({ error: 'Marketing broadcasts can only target contacts with recorded marketing consent.' }, { status: 400 });
    }

    let recipients: Array<{ email: string; name: string }> = [];
    if (audience === 'CUSTOM') {
      const raw = Array.isArray(body?.recipients) ? body.recipients : [];
      const normalized = [...new Set(raw.map((value: unknown) => String(value).trim().toLowerCase()).filter(validEmail))];
      const singleRecipientRequired = ['DISMISSAL', 'WARNING_LETTER', 'PURCHASE_ORDER'].includes(kind);
      if (!normalized.length || normalized.length > 20 || (singleRecipientRequired && normalized.length !== 1)) {
        return NextResponse.json({ error: 'Enter exactly one recipient for HR notices and purchase orders, or between 1 and 20 valid addresses for other emails.' }, { status: 400 });
      }
      recipients = normalized.map(email => ({ email, name: '' }));
    } else if (audience === 'ALL_STAFF' || audience === 'MARKETING_CONSENTED') {
      const snapshot = await actor.db.collection('users').get();
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const role = String(data.role || 'CLIENT').toUpperCase();
        const isStaff = role !== 'CLIENT';
        if (audience === 'ALL_STAFF' && !isStaff) continue;
        if (audience === 'MARKETING_CONSENTED' && isStaff) continue;
        const email = String(data.email || '').trim().toLowerCase();
        if (!validEmail(email)) continue;
        if (audience === 'MARKETING_CONSENTED') {
          const preference = await actor.db.collection('email_preferences').doc(hashEmail(email)).get();
          const optedIn = data.marketingOptIn === true || data.marketingConsent === true;
          if (!optedIn || preference.data()?.marketingUnsubscribed === true) continue;
        }
        recipients.push({ email, name: String(data.displayName || data.name || '') });
      }
      recipients = [...new Map(recipients.map(item => [item.email, item])).values()];
      if (recipients.length > 200) {
        return NextResponse.json({ error: 'This audience exceeds the 200-recipient safety limit. Narrow the audience first.' }, { status: 413 });
      }
    } else {
      return NextResponse.json({ error: 'Unsupported audience.' }, { status: 400 });
    }

    if (!recipients.length) {
      return NextResponse.json({ error: audience === 'MARKETING_CONSENTED' ? 'No customers have recorded marketing consent.' : 'No eligible recipients were found.' }, { status: 400 });
    }

    const campaignRef = actor.db.collection('email_campaigns').doc();
    const createdAt = Date.now();
    await campaignRef.set({
      kind, audience, subject, heading, reference: reference || null,
      recipientCount: recipients.length, sentCount: 0, failedCount: 0,
      status: 'SENDING', createdAt, createdBy: actor.uid, createdByEmail: actor.email,
    });

    let sentCount = 0;
    let failedCount = 0;
    const sender = kind === 'PURCHASE_ORDER' ? 'finance' : 'general';

    // Send one recipient at a time. The shared Resend transport also serializes
    // requests and applies Retry-After-aware backoff for 429/5xx responses.
    for (const recipient of recipients) {
      const email = adminCommunicationEmail({
        email: recipient.email,
        name: recipient.name,
        kind,
        subject,
        heading,
        message,
        reference: reference || undefined,
        actionUrl: actionUrl || undefined,
        actionLabel: actionLabel || undefined,
        logoUrl: logoUrl || undefined,
        imageUrl: imageUrl || undefined,
      });

      try {
        const delivery = await sendTransactionalEmail({ sender, to: recipient.email, ...email });
        await actor.db.collection('email_messages').add({
          campaignId: campaignRef.id,
          providerEmailId: delivery.id || null,
          recipientEmail: recipient.email,
          recipientName: recipient.name || null,
          subject,
          kind,
          bodyText: email.text,
          bodyHtml: email.html,
          status: 'SENT',
          sentAt: Date.now(),
          createdBy: actor.uid,
          createdByEmail: actor.email,
        });
        sentCount += 1;
      } catch (error) {
        console.error('[ADMIN_EMAIL_SEND]', campaignRef.id, recipient.email, error);
        await actor.db.collection('email_messages').add({
          campaignId: campaignRef.id,
          recipientEmail: recipient.email,
          recipientName: recipient.name || null,
          subject,
          kind,
          bodyText: email.text,
          bodyHtml: email.html,
          status: 'FAILED',
          sentAt: Date.now(),
          createdBy: actor.uid,
          createdByEmail: actor.email,
        });
        failedCount += 1;
      }

      await campaignRef.update({ sentCount, failedCount, updatedAt: Date.now() });
    }

    const status = failedCount === 0 ? 'SENT' : sentCount === 0 ? 'FAILED' : 'PARTIAL';
    await campaignRef.update({ status, completedAt: Date.now(), sentCount, failedCount });
    await actor.db.collection('audit_logs').add({
      action: 'ADMIN_EMAIL_CAMPAIGN',
      userId: actor.uid,
      details: `Sent ${kind} email campaign to ${recipients.length} recipient(s): ${sentCount} sent, ${failedCount} failed. Campaign ${campaignRef.id}.`,
      timestamp: Date.now(),
      severity: kind === 'DISMISSAL' || kind === 'WARNING_LETTER' ? 'WARNING' : 'INFO',
    });

    return NextResponse.json({ ok: failedCount === 0, campaignId: campaignRef.id, recipientCount: recipients.length, sentCount, failedCount, status });
  } catch (error) {
    console.error('[ADMIN_EMAIL_CAMPAIGN]', error);
    return NextResponse.json({ error: 'The email campaign could not be processed.' }, { status: 500 });
  }
}
