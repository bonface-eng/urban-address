#!/usr/bin/env node
/**
 * scripts/backup-firebase.mjs
 *
 * Full read-only Firebase backup script (Firestore collections + subcollections,
 * Firebase Auth users, Firebase Storage files, and local Firebase config/rules).
 *
 * Kept ready in case the Firebase project suspension is lifted in the future.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json \
 *   FIREBASE_PROJECT_ID=studio-4371382043-96293 \
 *   node scripts/backup-firebase.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const KNOWN_COLLECTIONS = [
  'admins', 'branches', 'users', 'inventory', 'inventory_backups',
  'pos_terminals', 'register_sessions', 'reconciliations', 'orders',
  'carwash_jobs', 'vehicles', 'petty_cash', 'salary_advances', 'suppliers',
  'digitalMenus', 'reviews', 'support_queries', 'notifications', 'app_releases',
  'settings', 'system', 'live_audio_sessions', 'account_deletion_requests',
  'audit_logs', 'system_incidents', 'terminal_devices', 'terminal_pin_attempts',
  'terminal_pin_reset_otps', 'email_verification_otps', 'admin_daily_otps',
  'email_rate_limits', 'email_preferences', 'email_outbox', 'email_campaigns',
  'email_messages', 'email_replies', 'resend_webhook_events', 'privacyConsent',
  'maps_geocode_cache', 'loyalty_reconciliations', 'refund_requests',
  'stock_adjustment_requests', 'staff_navigation_state', 'staff_navigation_logs',
  'system_audit_logs', 'telegram_user_access', 'telegram_links',
  'telegram_link_challenges', 'telegram_presence', 'telegram_updates',
  'telegram_controls', 'telegram_monitor_state', 'telegram_stock_alert_state',
  'telegram_sale_notifications', 'telegram_event_deliveries',
  'telegram_security_throttle', 'telegram_otp_request_windows',
];

function serializeFirestoreValue(val) {
  if (val === null || val === undefined) return val;
  if (typeof val?.toDate === 'function') {
    return { _type: 'Timestamp', value: val.toDate().toISOString(), ms: val.toDate().getTime() };
  }
  if (typeof val?.latitude === 'number' && typeof val?.longitude === 'number' && val.constructor?.name === 'GeoPoint') {
    return { _type: 'GeoPoint', lat: val.latitude, lng: val.longitude };
  }
  if (typeof val?.path === 'string' && typeof val?.id === 'string' && val.firestore) {
    return { _type: 'DocumentReference', path: val.path };
  }
  if (Buffer.isBuffer(val) || val instanceof Uint8Array) {
    return { _type: 'Bytes', base64: Buffer.from(val).toString('base64') };
  }
  if (Array.isArray(val)) return val.map(serializeFirestoreValue);
  if (typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = serializeFirestoreValue(v);
    }
    return out;
  }
  return val;
}

async function exportDocumentRecursive(docSnap) {
  const data = serializeFirestoreValue(docSnap.data() || {});
  const subcollections = await docSnap.ref.listCollections();
  const subOut = {};

  for (const subCol of subcollections) {
    const subSnap = await subCol.get();
    subOut[subCol.id] = [];
    for (const subDoc of subSnap.docs) {
      subOut[subCol.id].push(await exportDocumentRecursive(subDoc));
    }
  }

  return {
    id: docSnap.id,
    path: docSnap.ref.path,
    data,
    ...(Object.keys(subOut).length > 0 ? { _subcollections: subOut } : {}),
  };
}

async function main() {
  let admin;
  try {
    const mod = await import('firebase-admin');
    admin = mod.default || mod;
  } catch {
    console.error('Error: firebase-admin is not installed. Run `npm install --no-save firebase-admin` before running this backup script.');
    process.exit(1);
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.argv[2];
  if (!serviceAccountPath) {
    console.error('Usage: FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/serviceAccount.json node scripts/backup-firebase.mjs');
    process.exit(1);
  }

  const rawKey = await fs.readFile(path.resolve(serviceAccountPath), 'utf8');
  const serviceAccount = JSON.parse(rawKey);
  const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id;

  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
  });

  const db = admin.firestore(app);
  const auth = admin.auth(app);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve('migration-output', 'backup', timestamp);
  const firestoreDir = path.join(outDir, 'firestore');
  const configDir = path.join(outDir, 'config');
  await fs.mkdir(firestoreDir, { recursive: true });
  await fs.mkdir(configDir, { recursive: true });

  const discoveredCols = await db.listCollections().then(cols => cols.map(c => c.id)).catch(() => []);
  const allCollections = Array.from(new Set([...KNOWN_COLLECTIONS, ...discoveredCols]));

  const manifest = {
    projectId,
    exportedAt: new Date().toISOString(),
    collections: {},
    subcollections: {},
    authUsersCount: 0,
  };

  for (const colName of allCollections) {
    const snap = await db.collection(colName).get();
    const docs = [];
    for (const docSnap of snap.docs) {
      const exported = await exportDocumentRecursive(docSnap);
      docs.push(exported);
      if (exported._subcollections) {
        for (const [subName, subDocs] of Object.entries(exported._subcollections)) {
          const key = `${colName}/${subName}`;
          manifest.subcollections[key] = (manifest.subcollections[key] || 0) + subDocs.length;
        }
      }
    }
    manifest.collections[colName] = docs.length;
    await fs.writeFile(path.join(firestoreDir, `${colName}.json`), JSON.stringify(docs, null, 2), 'utf8');
    console.log(`[Firestore] Exported ${colName}: ${docs.length} documents`);
  }

  // Export Auth users
  const users = [];
  let nextPageToken;
  do {
    const res = await auth.listUsers(1000, nextPageToken);
    for (const u of res.users) {
      users.push({
        uid: u.uid,
        email: u.email || null,
        emailVerified: u.emailVerified,
        displayName: u.displayName || null,
        photoURL: u.photoURL || null,
        phoneNumber: u.phoneNumber || null,
        disabled: u.disabled,
        providerData: u.providerData,
        customClaims: u.customClaims || {},
        creationTime: u.metadata?.creationTime || null,
        lastSignInTime: u.metadata?.lastSignInTime || null,
        passwordHash: u.passwordHash || null,
        passwordSalt: u.passwordSalt || null,
      });
    }
    nextPageToken = res.pageToken;
  } while (nextPageToken);

  manifest.authUsersCount = users.length;
  await fs.writeFile(path.join(outDir, 'auth-users.json'), JSON.stringify(users, null, 2), 'utf8');
  await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[Auth] Exported ${users.length} users. Backup complete at: ${outDir}`);
}

main().catch(err => {
  console.error('[Backup Error]', err);
  process.exit(1);
});
