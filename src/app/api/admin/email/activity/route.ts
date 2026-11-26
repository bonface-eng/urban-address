import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getAdminApp, getDbAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROOT_ADMINS = ['urbanautoexpressnakuru@gmail.com','urbanaautoexpressnakuru@gmail.com','samuelkarani044@gmail.com','gmaina424@gmail.com','bonfacewana3072@gmail.com'];

async function authorize(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    const decoded = await admin.auth(getAdminApp()).verifyIdToken(token);
    const email = String(decoded.email || '').trim().toLowerCase();
    const db = getDbAdmin();
    const [profile, whitelist] = await Promise.all([
      db.collection('users').doc(decoded.uid).get(),
      email ? db.collection('admins').doc(email).get() : Promise.resolve(null),
    ]);
    const isAdmin = ROOT_ADMINS.includes(email) || !!whitelist?.exists || String(profile.data()?.role || '').toUpperCase() === 'ADMIN';
    const verifiedToday = decoded.adminOtpVerifiedDate === new Date().toISOString().slice(0, 10);
    return isAdmin && verifiedToday ? db : null;
  } catch { return null; }
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
    const serialize = (doc: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() });
    const messages = messagesSnap.docs.map(serialize).sort((a: any,b: any) => Number(b.sentAt || 0)-Number(a.sentAt || 0));
    const replies = repliesSnap.docs.map(serialize).sort((a: any,b: any) => Number(b.receivedAt || 0)-Number(a.receivedAt || 0));
    const campaigns = campaignsSnap.docs.map(serialize).sort((a: any,b: any) => Number(b.createdAt || 0)-Number(a.createdAt || 0));
    return NextResponse.json({ messages, replies, campaigns });
  } catch (error) {
    console.error('[ADMIN_EMAIL_ACTIVITY]', error);
    return NextResponse.json({ error: 'Could not load email activity.' }, { status: 500 });
  }
}
