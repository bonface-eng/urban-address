import { NextRequest, NextResponse } from 'next/server';
import * as admin from '@/lib/db/admin';
import { bot } from '@/lib/telegram/bot';
import { getDbAdmin } from '@/lib/db/admin';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const safe = (value: unknown, max = 180) => String(value ?? '')
  .replace(/[<>\r\n]/g, ' ')
  .replace(/(password|token|secret|authorization|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
  .replace(/(?:\+?\d[\d ()-]{7,}\d)/g, '[phone]')
  .slice(0, max);

async function recipients(db: ReturnType<typeof getDbAdmin>) {
  const ids = new Set<string>();
  try {
    const env = JSON.parse(process.env.TELEGRAM_USER_ACCESS || '{}') as Record<string, { role?: string }>;
    for (const [id, value] of Object.entries(env)) {
      if (/^\d{1,20}$/.test(id) && ['OWNER', 'MANAGER'].includes(String(value.role || '').toUpperCase())) ids.add(id);
    }
  } catch { logger.warn('Invalid TELEGRAM_USER_ACCESS JSON in Telegram monitor'); }
  String(process.env.OWNER_TELEGRAM_IDS || '').split(/[;,\s]+/).filter(id => /^\d{1,20}$/.test(id)).forEach(id => ids.add(id));
  const configured = await db.collection('telegram_user_access').get();
  for (const user of configured.docs) {
    const data = user.data();
    if (data.enabled === false) { ids.delete(user.id); continue; }
    if (['OWNER', 'MANAGER'].includes(String(data.role || '').toUpperCase()) && /^\d{1,20}$/.test(user.id)) ids.add(user.id);
  }
  return [...ids];
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDbAdmin();
    const recipientIds = await recipients(db);
    if (!recipientIds.length) return NextResponse.json({ ok: true, sent: 0, reason: 'No management recipients configured.' });

    const now = Date.now();
    const cutoff = now - 4 * 60 * 1000;
    const activeSnap = await db.collection('telegram_presence').where('lastSeenAt', '>=', cutoff).orderBy('lastSeenAt', 'desc').limit(500).get();
    const groups: Record<'CUSTOMER' | 'STAFF' | 'ADMIN', string[]> = { CUSTOMER: [], STAFF: [], ADMIN: [] };
    for (const doc of activeSnap.docs) {
      const data = doc.data();
      const category = data.category === 'ADMIN' ? 'ADMIN' : data.category === 'STAFF' ? 'STAFF' : 'CUSTOMER';
      const name = safe(data.displayName || 'Unnamed account', 70);
      const email = safe(data.email || 'no email', 90);
      groups[category].push(`• ${name} — ${email}`);
    }
    const stamp = new Date(now).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
    const rosterLines = [
      `ACTIVE ACCOUNT ROSTER | Urban Address`,
      stamp,
      `Seen in the last 4 minutes: ${activeSnap.size}`,
      '',
      `CUSTOMERS (${groups.CUSTOMER.length})`,
      ...(groups.CUSTOMER.length ? groups.CUSTOMER : ['• None']),
      '',
      `STAFF (${groups.STAFF.length})`,
      ...(groups.STAFF.length ? groups.STAFF : ['• None']),
      '',
      `ADMINISTRATORS (${groups.ADMIN.length})`,
      ...(groups.ADMIN.length ? groups.ADMIN : ['• None']),
    ];
    const rosterMessages: string[] = [];
    let rosterMessage = '';
    for (const line of rosterLines) {
      if (rosterMessage.length + line.length + 1 > 3500) {
        rosterMessages.push(rosterMessage);
        rosterMessage = `ACTIVE ACCOUNT ROSTER | continued\n`;
      }
      rosterMessage += line + '\n';
    }
    if (rosterMessage.trim()) rosterMessages.push(rosterMessage);

    const rosterResults = await Promise.allSettled(recipientIds.flatMap(id => rosterMessages.map(message => bot.telegram.sendMessage(id, message))));
    const rosterFailed = rosterResults.filter(x => x.status === 'rejected').length;

    // Forward the operational audit trail incrementally. The cursor is advanced only
    // after a complete batch has reached every configured management recipient.
    const cursorRef = db.collection('telegram_monitor_state').doc('audit_cursor');
    const cursorSnap = await cursorRef.get();
    let cursorTime = Number(cursorSnap.data()?.timestamp || 0);
    let cursorId = String(cursorSnap.data()?.documentId || '');
    if (!cursorSnap.exists) {
      const latestAudit = await db.collection('audit_logs').orderBy('timestamp', 'desc').limit(1).get();
      if (!latestAudit.empty) {
        const latest = latestAudit.docs[0];
        cursorTime = Number(latest.data().timestamp || 0);
        cursorId = latest.id;
      }
      await cursorRef.set({ timestamp: cursorTime, documentId: cursorId, initializedAt: now }, { merge: true });
    }
    let auditSent = 0;
    let auditFailed = 0;

    for (let page = 0; page < 5; page++) {
      let query = db.collection('audit_logs').orderBy('timestamp', 'asc').orderBy(admin.firestore.FieldPath.documentId(), 'asc').limit(100);
      if (cursorTime > 0) query = query.startAfter(cursorTime, cursorId);
      const auditSnap = await query.get();
      if (auditSnap.empty) break;

      const lines = auditSnap.docs.map(doc => {
        const data = doc.data();
        const when = new Date(Number(data.timestamp || now)).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
        const action = safe(data.action || 'DATA_CHANGE', 90);
        const actor = safe(data.actorName || data.userName || data.userId || data.actorType || 'Unknown actor', 80);
        const details = safe(data.details || data.description || '', 180);
        const severity = safe(data.severity || 'INFO', 16);
        return `[${severity}] ${action}\nBy: ${actor}\n${details}\n${when}`;
      });
      const headerText = `OPERATIONS AUDIT | Urban Address\nNew recorded changes: ${auditSnap.size}\n\n`;
      const messages: string[] = [];
      let current = headerText;
      for (const line of lines) {
        if (current.length + line.length + 2 > 3500) { messages.push(current); current = headerText; }
        current += line + '\n\n';
      }
      if (current.trim() !== headerText.trim()) messages.push(current);

      const delivery = await Promise.allSettled(recipientIds.flatMap(id => messages.map(message => bot.telegram.sendMessage(id, message))));
      const failed = delivery.filter(x => x.status === 'rejected').length;
      if (failed) { auditFailed += failed; break; }

      const last = auditSnap.docs[auditSnap.docs.length - 1];
      cursorTime = Number(last.data().timestamp || cursorTime);
      cursorId = last.id;
      await cursorRef.set({ timestamp: cursorTime, documentId: cursorId, updatedAt: now }, { merge: true });
      auditSent += auditSnap.size;
      if (auditSnap.size < 100) break;
    }

    // Forward the separate system/admin audit stream as well; admin CRUD and
    // access-management modules write here rather than to audit_logs.
    const systemCursorRef = db.collection('telegram_monitor_state').doc('system_audit_cursor');
    const systemCursorSnap = await systemCursorRef.get();
    let systemCursorTime = Number(systemCursorSnap.data()?.timestamp || 0);
    let systemCursorId = String(systemCursorSnap.data()?.documentId || '');
    if (!systemCursorSnap.exists) {
      const latestSystem = await db.collection('system_audit_logs').orderBy('createdAt', 'desc').limit(1).get();
      if (!latestSystem.empty) {
        systemCursorTime = Number(latestSystem.docs[0].data().createdAt || 0);
        systemCursorId = latestSystem.docs[0].id;
      }
      await systemCursorRef.set({ timestamp: systemCursorTime, documentId: systemCursorId, initializedAt: now }, { merge: true });
    }
    let systemAuditForwarded = 0;
    let systemAuditFailed = 0;
    for (let page = 0; page < 3; page++) {
      let query = db.collection('system_audit_logs').orderBy('createdAt', 'asc').orderBy(admin.firestore.FieldPath.documentId(), 'asc').limit(100);
      if (systemCursorTime > 0) query = query.startAfter(systemCursorTime, systemCursorId);
      const pageSnap = await query.get();
      if (pageSnap.empty) break;
      const rows = pageSnap.docs.filter(doc => String(doc.data().action || '') !== 'TELEGRAM_LIVE_MONITOR_RUN');
      const header = 'SYSTEM / ADMIN AUDIT | Urban Address\\n';
      const messages: string[] = [];
      let message = header;
      for (const doc of rows) {
        const data = doc.data();
        const when = new Date(Number(data.createdAt || now)).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
        const action = safe(data.action || 'ADMIN_DATA_CHANGE', 90);
        const actor = safe(data.actorName || data.actorEmail || data.actorUid || data.actorType || 'Unknown actor', 80);
        const detailsValue = data.details && typeof data.details === 'object' ? JSON.stringify(data.details) : data.details || data.description || '';
        const details = safe(detailsValue, 220);
        const line = `[${safe(data.severity || 'INFO', 16)}] ${action}\\nBy: ${actor}\\n${details}\\n${when}\\n\\n`;
        if (message.length + line.length > 3500) { messages.push(message); message = header; }
        message += line;
      }
      if (message !== header) messages.push(message);
      const delivery = await Promise.allSettled(recipientIds.flatMap(id => messages.map(text => bot.telegram.sendMessage(id, text))));
      const failed = delivery.filter(result => result.status === 'rejected').length;
      if (failed) { systemAuditFailed += failed; break; }
      const last = pageSnap.docs[pageSnap.docs.length - 1];
      systemCursorTime = Number(last.data().createdAt || systemCursorTime);
      systemCursorId = last.id;
      await systemCursorRef.set({ timestamp: systemCursorTime, documentId: systemCursorId, updatedAt: now }, { merge: true });
      systemAuditForwarded += rows.length;
      if (pageSnap.size < 100) break;
    }
    await db.collection('system_audit_logs').add({
      action: 'TELEGRAM_LIVE_MONITOR_RUN',
      actorType: 'SYSTEM',
      createdAt: now,
      activeCustomers: groups.CUSTOMER.length,
      activeStaff: groups.STAFF.length,
      activeAdmins: groups.ADMIN.length,
      auditEventsForwarded: auditSent,
      systemAuditEventsForwarded: systemAuditForwarded,
      systemAuditDeliveryFailures: systemAuditFailed,
      rosterDeliveryFailures: rosterFailed,
      auditDeliveryFailures: auditFailed,
    });

    return NextResponse.json({
      ok: true,
      active: { customers: groups.CUSTOMER.length, staff: groups.STAFF.length, administrators: groups.ADMIN.length },
      rosterRecipients: recipientIds.length,
      rosterDeliveryFailures: rosterFailed,
      auditEventsForwarded: auditSent,
      auditDeliveryFailures: auditFailed,
    });
  } catch (error) {
    logger.error('Telegram live monitor failed', error);
    return NextResponse.json({ error: 'Telegram monitoring failed.' }, { status: 500 });
  }
}
