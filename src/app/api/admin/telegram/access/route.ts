import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getAdminApp, getDbAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROOT_ADMINS = ['urbanautoexpressnakuru@gmail.com','urbanaautoexpressnakuru@gmail.com','samuelkarani044@gmail.com','gmaina424@gmail.com','bonfacewana3072@gmail.com'];
type Role = 'OWNER' | 'MANAGER' | 'STAFF';
type Entry = { telegramUserId: string; role: Role; name: string; branchIds: string[]; enabled: boolean; source: 'DATABASE' | 'ENVIRONMENT'; updatedAt?: number };

async function authorize(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    const decoded = await admin.auth(getAdminApp()).verifyIdToken(token);
    const email = String(decoded.email || '').trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    if (!ROOT_ADMINS.includes(email) || decoded.adminOtpVerifiedDate !== today) return null;
    return { uid: decoded.uid, email };
  } catch { return null; }
}

function environmentEntries(): Record<string, Entry> {
  const entries: Record<string, Entry> = {};
  try {
    const raw = JSON.parse(process.env.TELEGRAM_USER_ACCESS || '{}') as Record<string, {role?: string; name?: string; branchIds?: string[]}> | null;
    const parsed = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    for (const [id, value] of Object.entries(parsed)) {
      if (!/^\d{1,20}$/.test(id) || !['OWNER','MANAGER','STAFF'].includes(String(value?.role || '').toUpperCase())) continue;
      entries[id] = { telegramUserId: id, role: String(value.role).toUpperCase() as Role, name: String(value.name || ''), branchIds: Array.isArray(value.branchIds) ? value.branchIds.filter(x => typeof x === 'string').slice(0, 30) : [], enabled: true, source: 'ENVIRONMENT' };
    }
  } catch { /* legacy environment map is optional */ }
  const ownerIds = String(process.env.OWNER_TELEGRAM_IDS || '').split(/[;,\s]+/).map(id => id.trim()).filter(id => /^\d{1,20}$/.test(id));
  for (const id of ownerIds) entries[id] = { telegramUserId: id, role: 'OWNER', name: 'Owner', branchIds: [], enabled: true, source: 'ENVIRONMENT' };
  return entries;
}

async function entries() {
  const result = environmentEntries();
  const snap = await getDbAdmin().collection('telegram_user_access').get();
  for (const doc of snap.docs) {
    const value = doc.data();
    if (value.enabled === false) { delete result[doc.id]; continue; }
    if (!['OWNER','MANAGER','STAFF'].includes(String(value.role || '').toUpperCase())) continue;
    result[doc.id] = { telegramUserId: doc.id, role: String(value.role).toUpperCase() as Role, name: String(value.name || ''), branchIds: Array.isArray(value.branchIds) ? value.branchIds.filter((x: unknown) => typeof x === 'string').slice(0, 30) : [], enabled: true, source: 'DATABASE', updatedAt: Number(value.updatedAt || 0) || undefined };
  }
  return Object.values(result).sort((a,b) => a.name.localeCompare(b.name) || a.telegramUserId.localeCompare(b.telegramUserId));
}

async function audit(actor: {uid:string;email:string}, action: string, targetId: string, details: Record<string, unknown> = {}) {
  await getDbAdmin().collection('system_audit_logs').add({ action, actorUid: actor.uid, actorEmail: actor.email, targetType: 'TELEGRAM_USER_ACCESS', targetId, details, createdAt: Date.now() });
}

export async function GET(request: NextRequest) {
  if (!await authorize(request)) return NextResponse.json({error:'Verified owner access is required.'},{status:403});
  try { return NextResponse.json({ users: await entries() }, {headers:{'Cache-Control':'no-store, max-age=0'}}); }
  catch { return NextResponse.json({error:'Unable to load Telegram access records.'},{status:500}); }
}

export async function POST(request: NextRequest) {
  const actor = await authorize(request);
  if (!actor) return NextResponse.json({error:'Verified owner access is required.'},{status:403});
  try {
    const body = await request.json();
    const id = String(body.telegramUserId || '').trim();
    const role = String(body.role || '').toUpperCase();
    const name = String(body.name || '').trim().slice(0,100);
    const branchIds = Array.isArray(body.branchIds) ? body.branchIds.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0,30) : [];
    if (!/^\d{1,20}$/.test(id)) return NextResponse.json({error:'Enter a valid numeric Telegram user ID.'},{status:400});
    if (!['OWNER','MANAGER','STAFF'].includes(role)) return NextResponse.json({error:'Select a valid role.'},{status:400});
    if (new Set(branchIds).size !== branchIds.length || branchIds.some((x: string) => x.length > 80)) return NextResponse.json({error:'Branch IDs must be unique and no longer than 80 characters.'},{status:400});
    const ref = getDbAdmin().collection('telegram_user_access').doc(id);
    const before = await ref.get();
    const now = Date.now();
    await ref.set({ telegramUserId:id, role, name, branchIds, enabled:true, updatedAt:now, updatedBy:actor.email, createdAt: before.exists ? before.data()?.createdAt || now : now }, {merge:true});
    await audit(actor, before.exists ? 'TELEGRAM_ACCESS_UPDATED' : 'TELEGRAM_ACCESS_CREATED', id, {role,name,branchIds});
    return NextResponse.json({ok:true,user:{telegramUserId:id,role,name,branchIds,enabled:true,source:'DATABASE',updatedAt:now}});
  } catch (error) {
    return NextResponse.json({error:error instanceof Error ? error.message : 'Unable to save Telegram access.'},{status:500});
  }
}

export async function DELETE(request: NextRequest) {
  const actor = await authorize(request);
  if (!actor) return NextResponse.json({error:'Verified owner access is required.'},{status:403});
  try {
    const id = String(new URL(request.url).searchParams.get('telegramUserId') || '').trim();
    if (!/^\d{1,20}$/.test(id)) return NextResponse.json({error:'A valid Telegram user ID is required.'},{status:400});
    const ref = getDbAdmin().collection('telegram_user_access').doc(id);
    const hasEnvEntry = Boolean(environmentEntries()[id]);
    if (hasEnvEntry) await ref.set({telegramUserId:id,enabled:false,updatedAt:Date.now(),updatedBy:actor.email},{merge:true});
    else await ref.delete();
    await audit(actor,'TELEGRAM_ACCESS_REVOKED',id,{});
    return NextResponse.json({ok:true});
  } catch (error) {
    return NextResponse.json({error:error instanceof Error ? error.message : 'Unable to revoke Telegram access.'},{status:500});
  }
}
