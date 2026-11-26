import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getDbAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function verifySignature(raw: string, headers: Headers, secret: string) {
  const id = headers.get('svix-id') || '';
  const timestamp = headers.get('svix-timestamp') || '';
  const signature = headers.get('svix-signature') || '';
  if (!id || !timestamp || !signature) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${raw}`).digest('base64');
  return signature.split(' ').some(part => {
    const [version, value] = part.split(',');
    if (version !== 'v1' || !value) return false;
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 });
  const raw = await request.text();
  if (!verifySignature(raw, request.headers, secret)) return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  try {
    const event = JSON.parse(raw);
    const eventId = request.headers.get('svix-id')!;
    const db = getDbAdmin();
    const eventRef = db.collection('resend_webhook_events').doc(eventId);
    const existing = await eventRef.get();
    if (existing.exists) return NextResponse.json({ received: true, duplicate: true });
    const type = String(event.type || '');
    const data = event.data || {};
    const now = Date.now();

    if (type === 'email.received') {
      const from = String(data.from || '').slice(0, 254);
      const to = Array.isArray(data.to) ? data.to.map((v: unknown) => String(v).slice(0,254)) : [];
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) throw new Error('RESEND_API_KEY is not configured for inbound email retrieval.');
      const inboundResponse = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(String(data.email_id || ''))}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store',
      });
      if (!inboundResponse.ok) throw new Error(`Could not retrieve inbound email content (${inboundResponse.status}).`);
      const inboundResult = await inboundResponse.json();
      const inbound = inboundResult?.data || inboundResult;
      await db.collection('email_replies').add({
        providerEmailId: data.email_id || null,
        from,
        to,
        subject: String(inbound.subject || data.subject || '(no subject)').slice(0, 300),
        text: typeof inbound.text === 'string' ? inbound.text.slice(0, 30000) : '',
        html: typeof inbound.html === 'string' ? inbound.html.slice(0, 50000) : '',
        receivedAt: now,
        status: 'RECEIVED',
        messageId: inbound.message_id || null,
      });
    } else {
      const providerId = String(data.email_id || data.id || '');
      const statusMap: Record<string,string> = {
        'email.sent': 'SENT',
        'email.delivered': 'DELIVERED',
        'email.delivery_delayed': 'DELAYED',
        'email.bounced': 'BOUNCED',
        'email.complained': 'COMPLAINED',
        'email.opened': 'OPENED',
        'email.clicked': 'CLICKED',
      };
      const status = statusMap[type];
      if (providerId && status) {
        const matches = await db.collection('email_messages').where('providerEmailId', '==', providerId).limit(10).get();
        const batch = db.batch();
        matches.docs.forEach(doc => batch.update(doc.ref, {
          status,
          lastEvent: type,
          lastEventAt: now,
          eventHistory: [...((doc.data().eventHistory as string[]) || []).slice(-9), type],
        }));
        if (!matches.empty) await batch.commit();
      }
    }
    await eventRef.set({ type, receivedAt: now, processed: true });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[RESEND_WEBHOOK]', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
