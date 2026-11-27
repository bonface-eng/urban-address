import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authorize(request: NextRequest) {
  const caller = await authorizeAdminRequest(request);
  return caller ? caller.db : null;
}

export async function GET(request: NextRequest) {
  const db = await authorize(request);
  if (!db) return NextResponse.json({ error: 'Super administrator access required.' }, { status: 403 });
  try {
    const [messagesSnap, repliesSnap, campaignsSnap] = await Promise.all([
      db.collection('email_messages').orderBy('sentAt', 'desc').limit(200).get(),
      db.collection('email_replies').orderBy('receivedAt', 'desc').limit(100).get(),
      db.collection('email_campaigns').orderBy('createdAt', 'desc').limit(50).get(),
    ]);
    const serialize = (doc: any) => ({ id: doc.id, ...doc.data() });
    const messages = messagesSnap.docs.map(serialize).sort((a: any,b: any) => Number(b.sentAt || 0)-Number(a.sentAt || 0));
    const replies = repliesSnap.docs.map(serialize).sort((a: any,b: any) => Number(b.receivedAt || 0)-Number(a.receivedAt || 0));
    const campaigns = campaignsSnap.docs.map(serialize).sort((a: any,b: any) => Number(b.createdAt || 0)-Number(a.createdAt || 0));
    return NextResponse.json({ messages, replies, campaigns });
  } catch (error) {
    console.error('[ADMIN_EMAIL_ACTIVITY]', error);
    return NextResponse.json({ error: 'Could not load email activity.' }, { status: 500 });
  }
}
