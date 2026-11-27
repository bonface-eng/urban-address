import { NextRequest, NextResponse } from 'next/server';
import * as admin from '@/lib/db/admin';
import { getAdminApp, getDbAdmin } from '@/lib/db/admin';
import { notifyTelegramOperations } from '@/lib/telegram/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAFF_ROLES = new Set(['ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'STOREKEEPER', 'ATTENDANT', 'KITCHEN']);

function safePath(value: unknown) {
  const path = typeof value === 'string' ? value.trim() : '';
  if (!path.startsWith('/') || path.length > 160 || path.startsWith('//') || path.includes('..')) return null;
  return path.split('?')[0].split('#')[0] || '/';
}

export async function POST(request: NextRequest) {
  try {
    const header = request.headers.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const decoded = await admin.auth(getAdminApp()).verifyIdToken(token);
    const db = getDbAdmin();
    const profileSnap = await db.collection('users').doc(decoded.uid).get();
    const profile = profileSnap.data() || {};
    const role = String(profile.role || '').toUpperCase();
    if (!profileSnap.exists || !STAFF_ROLES.has(role)) {
      return NextResponse.json({ error: 'Staff access required.' }, { status: 403 });
    }

    const body = await request.json();
    const fromPath = safePath(body?.fromPath);
    const toPath = safePath(body?.toPath);
    if (!toPath || !fromPath || fromPath === toPath) {
      return NextResponse.json({ ok: true, skipped: true }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const now = Date.now();
    const stateRef = db.collection('staff_navigation_state').doc(decoded.uid);
    const eventRef = db.collection('staff_navigation_logs').doc();
    const shouldLog = await db.runTransaction(async transaction => {
      const state = await transaction.get(stateRef);
      const previousPath = String(state.get('lastPath') || '');
      const previousAt = Number(state.get('lastAt') || 0);
      if (previousPath === toPath && now - previousAt < 15_000) return false;
      transaction.set(stateRef, { lastPath: toPath, lastAt: now, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      const staffName = String(profile.displayName || profile.email || decoded.uid).slice(0, 120);
      const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.slice(0, 80) : null;
      transaction.create(eventRef, {
        userId: decoded.uid,
        staffName,
        role,
        fromPath,
        toPath,
        createdAt: now,
      });
      const auditRef = db.collection('audit_logs').doc();
      transaction.create(auditRef, {
        action: 'STAFF_PAGE_NAVIGATION',
        userId: decoded.uid,
        details: `${staffName} (${role}) navigated from ${fromPath} to ${toPath}.`,
        fromPath,
        toPath,
        deviceId,
        timestamp: now,
        severity: 'INFO',
      });
      return true;
    });

    if (shouldLog) {
      const staffName = String(profile.displayName || profile.email || decoded.uid).slice(0, 120);
      void notifyTelegramOperations({
        type: 'SECURITY',
        title: 'Staff page navigation',
        message: `${staffName} (${role}) navigated from ${fromPath} to ${toPath}. Time: ${new Date(now).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}.`,
      }).catch(error => console.error('[TELEGRAM_NAVIGATION]', error));
    }

    return NextResponse.json({ ok: true, logged: shouldLog }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[STAFF_NAVIGATION_LOG]', error);
    return NextResponse.json({ error: 'Navigation event could not be recorded.' }, { status: 500 });
  }
}
