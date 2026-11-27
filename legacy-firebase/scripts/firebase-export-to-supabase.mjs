#!/usr/bin/env node
/**
 * scripts/firebase-export-to-supabase.mjs
 *
 * Converts a Firebase export directory (one JSON file per collection + optional
 * auth-users.json) into FK-ordered, batched PostgreSQL INSERT SQL files that
 * match the 55-table Urban Auto Express Supabase schema.
 *
 * Also supports mapping Firebase Auth users to Supabase Auth users and generating:
 *   - 05_data_00_auth_and_profiles.sql (firebase_uid_map + profiles reconciliation)
 *   - 05_data_01_core_tables.sql (branches, admins, inventory, vehicles, suppliers, etc.)
 *   - 05_data_02_orders_and_jobs.sql (orders, order_items, carwash_jobs, held_bills, fleet, etc.)
 *   - 05_data_03_operations_and_logs.sql (terminals, sessions, petty_cash, audit_logs, etc.)
 *   - password-reset-list.json (for users without importable password hashes)
 *
 * Usage:
 *   node scripts/firebase-export-to-supabase.mjs \
 *     --input ./migration-output/test-fixtures \
 *     --output ./migration-output/test-fixtures/generated-sql
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

function parseArgs(argv) {
  const args = {
    input: './migration-output/test-fixtures',
    output: './migration-output/sql/restored',
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--input' && argv[i + 1]) args.input = argv[++i];
    else if (argv[i] === '--output' && argv[i + 1]) args.output = argv[++i];
  }
  return args;
}

/** Deterministic UUIDv5-like mapping from a Firebase UID string so offline SQL generation is repeatable */
function deterministicUuidFromFirebaseUid(firebaseUid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(firebaseUid)) return firebaseUid.toLowerCase();
  const hash = crypto.createHash('sha256').update(`urban-address-uid:${firebaseUid}`).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    'a' + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}

function unwrapValue(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'object' && !Array.isArray(val)) {
    if (val._type === 'Timestamp') return val.ms ?? new Date(val.value).getTime();
    if (val._type === 'GeoPoint') return { latitude: val.lat, longitude: val.lng };
    if (val._type === 'DocumentReference') return val.path;
    if (val._type === 'Bytes') return val.base64;
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = unwrapValue(v);
    return out;
  }
  if (Array.isArray(val)) return val.map(unwrapValue);
  return val;
}

function toMs(val, fallback = Date.now()) {
  const unwrapped = unwrapValue(val);
  if (typeof unwrapped === 'number' && Number.isFinite(unwrapped)) return Math.trunc(unwrapped);
  if (typeof unwrapped === 'string' && unwrapped.trim()) {
    const parsed = Date.parse(unwrapped);
    if (!Number.isNaN(parsed)) return parsed;
    const num = Number(unwrapped);
    if (Number.isFinite(num)) return Math.trunc(num);
  }
  return fallback;
}

function sqlLiteral(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '0';
  if (Array.isArray(val)) {
    return `${sqlLiteral(JSON.stringify(val))}::jsonb`;
  }
  if (typeof val === 'object') {
    return `${sqlLiteral(JSON.stringify(val))}::jsonb`;
  }
  const escaped = String(val).replace(/'/g, "''");
  return `'${escaped}'`;
}

function sqlTextArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "'{}'::text[]";
  const items = arr.map(x => sqlLiteral(String(x))).join(', ');
  return `ARRAY[${items}]::text[]`;
}

function buildBatchedInserts(tableName, columns, rows, conflictTarget = '(id)', batchSize = 500) {
  if (!rows.length) return `-- No rows found for public.${tableName}\n`;
  const statements = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const valuesList = chunk
      .map(row => `  (${columns.map(col => row[col] ?? 'NULL').join(', ')})`)
      .join(',\n');
    statements.push(
      `INSERT INTO public.${tableName} (${columns.join(', ')})\nVALUES\n${valuesList}\nON CONFLICT ${conflictTarget} DO NOTHING;`
    );
  }
  return statements.join('\n\n') + '\n';
}

async function readCollectionJson(inputDir, colName) {
  const candidates = [
    path.join(inputDir, 'firestore', `${colName}.json`),
    path.join(inputDir, `${colName}.json`),
  ];
  for (const filePath of candidates) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // continue
    }
  }
  return [];
}

async function main() {
  const { input, output } = parseArgs(process.argv);
  const inputDir = path.resolve(input);
  const outputDir = path.resolve(output);
  await fs.mkdir(outputDir, { recursive: true });

  // 1. Read auth-users.json and users.json
  let authUsers = [];
  try {
    const rawAuth = await fs.readFile(path.join(inputDir, 'auth-users.json'), 'utf8');
    authUsers = JSON.parse(rawAuth);
  } catch {
    // optional
  }
  const userDocs = await readCollectionJson(inputDir, 'users');

  // Map every firebase UID to a deterministic UUID
  const uidMap = new Map();
  const passwordResetNeeded = [];

  for (const u of authUsers) {
    const supaId = deterministicUuidFromFirebaseUid(u.uid);
    uidMap.set(u.uid, { supabaseUuid: supaId, email: (u.email || '').toLowerCase().trim() });
    if (!u.passwordHash && u.email) {
      passwordResetNeeded.push({ firebaseUid: u.uid, email: u.email, reason: 'No scrypt passwordHash in export' });
    }
  }
  for (const doc of userDocs) {
    const raw = unwrapValue(doc.data || doc);
    const fUid = doc.id || raw.uid;
    if (fUid && !uidMap.has(fUid)) {
      const supaId = deterministicUuidFromFirebaseUid(fUid);
      uidMap.set(fUid, { supabaseUuid: supaId, email: String(raw.email || '').toLowerCase().trim() });
    }
  }

  // Generate 05_data_00_auth_and_profiles.sql
  const authUserRows = [];
  const uidMapRows = [];
  const profileRows = [];
  const heldBillRows = [];
  const fleetRows = [];
  const aiChatRows = [];

  for (const [fUid, info] of uidMap.entries()) {
    const email = info.email || `${fUid}@migrated.urbanautoexpress.com`;
    authUserRows.push({
      instance_id: "'00000000-0000-0000-0000-000000000000'::uuid",
      id: `${sqlLiteral(info.supabaseUuid)}::uuid`,
      aud: "'authenticated'",
      role: "'authenticated'",
      email: sqlLiteral(email),
      encrypted_password: "''",
      email_confirmed_at: 'now()',
      raw_app_meta_data: sqlLiteral({ provider: 'email', providers: ['email'], firebase_uid: fUid }),
      raw_user_meta_data: sqlLiteral({ firebase_uid: fUid }),
      created_at: 'now()',
      updated_at: 'now()',
    });
    uidMapRows.push({
      firebase_uid: sqlLiteral(fUid),
      supabase_user_id: `${sqlLiteral(info.supabaseUuid)}::uuid`,
      email: sqlLiteral(email),
    });
  }

  for (const doc of userDocs) {
    const d = unwrapValue(doc.data || doc);
    const fUid = doc.id || d.uid;
    const mapped = uidMap.get(fUid) || { supabaseUuid: deterministicUuidFromFirebaseUid(fUid), email: '' };
    const role = ['ADMIN','MANAGER','SUPERVISOR','CASHIER','STOREKEEPER','ATTENDANT','KITCHEN','CLIENT'].includes(String(d.role || '').toUpperCase())
      ? String(d.role).toUpperCase()
      : 'CLIENT';
    profileRows.push({
      id: `${sqlLiteral(mapped.supabaseUuid)}::uuid`,
      uid: sqlLiteral(fUid),
      firebase_id: sqlLiteral(fUid),
      email: sqlLiteral(String(d.email || mapped.email || '').toLowerCase().trim()),
      display_name: sqlLiteral(d.displayName || 'Urban Member'),
      role: sqlLiteral(role),
      account_type: sqlLiteral(role === 'CLIENT' ? 'CLIENT' : 'STAFF'),
      assigned_units: sqlTextArray(d.assignedUnits || []),
      branch_ids: sqlTextArray(d.branchIds || []),
      active_branch_id: sqlLiteral(d.activeBranchId || null),
      photo_url: sqlLiteral(d.photoURL || null),
      phone_number: sqlLiteral(d.phoneNumber || null),
      address: sqlLiteral(d.address || null),
      delivery_location: d.deliveryLocation ? sqlLiteral(d.deliveryLocation) : 'NULL',
      mpesa_number: sqlLiteral(d.mpesaNumber || null),
      base_salary: sqlLiteral(Number(d.baseSalary || 0)),
      loyalty_points: sqlLiteral(Math.trunc(Number(d.loyaltyPoints || 0))),
      total_spent: sqlLiteral(Number(d.totalSpent || 0)),
      seen_versions: sqlTextArray(d.seenVersions || []),
      created_at_ms: sqlLiteral(toMs(d.createdAt)),
    });

    const subs = doc._subcollections || {};
    for (const hb of subs.held_bills || []) {
      const h = unwrapValue(hb.data || hb);
      heldBillRows.push({
        id: sqlLiteral(hb.id),
        firebase_id: sqlLiteral(hb.id),
        user_id: `${sqlLiteral(mapped.supabaseUuid)}::uuid`,
        cashier_uid: sqlLiteral(fUid),
        type: sqlLiteral(h.type || 'LOUNGE'),
        status: sqlLiteral(h.status || 'PENDING'),
        total: sqlLiteral(Number(h.total || 0)),
        items: sqlLiteral(Array.isArray(h.items) ? h.items : []),
        plate_number: sqlLiteral(h.plateNumber || null),
        table_number: sqlLiteral(h.tableNumber || null),
        timestamp_ms: sqlLiteral(toMs(h.timestamp)),
      });
    }
    for (const fl of subs.fleet || []) {
      const f = unwrapValue(fl.data || fl);
      const plate = String(f.plateNumber || fl.id || '').toUpperCase();
      if (!plate) continue;
      fleetRows.push({
        id: sqlLiteral(`${fUid}_${plate}`),
        firebase_id: sqlLiteral(`${fUid}_${plate}`),
        user_id: `${sqlLiteral(mapped.supabaseUuid)}::uuid`,
        owner_uid: sqlLiteral(fUid),
        plate_number: sqlLiteral(plate),
        make: sqlLiteral(f.make || null),
        model: sqlLiteral(f.model || null),
        color: sqlLiteral(f.color || f.vehicleColor || null),
        loyalty_points: sqlLiteral(Math.trunc(Number(f.loyaltyPoints || 0))),
        total_loyalty_spend: sqlLiteral(Number(f.totalLoyaltySpend || 0)),
      });
    }
    for (const ch of subs.ai_chats || []) {
      const c = unwrapValue(ch.data || ch);
      aiChatRows.push({
        id: sqlLiteral(ch.id),
        firebase_id: sqlLiteral(ch.id),
        user_id: `${sqlLiteral(mapped.supabaseUuid)}::uuid`,
        owner_uid: sqlLiteral(fUid),
        role: sqlLiteral(c.role === 'ai' ? 'ai' : 'user'),
        content: sqlLiteral({ value: c.content }),
        timestamp_ms: sqlLiteral(toMs(c.timestamp)),
      });
    }
  }

  const sql00 = [
    '-- 05_data_00_auth_and_profiles.sql (Generated by firebase-export-to-supabase.mjs)',
    'BEGIN;',
    authUserRows.length
      ? `INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)\nVALUES\n` +
        authUserRows.map(r => `  (${r.instance_id}, ${r.id}, ${r.aud}, ${r.role}, ${r.email}, ${r.encrypted_password}, ${r.email_confirmed_at}, ${r.raw_app_meta_data}, ${r.raw_user_meta_data}, ${r.created_at}, ${r.updated_at})`).join(',\n') +
        `\nON CONFLICT (id) DO NOTHING;\n`
      : '-- No auth users',
    buildBatchedInserts('firebase_uid_map', ['firebase_uid', 'supabase_user_id', 'email'], uidMapRows, '(firebase_uid)'),
    buildBatchedInserts(
      'profiles',
      ['id', 'uid', 'firebase_id', 'email', 'display_name', 'role', 'account_type', 'assigned_units', 'branch_ids', 'active_branch_id', 'photo_url', 'phone_number', 'address', 'delivery_location', 'mpesa_number', 'base_salary', 'loyalty_points', 'total_spent', 'seen_versions', 'created_at_ms'],
      profileRows,
      '(id)'
    ),
    buildBatchedInserts('user_held_bills', ['id', 'firebase_id', 'user_id', 'cashier_uid', 'type', 'status', 'total', 'items', 'plate_number', 'table_number', 'timestamp_ms'], heldBillRows),
    buildBatchedInserts('user_fleet', ['id', 'firebase_id', 'user_id', 'owner_uid', 'plate_number', 'make', 'model', 'color', 'loyalty_points', 'total_loyalty_spend'], fleetRows),
    buildBatchedInserts('user_ai_chats', ['id', 'firebase_id', 'user_id', 'owner_uid', 'role', 'content', 'timestamp_ms'], aiChatRows),
    'COMMIT;',
  ].join('\n\n');

  await fs.writeFile(path.join(outputDir, '05_data_00_auth_and_profiles.sql'), sql00, 'utf8');

  // 2. Core Catalogue & Config Tables (branches, inventory, vehicles, suppliers, reviews, support_queries)
  const branchDocs = await readCollectionJson(inputDir, 'branches');
  const inventoryDocs = await readCollectionJson(inputDir, 'inventory');
  const vehicleDocs = await readCollectionJson(inputDir, 'vehicles');
  const supplierDocs = await readCollectionJson(inputDir, 'suppliers');

  const branchRows = branchDocs.map(doc => {
    const d = unwrapValue(doc.data || doc);
    return {
      id: sqlLiteral(doc.id),
      firebase_id: sqlLiteral(doc.id),
      business_id: "'urban-address'",
      name: sqlLiteral(d.name || 'Branch'),
      code: sqlLiteral(d.code || doc.id),
      status: sqlLiteral(d.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'),
      is_primary: sqlLiteral(Boolean(d.isPrimary)),
      location: sqlLiteral(d.location || {}),
      phone: sqlLiteral(d.phone || null),
      created_by: sqlLiteral(d.createdBy || 'SYSTEM'),
      updated_by: sqlLiteral(d.updatedBy || 'SYSTEM'),
      created_at_ms: sqlLiteral(toMs(d.createdAt)),
      updated_at_ms: sqlLiteral(toMs(d.updatedAt)),
    };
  });

  const inventoryRows = inventoryDocs.map(doc => {
    const d = unwrapValue(doc.data || doc);
    return {
      id: sqlLiteral(doc.id),
      firebase_id: sqlLiteral(doc.id),
      name: sqlLiteral(d.name || 'Unnamed Item'),
      category: sqlLiteral(d.category || 'General'),
      price: sqlLiteral(Number(d.price || 0)),
      cost_price: sqlLiteral(Number(d.costPrice || 0)),
      stock_level: sqlLiteral(Number(d.stockLevel || 0)),
      min_stock: sqlLiteral(Number(d.minStock || 0)),
      barcode: sqlLiteral(d.barcode || null),
      unit: sqlLiteral(['LOUNGE', 'STORE', 'CARWASH'].includes(d.unit) ? d.unit : 'STORE'),
      image: sqlLiteral(d.image || null),
      commission: sqlLiteral(Number(d.commission || 0)),
      commission_night_shift: sqlLiteral(Number(d.commissionNightShift || 0)),
      archived: sqlLiteral(Boolean(d.archived)),
      created_at_ms: sqlLiteral(toMs(d.createdAt)),
    };
  });

  const vehicleRows = vehicleDocs.map(doc => {
    const d = unwrapValue(doc.data || doc);
    const plate = String(d.plateNumber || doc.id).toUpperCase();
    return {
      id: sqlLiteral(plate),
      firebase_id: sqlLiteral(doc.id),
      plate_number: sqlLiteral(plate),
      make: sqlLiteral(d.make || null),
      model: sqlLiteral(d.model || null),
      color: sqlLiteral(d.color || null),
      last_seen: sqlLiteral(toMs(d.lastSeen)),
      loyalty_points: sqlLiteral(Math.trunc(Number(d.loyaltyPoints || 0))),
      total_loyalty_spend: sqlLiteral(Number(d.totalLoyaltySpend || 0)),
      loyalty_customer_id: sqlLiteral(d.loyaltyCustomerId || null),
    };
  });

  const supplierRows = supplierDocs.map(doc => {
    const d = unwrapValue(doc.data || doc);
    return {
      id: sqlLiteral(doc.id),
      firebase_id: sqlLiteral(doc.id),
      name: sqlLiteral(d.name || 'Supplier'),
      contact_person: sqlLiteral(d.contactPerson || ''),
      phone: sqlLiteral(d.phone || ''),
      email: sqlLiteral(d.email || null),
      category: sqlLiteral(d.category || 'General'),
      status: sqlLiteral(d.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'),
    };
  });

  const sql01 = [
    '-- 05_data_01_core_tables.sql (Generated by firebase-export-to-supabase.mjs)',
    'BEGIN;',
    buildBatchedInserts('branches', ['id', 'firebase_id', 'business_id', 'name', 'code', 'status', 'is_primary', 'location', 'phone', 'created_by', 'updated_by', 'created_at_ms', 'updated_at_ms'], branchRows),
    buildBatchedInserts('inventory', ['id', 'firebase_id', 'name', 'category', 'price', 'cost_price', 'stock_level', 'min_stock', 'barcode', 'unit', 'image', 'commission', 'commission_night_shift', 'archived', 'created_at_ms'], inventoryRows),
    buildBatchedInserts('vehicles', ['id', 'firebase_id', 'plate_number', 'make', 'model', 'color', 'last_seen', 'loyalty_points', 'total_loyalty_spend', 'loyalty_customer_id'], vehicleRows),
    buildBatchedInserts('suppliers', ['id', 'firebase_id', 'name', 'contact_person', 'phone', 'email', 'category', 'status'], supplierRows),
    'COMMIT;',
  ].join('\n\n');

  await fs.writeFile(path.join(outputDir, '05_data_01_core_tables.sql'), sql01, 'utf8');

  // 3. Orders, Carwash Jobs & Audit Logs
  const orderDocs = await readCollectionJson(inputDir, 'orders');
  const jobDocs = await readCollectionJson(inputDir, 'carwash_jobs');
  const auditDocs = await readCollectionJson(inputDir, 'audit_logs');

  const orderRows = orderDocs.map(doc => {
    const d = unwrapValue(doc.data || doc);
    return {
      id: sqlLiteral(doc.id),
      firebase_id: sqlLiteral(doc.id),
      type: sqlLiteral(['LOUNGE', 'STORE', 'CARWASH', 'SYSTEM-REPORT'].includes(d.type) ? d.type : 'STORE'),
      status: sqlLiteral(d.status || 'PENDING'),
      prep_status: sqlLiteral(d.prepStatus || null),
      total: sqlLiteral(Number(d.total || 0)),
      payment_method: sqlLiteral(d.paymentMethod || null),
      cashier_id: sqlLiteral(d.cashierId || null),
      cashier_name: sqlLiteral(d.cashierName || null),
      customer_id: sqlLiteral(d.customerId || null),
      customer_name: sqlLiteral(d.customerName || null),
      items: sqlLiteral(Array.isArray(d.items) ? d.items : []),
      plate_number: sqlLiteral(d.plateNumber || null),
      table_number: sqlLiteral(d.tableNumber || null),
      timestamp_ms: sqlLiteral(toMs(d.timestamp)),
    };
  });

  const jobRows = jobDocs.map(doc => {
    const d = unwrapValue(doc.data || doc);
    return {
      id: sqlLiteral(doc.id),
      firebase_id: sqlLiteral(doc.id),
      order_id: sqlLiteral(d.orderId || null),
      plate_number: sqlLiteral(d.plateNumber || 'UNKNOWN'),
      service: sqlLiteral(d.service || 'Carwash'),
      status: sqlLiteral(['QUEUED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(d.status) ? d.status : 'QUEUED'),
      attendant_id: sqlLiteral(d.attendantId || 'Unassigned'),
      attendant_name: sqlLiteral(d.attendantName || 'Unassigned'),
      price: sqlLiteral(Number(d.price || 0)),
      commission: sqlLiteral(Number(d.commission || 0)),
      customer_id: sqlLiteral(d.customerId || null),
      timestamp_ms: sqlLiteral(toMs(d.timestamp)),
    };
  });

  const auditRows = auditDocs.map(doc => {
    const d = unwrapValue(doc.data || doc);
    return {
      id: sqlLiteral(doc.id),
      firebase_id: sqlLiteral(doc.id),
      action: sqlLiteral(d.action || 'EVENT'),
      user_id: sqlLiteral(d.userId || null),
      details: sqlLiteral(d.details || ''),
      severity: sqlLiteral(['INFO', 'WARNING', 'CRITICAL'].includes(d.severity) ? d.severity : 'INFO'),
      timestamp_ms: sqlLiteral(toMs(d.timestamp)),
    };
  });

  const sql02 = [
    '-- 05_data_02_orders_jobs_and_logs.sql (Generated by firebase-export-to-supabase.mjs)',
    'BEGIN;',
    buildBatchedInserts('orders', ['id', 'firebase_id', 'type', 'status', 'prep_status', 'total', 'payment_method', 'cashier_id', 'cashier_name', 'customer_id', 'customer_name', 'items', 'plate_number', 'table_number', 'timestamp_ms'], orderRows),
    buildBatchedInserts('carwash_jobs', ['id', 'firebase_id', 'order_id', 'plate_number', 'service', 'status', 'attendant_id', 'attendant_name', 'price', 'commission', 'customer_id', 'timestamp_ms'], jobRows),
    buildBatchedInserts('audit_logs', ['id', 'firebase_id', 'action', 'user_id', 'details', 'severity', 'timestamp_ms'], auditRows),
    'COMMIT;',
  ].join('\n\n');

  await fs.writeFile(path.join(outputDir, '05_data_02_orders_jobs_and_logs.sql'), sql02, 'utf8');
  await fs.writeFile(path.join(outputDir, 'password-reset-list.json'), JSON.stringify(passwordResetNeeded, null, 2), 'utf8');

  console.log(`[Converter] Successfully converted Firebase export from ${inputDir} to ${outputDir}`);
  console.log(`  - Auth/UID mappings: ${uidMapRows.length}`);
  console.log(`  - Profiles: ${profileRows.length} (held_bills: ${heldBillRows.length}, fleet: ${fleetRows.length}, ai_chats: ${aiChatRows.length})`);
  console.log(`  - Branches: ${branchRows.length}, Inventory: ${inventoryRows.length}, Vehicles: ${vehicleRows.length}, Suppliers: ${supplierRows.length}`);
  console.log(`  - Orders: ${orderRows.length}, Carwash Jobs: ${jobRows.length}, Audit Logs: ${auditRows.length}`);
}

main().catch(err => {
  console.error('[Converter Error]', err);
  process.exit(1);
});
