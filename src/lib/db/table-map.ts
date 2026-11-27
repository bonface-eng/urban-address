/**
 * src/lib/db/table-map.ts
 *
 * Bi-directional schema mapping between application collection/subcollection paths
 * and the 55 normalized PostgreSQL tables in Supabase, including camelCase <-> snake_case
 * column translation and JSONB envelope handling.
 */

export interface ResolvedTablePath {
  table: string;
  docId?: string;
  parentFilters: Record<string, string>;
  /** True if the table stores dynamic document fields inside a `data` JSONB column */
  isJsonEnvelope?: boolean;
  /** True if the table also has a `raw_data` JSONB column for extra unmapped properties */
  hasRawData?: boolean;
  /** Primary key column name (defaults to 'id', 'email' for admins) */
  pkColumn: string;
}

const TOP_LEVEL_TABLE_MAP: Record<string, { table: string; pkColumn?: string; isJsonEnvelope?: boolean; hasRawData?: boolean }> = {
  users: { table: 'profiles', pkColumn: 'uid' },
  profiles: { table: 'profiles', pkColumn: 'uid' },
  admins: { table: 'admins', pkColumn: 'email' },
  branches: { table: 'branches' },
  inventory: { table: 'inventory' },
  inventory_backups: { table: 'inventory_backups' },
  pos_terminals: { table: 'pos_terminals' },
  register_sessions: { table: 'register_sessions' },
  reconciliations: { table: 'reconciliations' },
  orders: { table: 'orders', hasRawData: true },
  order_items: { table: 'order_items' },
  carwash_jobs: { table: 'carwash_jobs' },
  vehicles: { table: 'vehicles' },
  petty_cash: { table: 'petty_cash' },
  salary_advances: { table: 'salary_advances', hasRawData: true },
  suppliers: { table: 'suppliers' },
  digitalMenus: { table: 'digital_menus' },
  digital_menus: { table: 'digital_menus' },
  reviews: { table: 'reviews' },
  support_queries: { table: 'support_queries' },
  notifications: { table: 'notifications' },
  app_releases: { table: 'app_releases' },
  settings: { table: 'settings', isJsonEnvelope: true },
  system: { table: 'system_config', isJsonEnvelope: true },
  system_config: { table: 'system_config', isJsonEnvelope: true },
  live_audio_sessions: { table: 'live_audio_sessions' },
  account_deletion_requests: { table: 'account_deletion_requests' },
  audit_logs: { table: 'audit_logs' },
  system_incidents: { table: 'system_incidents' },
  terminal_devices: { table: 'terminal_devices' },
  terminal_pin_attempts: { table: 'terminal_pin_attempts' },
  terminal_pin_reset_otps: { table: 'terminal_pin_reset_otps' },
  terminal_sessions: { table: 'terminal_sessions' },
  admin_daily_otps: { table: 'admin_daily_otps' },
  email_rate_limits: { table: 'email_rate_limits' },
  email_preferences: { table: 'email_preferences' },
  email_outbox: { table: 'email_outbox' },
  email_campaigns: { table: 'email_campaigns' },
  email_messages: { table: 'email_messages' },
  email_replies: { table: 'email_replies' },
  resend_webhook_events: { table: 'resend_webhook_events' },
  privacyConsent: { table: 'privacy_consent' },
  privacy_consent: { table: 'privacy_consent' },
  maps_geocode_cache: { table: 'maps_geocode_cache' },
  loyalty_reconciliations: { table: 'loyalty_reconciliations' },
  refund_requests: { table: 'refund_requests' },
  stock_adjustment_requests: { table: 'stock_adjustment_requests' },
  staff_navigation_state: { table: 'staff_navigation_state' },
  staff_navigation_logs: { table: 'staff_navigation_logs' },
  system_audit_logs: { table: 'system_audit_logs', hasRawData: true },
  telegram_user_access: { table: 'telegram_user_access' },
  telegram_links: { table: 'telegram_links' },
  telegram_link_challenges: { table: 'telegram_link_challenges' },
  telegram_presence: { table: 'telegram_presence' },
  telegram_updates: { table: 'telegram_updates' },
  telegram_controls: { table: 'telegram_controls' },
  telegram_monitor_state: { table: 'telegram_monitor_state' },
  telegram_stock_alert_state: { table: 'telegram_stock_alert_state' },
  telegram_sale_notifications: { table: 'telegram_sale_notifications' },
  telegram_event_deliveries: { table: 'telegram_event_deliveries' },
  telegram_security_throttle: { table: 'telegram_security_throttle' },
  telegram_otp_request_windows: { table: 'telegram_otp_request_windows' },
};

/**
 * Resolves a segmented path (e.g. ['users', uid, 'held_bills', billId])
 * into the target PostgreSQL table, primary key column, and parent filter conditions.
 */
export function resolveTablePath(segments: string[], isCollectionGroup = false): ResolvedTablePath {
  const clean = segments.filter(Boolean);

  if (isCollectionGroup) {
    const groupName = clean[0];
    if (groupName === 'held_bills') {
      return { table: 'user_held_bills', parentFilters: {}, hasRawData: true, pkColumn: 'id' };
    }
    if (groupName === 'fleet') {
      return { table: 'user_fleet', parentFilters: {}, hasRawData: true, pkColumn: 'id' };
    }
  }

  // Subcollections under users/{uid}/...
  if ((clean[0] === 'users' || clean[0] === 'profiles') && clean.length >= 3) {
    const parentUid = clean[1];
    const subCol = clean[2];
    const subDocId = clean[3];

    if (subCol === 'held_bills') {
      return {
        table: 'user_held_bills',
        docId: subDocId,
        parentFilters: { cashier_uid: parentUid },
        hasRawData: true,
        pkColumn: 'id',
      };
    }
    if (subCol === 'fleet') {
      return {
        table: 'user_fleet',
        docId: subDocId ? `${parentUid}_${subDocId}` : undefined,
        parentFilters: { owner_uid: parentUid },
        hasRawData: true,
        pkColumn: 'id',
      };
    }
    if (subCol === 'ai_chats') {
      return {
        table: 'user_ai_chats',
        docId: subDocId,
        parentFilters: { owner_uid: parentUid },
        pkColumn: 'id',
      };
    }
    if (subCol === 'memories') {
      return {
        table: 'user_memories',
        docId: subDocId,
        parentFilters: { owner_uid: parentUid },
        pkColumn: 'id',
      };
    }
  }

  // Subcollections under live_audio_sessions/{sessionId}/admin_candidates or staff_candidates
  if (clean[0] === 'live_audio_sessions' && clean.length >= 3) {
    const sessionId = clean[1];
    const subCol = clean[2];
    const subDocId = clean[3];
    const senderRole = subCol === 'admin_candidates' ? 'ADMIN' : 'STAFF';
    return {
      table: 'live_audio_candidates',
      docId: subDocId,
      parentFilters: { session_id: sessionId, sender_role: senderRole },
      pkColumn: 'id',
    };
  }

  // Subcollection under terminal_devices/{deviceId}/staff_members/{uid}
  if (clean[0] === 'terminal_devices' && clean.length >= 3 && clean[2] === 'staff_members') {
    const deviceId = clean[1];
    const staffUid = clean[3];
    return {
      table: 'terminal_device_staff',
      docId: staffUid ? `${deviceId}_${staffUid}` : undefined,
      parentFilters: { device_id: deviceId, ...(staffUid ? { uid: staffUid } : {}) },
      pkColumn: 'id',
    };
  }

  const topCol = clean[0];
  const docId = clean[1];
  const mapped = TOP_LEVEL_TABLE_MAP[topCol] || { table: topCol };

  return {
    table: mapped.table,
    docId,
    parentFilters: {},
    isJsonEnvelope: mapped.isJsonEnvelope,
    hasRawData: mapped.hasRawData,
    pkColumn: mapped.pkColumn || 'id',
  };
}

/**
 * Explicit camelCase -> snake_case column overrides where our PostgreSQL schema
 * uses `_ms` for epoch millisecond timestamps or specific column names.
 */
const CAMEL_TO_SNAKE_OVERRIDES: Record<string, Record<string, string>> = {
  '*': {
    createdAt: 'created_at_ms',
    updatedAt: 'updated_at_ms',
    timestamp: 'timestamp_ms',
    photoURL: 'photo_url',
  },
  email_replies: {
    from: 'from_address',
    to: 'to_addresses',
    text: 'text_body',
    html: 'html_body',
    receivedAt: 'received_at',
  },
  email_messages: {
    sentAt: 'sent_at',
  },
  admin_daily_otps: {
    sentAt: 'sent_at',
    expiresAt: 'expires_at',
    consumedAt: 'consumed_at',
    verifiedAt: 'verified_at',
  },
  terminal_pin_reset_otps: {
    lastSentAt: 'last_sent_at',
    expiresAt: 'expires_at',
    lastAttemptAt: 'last_attempt_at',
    consumedAt: 'consumed_at',
    hourlyCount: 'hourly_count',
  },
  register_sessions: {
    openedAt: 'opened_at',
    closedAt: 'closed_at',
  },
  orders: {
    paidAt: 'paid_at',
    servedAt: 'served_at',
    refundedAt: 'refunded_at',
    cancelledAt: 'cancelled_at',
    kitchenUpdatedAt: 'kitchen_updated_at',
    paymentInitiatedAt: 'payment_initiated_at',
    paymentFailedAt: 'payment_failed_at',
    refundApprovedAt: 'refund_approved_at',
  },
  petty_cash: {
    approvedAt: 'approved_at',
    deniedAt: 'denied_at',
  },
  live_audio_sessions: {
    acceptedAt: 'accepted_at',
    declinedAt: 'declined_at',
    endedAt: 'ended_at',
  },
  system_incidents: {
    acknowledgedAt: 'acknowledged_at',
    resolvedAt: 'resolved_at',
  },
  account_deletion_requests: {
    requestedAt: 'requested_at',
  },
  telegram_presence: {
    lastSeenAt: 'last_seen_at',
  },
  telegram_updates: {
    receivedAt: 'received_at',
    processingStartedAt: 'processing_started_at',
    completedAt: 'completed_at',
    failedAt: 'failed_at',
  },
  privacy_consent: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
};

const TABLES_WITH_CREATED_AT_MS = new Set([
  'branches', 'email_campaigns', 'email_outbox',
  'inventory', 'live_audio_sessions', 'pos_terminals', 'profiles',
  'refund_requests', 'staff_navigation_logs', 'stock_adjustment_requests',
  'suppliers', 'system_audit_logs', 'system_incidents',
  'telegram_event_deliveries', 'telegram_link_challenges',
  'telegram_user_access', 'terminal_pin_reset_otps',
]);

const TABLES_WITH_UPDATED_AT_MS = new Set([
  'admin_daily_otps', 'app_releases', 'branches', 'digital_menus',
  'email_campaigns', 'email_outbox', 'inventory',
  'maps_geocode_cache', 'orders', 'pos_terminals', 'profiles', 'settings',
  'suppliers', 'system_config', 'telegram_controls',
  'telegram_event_deliveries', 'telegram_link_challenges',
  'telegram_monitor_state', 'telegram_presence', 'telegram_security_throttle',
  'telegram_user_access', 'terminal_devices',
]);

const TIMESTAMPTZ_EXTRA_COLUMNS: Record<string, Set<string>> = {
  firebase_uid_map: new Set(['migrated_at']),
  terminal_device_staff: new Set([
    'disclaimer_acknowledged_at', 'pin_updated_at', 'pin_reset_at',
    'registered_at', 'last_seen_at',
  ]),
  terminal_sessions: new Set(['expires_at']),
};

function isTimestamptzColumn(table: string, col: string): boolean {
  if (col === 'created_at' || col === 'updated_at') return true;
  return Boolean(TIMESTAMPTZ_EXTRA_COLUMNS[table]?.has(col));
}

export function toSnakeColumn(table: string, field: string): string {
  if (field === 'id' || field === '__name__') return table === 'profiles' ? 'uid' : table === 'admins' ? 'email' : 'id';
  if (field === 'createdAt') return TABLES_WITH_CREATED_AT_MS.has(table) ? 'created_at_ms' : 'created_at';
  if (field === 'updatedAt') return TABLES_WITH_UPDATED_AT_MS.has(table) ? 'updated_at_ms' : 'updated_at';
  const tableOverrides = CAMEL_TO_SNAKE_OVERRIDES[table];
  if (tableOverrides && tableOverrides[field]) return tableOverrides[field];
  if (CAMEL_TO_SNAKE_OVERRIDES['*'][field]) return CAMEL_TO_SNAKE_OVERRIDES['*'][field];
  return field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

const SNAKE_TO_CAMEL_OVERRIDES: Record<string, string> = {
  created_at_ms: 'createdAt',
  updated_at_ms: 'updatedAt',
  timestamp_ms: 'timestamp',
  photo_url: 'photoURL',
  from_address: 'from',
  to_addresses: 'to',
  text_body: 'text',
  html_body: 'html',
};

export function toCamelField(column: string): string {
  if (SNAKE_TO_CAMEL_OVERRIDES[column]) return SNAKE_TO_CAMEL_OVERRIDES[column];
  return column.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Converts a PostgreSQL row (snake_case) back into the camelCase document object
 * expected by the application UI and business logic.
 */
export function rowToDocument<T = Record<string, any>>(
  resolved: ResolvedTablePath,
  row: Record<string, any> | null | undefined
): T | null {
  if (!row) return null;

  if (resolved.isJsonEnvelope) {
    const payload = typeof row.data === 'object' && row.data !== null ? row.data : {};
    return {
      ...payload,
      id: row[resolved.pkColumn] ?? row.id,
      ...(row.updated_at_ms ? { updatedAt: Number(row.updated_at_ms) } : {}),
      ...(row.updated_by ? { updatedBy: row.updated_by } : {}),
    } as T;
  }

  if (resolved.table === 'live_audio_candidates') {
    const cand = typeof row.candidate === 'object' && row.candidate !== null ? row.candidate : {};
    return {
      ...cand,
      id: row.id,
      sessionId: row.session_id,
      senderRole: row.sender_role,
    } as T;
  }

  const out: Record<string, any> = {};
  if (resolved.hasRawData && typeof row.raw_data === 'object' && row.raw_data !== null) {
    Object.assign(out, row.raw_data);
  }

  for (const [col, val] of Object.entries(row)) {
    if (col === 'raw_data' || col === 'firebase_id') continue;
    if ((col === 'created_at' || col === 'updated_at') && (`${col}_ms` in row)) continue;
    const camel = toCamelField(col);
    // Numeric coercion for Postgres numeric(12,2) / bigint returned as strings
    if (
      typeof val === 'string' &&
      /^-?\d+(\.\d+)?$/.test(val) &&
      (col.endsWith('_ms') ||
        col.endsWith('_at') ||
        [
          'price', 'cost_price', 'stock_level', 'min_stock', 'total', 'discount',
          'tip', 'tax', 'commission', 'commission_night_shift', 'base_salary',
          'total_spent', 'opening_cash', 'closing_cash', 'expected_cash',
          'actual_cash', 'variance', 'amount', 'payment_amount', 'cash_tendered',
          'change_due', 'before_stock', 'after_stock', 'delta', 'order_total',
          'total_loyalty_spend', 'size', 'last_counted_stock', 'last_seen',
          'expires_at', 'window_started_at', 'window_start', 'lease_until',
        ].includes(col))
    ) {
      out[camel] = Number(val);
    } else {
      out[camel] = val;
    }
  }

  if (resolved.table === 'profiles') {
    out.id = row.uid || row.id;
    out.uid = row.uid || row.id;
  } else if (resolved.table === 'admins') {
    out.id = row.email;
  } else if (resolved.table === 'user_ai_chats' && out.content && typeof out.content === 'object' && 'value' in out.content && Object.keys(out.content).length === 1) {
    out.content = out.content.value;
  } else {
    out.id = row[resolved.pkColumn] ?? row.id;
  }

  return out as T;
}

/**
 * Known columns per table to avoid PostgREST "column not found" errors when
 * arbitrary extra fields are passed by callers.
 */
const KNOWN_TABLE_COLUMNS: Record<string, Set<string>> = {
  profiles: new Set([
    'id', 'uid', 'firebase_id', 'email', 'display_name', 'first_name', 'middle_name', 'last_name',
    'role', 'account_type', 'assigned_units', 'branch_ids', 'active_branch_id', 'photo_url',
    'phone_number', 'address', 'delivery_location', 'mpesa_number', 'paystack_recipient_code',
    'must_change_password', 'base_salary', 'loyalty_points', 'total_spent', 'loyalty_reconciled_at',
    'loyalty_reconciliation_id', 'seen_versions', 'email_verified', 'email_verified_at',
    'terms_accepted_at', 'terms_version', 'marketing_opt_in', 'marketing_consent',
    'marketing_consent_updated_at', 'marketing_consent_source', 'preferences',
    'created_at_ms', 'updated_at_ms',
  ]),
  orders: new Set([
    'id', 'firebase_id', 'type', 'job_type', 'status', 'prep_status', 'kitchen_status',
    'total', 'discount', 'tip', 'tax', 'payment_method', 'cashier_id', 'cashier_name',
    'terminal_id', 'terminal_name', 'register_session_id', 'commission', 'customer_id',
    'customer_name', 'customer_email', 'customer_phone', 'fulfilment', 'delivery_address',
    'delivery_location', 'branch_id', 'branch_name', 'payment_status', 'payment_provider',
    'payment_ref', 'payment_receipt', 'provider_transaction_id', 'payment_phone', 'paid_phone',
    'payment_amount', 'amount_kobo', 'amount_currency', 'checkout_request_id',
    'merchant_request_id', 'airtel_transaction_id', 'payment_initiated_at',
    'payment_failure_reason', 'payment_failed_at', 'gateway_response', 'inventory_synced',
    'paid_at', 'refunded_at', 'refunded_amount', 'refund_total', 'refund_approval_status',
    'refund_approval_request_id', 'refund_approved_at', 'cancelled_at', 'cash_tendered',
    'change_due', 'scheduled_date', 'scheduled_time', 'timestamp_ms', 'updated_at_ms',
    'kitchen_updated_at', 'served_at', 'items', 'plate_number', 'vehicle_make',
    'vehicle_model', 'vehicle_color', 'table_number', 'attendant_id', 'attendant_name',
    'carpet_dimensions', 'raw_data',
  ]),
  user_held_bills: new Set([
    'id', 'firebase_id', 'user_id', 'cashier_uid', 'type', 'job_type', 'status', 'prep_status',
    'total', 'discount', 'tip', 'tax', 'payment_method', 'cashier_id', 'cashier_name',
    'terminal_id', 'terminal_name', 'register_session_id', 'commission', 'customer_id',
    'customer_name', 'customer_phone', 'branch_id', 'branch_name', 'items', 'plate_number',
    'vehicle_make', 'vehicle_model', 'vehicle_color', 'table_number', 'attendant_id',
    'attendant_name', 'carpet_dimensions', 'timestamp_ms', 'raw_data',
  ]),
  user_fleet: new Set([
    'id', 'firebase_id', 'user_id', 'owner_uid', 'plate_number', 'make', 'model', 'color',
    'vehicle_color', 'last_service', 'last_service_type', 'total_services', 'loyalty_points',
    'total_loyalty_spend', 'loyalty_reconciled_at', 'loyalty_reconciliation_id', 'raw_data',
  ]),
  salary_advances: new Set([
    'id', 'firebase_id', 'staff_id', 'staff_name', 'amount', 'reason', 'status',
    'approved_by', 'timestamp_ms', 'raw_data',
  ]),
  system_audit_logs: new Set([
    'id', 'firebase_id', 'action', 'actor_uid', 'actor_email', 'actor_name', 'actor_type',
    'target_type', 'target_id', 'details', 'event_id', 'webhook_url', 'severity',
    'created_at_ms', 'raw_data',
  ]),
};

/**
 * Converts a camelCase application document payload into a snake_case PostgreSQL row.
 */
export function documentToRow(
  resolved: ResolvedTablePath,
  data: Record<string, any>,
  explicitDocId?: string
): Record<string, any> {
  const docId = explicitDocId || resolved.docId || data.id;

  if (resolved.isJsonEnvelope) {
    const { id: _id, updatedAt, updatedBy, ...rest } = data;
    const row: Record<string, any> = {
      data: rest,
      updated_at_ms: typeof updatedAt === 'number' ? updatedAt : Date.now(),
    };
    if (docId) {
      row[resolved.pkColumn] = docId;
      row.firebase_id = docId;
    }
    if (resolved.table === 'settings' && updatedBy !== undefined) {
      row.updated_by = updatedBy;
    }
    return row;
  }

  if (resolved.table === 'live_audio_candidates') {
    const row: Record<string, any> = {
      ...resolved.parentFilters,
      candidate: data,
    };
    if (docId) {
      row.id = docId;
      row.firebase_id = docId;
    }
    return row;
  }

  const row: Record<string, any> = { ...resolved.parentFilters };
  const rawExtra: Record<string, any> = {};
  const allowedCols = KNOWN_TABLE_COLUMNS[resolved.table];

  if (docId) {
    row[resolved.pkColumn] = resolved.pkColumn === 'email' ? String(docId).toLowerCase() : docId;
    row.firebase_id = docId;
    if (resolved.table === 'profiles' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(docId)) {
      row.id = docId;
    }
    if (resolved.table === 'vehicles' && !data.plateNumber) {
      row.plate_number = docId;
    }
  }

  if (resolved.table === 'user_held_bills' && resolved.parentFilters.cashier_uid && !row.user_id) {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(resolved.parentFilters.cashier_uid)) {
      row.user_id = resolved.parentFilters.cashier_uid;
    }
  }
  if ((resolved.table === 'user_fleet' || resolved.table === 'user_ai_chats' || resolved.table === 'user_memories') && resolved.parentFilters.owner_uid && !row.user_id) {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(resolved.parentFilters.owner_uid)) {
      row.user_id = resolved.parentFilters.owner_uid;
    }
  }

  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (k === 'id' && resolved.table !== 'pos_terminals' && resolved.table !== 'branches') continue;
    if (resolved.table === 'profiles' && (k === 'pin' || k === 'masterKey')) continue;

    let col = toSnakeColumn(resolved.table, k);
    let val = v;

    if (resolved.table === 'user_ai_chats' && k === 'content' && typeof v !== 'object') {
      val = { value: v };
    }
    if (resolved.table === 'salary_advances' && k === 'userId' && !data.staffId) {
      col = 'staff_id';
    }

    if (isTimestamptzColumn(resolved.table, col)) {
      if (typeof val === 'number' && Number.isFinite(val)) {
        val = new Date(val).toISOString();
      } else if (val instanceof Date) {
        val = val.toISOString();
      }
    }

    if (allowedCols && !allowedCols.has(col)) {
      if (resolved.hasRawData) {
        rawExtra[k] = val;
      }
      continue;
    }

    row[col] = val;
  }

  if (resolved.hasRawData && Object.keys(rawExtra).length > 0) {
    row.raw_data = rawExtra;
  }

  return row;
}
