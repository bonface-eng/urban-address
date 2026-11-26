import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIGRATION_ID = 'historical-spend-v1';
const POINTS_PER_KES = 10;
const ROOT_ADMINS = [
  'urbanautoexpressnakuru@gmail.com',
  'urbanaautoexpressnakuru@gmail.com',
  'samuelkarani044@gmail.com',
  'gmaina424@gmail.com',
  'bonfacewana3072@gmail.com',
];

function getDb() {
  let app = admin.apps[0];
  if (!app) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (raw) {
      const credentials = JSON.parse(raw);
      if (credentials.private_key) credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      app = admin.initializeApp({ credential: admin.credential.cert(credentials) });
    } else {
      app = admin.initializeApp();
    }
  }
  return admin.firestore(app);
}

async function authorize(req: NextRequest, db: admin.firestore.Firestore) {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const email = String(decoded.email || '').toLowerCase();
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    const role = String(userDoc.data()?.role || '').toUpperCase();
    const isSuperAdmin = ROOT_ADMINS.includes(email) || (email ? (await db.collection('admins').doc(email).get()).exists : false);
    if (!isSuperAdmin && !['ADMIN', 'MANAGER', 'SUPERVISOR'].includes(role)) return null;
    const requiresDailyOtp = isSuperAdmin || role === 'ADMIN';
    if (requiresDailyOtp && decoded.adminOtpVerifiedDate !== new Date().toISOString().slice(0, 10)) return null;
    return { uid: decoded.uid, email };
  } catch {
    return null;
  }
}

function normalizePlate(value: unknown) {
  return typeof value === 'string' ? value.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
}
function pointsFor(spend: number) {
  return Math.floor((spend + 1e-8) / POINTS_PER_KES);
}
function stableHash(value: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(value) ?? '').digest('hex');
}

async function buildPreview(db: admin.firestore.Firestore) {
  const [ordersSnap, usersSnap, fleetSnap] = await Promise.all([
    db.collection('orders').get(),
    db.collection('users').get(),
    db.collectionGroup('fleet').get(),
  ]);

  const users = new Map<string, any>();
  usersSnap.docs.forEach(doc => users.set(doc.id, { id: doc.id, ...doc.data() }));
  const plateOwners = new Map<string, Set<string>>();
  const fleetDocs = new Map<string, { uid: string; plate: string; ref: admin.firestore.DocumentReference; data: any }>();

  const addOwner = (plate: string, uid: string) => {
    if (!plate || !uid || !users.has(uid)) return;
    if (!plateOwners.has(plate)) plateOwners.set(plate, new Set());
    plateOwners.get(plate)!.add(uid);
  };

  fleetSnap.docs.forEach(doc => {
    const parts = doc.ref.path.split('/');
    const uid = parts.length >= 4 ? parts[1] : '';
    const data = doc.data();
    const plate = normalizePlate(data.plateNumber || doc.id);
    if (!uid || !plate) return;
    addOwner(plate, uid);
    fleetDocs.set(uid + ':' + plate, { uid, plate, ref: doc.ref, data });
  });

  // Historical orders with an explicit customer ID establish additional plate ownership.
  ordersSnap.docs.forEach(doc => {
    const data = doc.data();
    const plate = normalizePlate(data.plateNumber);
    if (plate && typeof data.customerId === 'string') addOwner(plate, data.customerId);
  });

  const customerSpend = new Map<string, number>();
  const plateSpend = new Map<string, number>();
  let paidOrderCount = 0;
  let excludedOrderCount = 0;
  let unmatchedPlateOrderCount = 0;
  let orphanCustomerOrderCount = 0;
  let matchedByPlateCount = 0;

  ordersSnap.docs.forEach(doc => {
    const order = doc.data();
    if (order.status !== 'PAID') {
      excludedOrderCount += 1;
      return;
    }
    const total = Number(order.total);
    if (!Number.isFinite(total) || total <= 0) return;
    paidOrderCount += 1;

    const plate = normalizePlate(order.plateNumber);
    const isVehicleWash = order.type === 'CARWASH' && !!plate && order.jobType !== 'CARPET';
    let customerId = typeof order.customerId === 'string' && users.has(order.customerId) ? order.customerId : '';

    if (!customerId && isVehicleWash && plate) {
      const owners = [...(plateOwners.get(plate) || [])];
      if (owners.length === 1) {
        customerId = owners[0];
        matchedByPlateCount += 1;
      } else {
        unmatchedPlateOrderCount += 1;
      }
    } else if (!customerId && typeof order.customerId === 'string') {
      orphanCustomerOrderCount += 1;
    }

    if (customerId) customerSpend.set(customerId, (customerSpend.get(customerId) || 0) + total);
    if (isVehicleWash) {
      if (plate) plateSpend.set(plate, (plateSpend.get(plate) || 0) + total);
    }
  });

  const customerUpdates = [...customerSpend.entries()]
    .filter(([uid, spend]) => users.has(uid) && spend > 0)
    .map(([uid, spend]) => ({
      uid,
      displayName: String(users.get(uid)?.displayName || users.get(uid)?.name || 'Customer'),
      email: String(users.get(uid)?.email || ''),
      totalSpent: Math.round(spend * 100) / 100,
      loyaltyPoints: pointsFor(spend),
      previousPoints: Number(users.get(uid)?.loyaltyPoints || 0),
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent);

  const plateUpdates = [...plateSpend.entries()]
    .filter(([, spend]) => spend > 0)
    .map(([plate, spend]) => {
      const owners = [...(plateOwners.get(plate) || [])];
      const uid = owners.length === 1 ? owners[0] : '';
      const fleet = uid ? fleetDocs.get(uid + ':' + plate) : undefined;
      return {
        plateNumber: plate,
        customerId: uid || null,
        customerName: uid ? String(users.get(uid)?.displayName || users.get(uid)?.name || 'Customer') : null,
        totalSpent: Math.round(spend * 100) / 100,
        loyaltyPoints: pointsFor(spend),
        ownerMatch: owners.length === 1 ? 'MATCHED' : owners.length > 1 ? 'AMBIGUOUS' : 'UNASSIGNED',
        fleetPath: fleet?.ref.path || (uid ? `users/${uid}/fleet/${plate}` : null),
      };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent);

  const plan = {
    migrationId: MIGRATION_ID,
    pointRate: '1 point per KES 10',
    customerUpdates: customerUpdates.map(({ uid, totalSpent, loyaltyPoints }: any) => ({ uid, totalSpent, loyaltyPoints })),
    plateUpdates: plateUpdates.map(({ plateNumber, customerId, totalSpent, loyaltyPoints, ownerMatch }: any) => ({ plateNumber, customerId, totalSpent, loyaltyPoints, ownerMatch })),
  };
  const previewHash = stableHash(plan);
  const matchedCustomers = customerUpdates.length;
  const matchedPlates = plateUpdates.filter(item => item.ownerMatch === 'MATCHED').length;
  return {
    previewHash,
    migrationId: MIGRATION_ID,
    pointRate: '1 point per KES 10 eligible paid spend',
    summary: {
      scannedOrders: ordersSnap.size,
      paidOrders: paidOrderCount,
      excludedNonPaidOrders: excludedOrderCount,
      matchedCustomers,
      matchedPlates,
      unassignedOrAmbiguousPlates: plateUpdates.length - matchedPlates,
      matchedByPlateOrders: matchedByPlateCount,
      unmatchedPlateOrders: unmatchedPlateOrderCount,
      orphanCustomerOrders: orphanCustomerOrderCount,
      customerPoints: customerUpdates.reduce((sum, item) => sum + item.loyaltyPoints, 0),
      vehiclePoints: plateUpdates.reduce((sum, item) => sum + item.loyaltyPoints, 0),
    },
    customers: customerUpdates,
    plates: plateUpdates,
    applied: (await db.collection('loyalty_reconciliations').doc(MIGRATION_ID).get()).data()?.status === 'APPLIED',
  };
}

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    if (!(await authorize(req, db))) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
    const preview = await buildPreview(db);
    return NextResponse.json(preview);
  } catch (error) {
    console.error('[LOYALTY_PREVIEW]', error);
    return NextResponse.json({ error: 'Unable to build the historical loyalty preview.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let db: admin.firestore.Firestore | null = null;
  let migrationStarted = false;
  try {
    db = getDb();
    const actor = await authorize(req, db);
    if (!actor) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
    const body = await req.json();
    if (body?.confirm !== true || typeof body?.previewHash !== 'string') {
      return NextResponse.json({ error: 'Explicit confirmation and a preview hash are required.' }, { status: 400 });
    }

    const migrationRef = db.collection('loyalty_reconciliations').doc(MIGRATION_ID);
    const preview = await buildPreview(db);
    if (preview.previewHash !== body.previewHash) {
      return NextResponse.json({ error: 'Transaction data changed after preview. Refresh the preview before applying.' }, { status: 409 });
    }

    // Acquire a transactional one-time lock. A stale lock can be retried after
    // 15 minutes because all balance writes are deterministic set operations.
    const lockResult = await db.runTransaction(async transaction => {
      const current = await transaction.get(migrationRef);
      const state = current.data();
      if (state?.status === 'APPLIED') return 'APPLIED';
      if (state?.status === 'IN_PROGRESS' && Date.now() - Number(state.startedAt || Date.now()) < 15 * 60 * 1000) return 'IN_PROGRESS';
      transaction.set(migrationRef, {
        migrationId: MIGRATION_ID,
        previewHash: preview.previewHash,
        status: 'IN_PROGRESS',
        startedAt: Date.now(),
        startedBy: actor.uid,
        pointRate: preview.pointRate,
        summary: preview.summary,
      }, { merge: true });
      return 'LOCKED';
    });
    if (lockResult === 'APPLIED') {
      return NextResponse.json({ error: 'Historical loyalty migration has already been applied.', applied: true }, { status: 409 });
    }
    if (lockResult !== 'LOCKED') {
      return NextResponse.json({ error: 'A reconciliation is already in progress. Refresh and check its status.', applied: false }, { status: 409 });
    }
    migrationStarted = true;

    const writes: Array<{ ref: admin.firestore.DocumentReference; data: admin.firestore.DocumentData }> = [];
    const reconciledAt = Date.now();
    preview.customers.forEach((customer: any) => {
      writes.push({
        ref: db!.collection('users').doc(customer.uid),
        data: {
          loyaltyPoints: customer.loyaltyPoints,
          totalSpent: customer.totalSpent,
          loyaltyReconciledAt: reconciledAt,
          loyaltyReconciliationId: MIGRATION_ID,
        },
      });
    });
    preview.plates.forEach((plate: any) => {
      const plateBalance = {
        plateNumber: plate.plateNumber,
        loyaltyPoints: plate.loyaltyPoints,
        totalLoyaltySpend: plate.totalSpent,
        loyaltyReconciledAt: reconciledAt,
        loyaltyReconciliationId: MIGRATION_ID,
      };
      // Persist every registration's balance in the vehicle registry, including
      // plates that still need an owner to be confirmed.
      writes.push({
        ref: db!.collection('vehicles').doc(plate.plateNumber),
        data: { ...plateBalance, loyaltyCustomerId: plate.customerId || null },
      });
      if (plate.customerId && plate.fleetPath) {
        writes.push({ ref: db!.doc(plate.fleetPath), data: plateBalance });
      }
    });

    // Firestore batches are limited to 500 operations. Reapplying a failed
    // chunk is safe because each write sets a deterministic balance.
    for (let offset = 0; offset < writes.length; offset += 450) {
      const batch = db.batch();
      writes.slice(offset, offset + 450).forEach(write => batch.set(write.ref, write.data, { merge: true }));
      await batch.commit();
    }

    await migrationRef.set({
      migrationId: MIGRATION_ID,
      previewHash: preview.previewHash,
      pointRate: preview.pointRate,
      summary: preview.summary,
      appliedAt: Date.now(),
      appliedBy: actor.uid,
      customerCount: preview.customers.length,
      plateCount: preview.plates.length,
      status: 'APPLIED',
    }, { merge: true });
    await db.collection('audit_logs').add({
      action: 'HISTORICAL_LOYALTY_RECONCILIATION',
      userId: actor.uid,
      details: 'Applied historical loyalty points at 1 point per KES 10 of eligible paid orders. Migration: ' + MIGRATION_ID,
      timestamp: Date.now(),
      severity: 'WARNING',
    });
    return NextResponse.json({ success: true, summary: preview.summary });
  } catch (error) {
    console.error('[LOYALTY_APPLY]', error);
    if (db && migrationStarted) {
      try {
        await db.collection('loyalty_reconciliations').doc(MIGRATION_ID).set({
          status: 'FAILED',
          failedAt: Date.now(),
          failureNote: 'A batch failed. Refresh the preview and retry; writes are deterministic.',
        }, { merge: true });
      } catch (statusError) {
        console.error('[LOYALTY_MIGRATION_STATUS]', statusError);
      }
    }
    return NextResponse.json({ error: 'Historical loyalty reconciliation failed. Review server logs before retrying.' }, { status: 500 });
  }
}
