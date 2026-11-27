/**
 * src/lib/db/admin.ts
 *
 * Server-side Supabase Admin (Service Role) Data Access & Auth Engine.
 * Server-side data/auth layer used across all 32 API routes, server actions, payment
 * webhooks, and Telegram bot operations while running 100% on Supabase PostgreSQL
 * and Supabase Auth Admin API.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
const getSupabaseServiceRoleClient = getSupabaseAdminClient;
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase/config';
import {
  resolveTablePath,
  toSnakeColumn,
  rowToDocument,
  documentToRow,
} from './table-map';
import {
  increment,
  arrayUnion,
  deleteField,
  serverTimestamp,
  resolveFieldOperations,
  isFieldOperation,
} from './query-client';

// =============================================================================
// ADMIN DOCUMENT & QUERY CLASSES
// =============================================================================

export class AdminDocumentSnapshot {
  readonly id: string;
  readonly ref: AdminDocumentReference;
  readonly exists: boolean;
  private readonly _data: Record<string, any> | undefined;

  constructor(ref: AdminDocumentReference, data: Record<string, any> | null | undefined) {
    this.id = ref.id;
    this.ref = ref;
    this.exists = data !== null && data !== undefined;
    this._data = data ?? undefined;
  }

  data(): Record<string, any> | undefined {
    return this._data;
  }

  get(field: string): any {
    return this._data ? this._data[field] : undefined;
  }
}

export class AdminQueryDocumentSnapshot extends AdminDocumentSnapshot {
  override readonly exists = true;
  override data(): Record<string, any> {
    return super.data() || {};
  }
}

export class AdminQuerySnapshot {
  readonly docs: AdminQueryDocumentSnapshot[];
  readonly size: number;
  readonly empty: boolean;

  constructor(docs: AdminQueryDocumentSnapshot[]) {
    this.docs = docs;
    this.size = docs.length;
    this.empty = docs.length === 0;
  }

  forEach(callback: (doc: AdminQueryDocumentSnapshot) => void) {
    this.docs.forEach(callback);
  }
}

export class AdminDocumentReference {
  readonly id: string;
  readonly path: string;
  readonly segments: string[];
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient, segments: string[]) {
    this.client = client;
    this.segments = segments.filter(Boolean);
    this.id = this.segments[this.segments.length - 1] || '';
    this.path = this.segments.join('/');
  }

  collection(subPath: string): AdminCollectionReference {
    return new AdminCollectionReference(this.client, [...this.segments, subPath]);
  }

  /** Parent collection; `.parent` of that is the owning document (null for top-level). */
  get parent(): { id: string; path: string; parent: AdminDocumentReference | null } {
    const colSegments = this.segments.slice(0, -1);
    return {
      id: colSegments[colSegments.length - 1] || '',
      path: colSegments.join('/'),
      parent: colSegments.length >= 2 ? new AdminDocumentReference(this.client, colSegments.slice(0, -1)) : null,
    };
  }

  async get(): Promise<AdminDocumentSnapshot> {
    const resolved = resolveTablePath(this.segments);
    const lookupId = resolved.pkColumn === 'email' ? (resolved.docId || this.id).toLowerCase() : (resolved.docId || this.id);

    let builder: any = this.client.from(resolved.table).select('*').eq(resolved.pkColumn, lookupId);
    for (const [col, val] of Object.entries(resolved.parentFilters)) {
      builder = builder.eq(col, val);
    }

    const { data, error } = await builder.maybeSingle();
    if (error) throw new Error(`[SUPABASE_ADMIN_GET:${resolved.table}] ${error.message}`);

    const docData = data ? rowToDocument(resolved, data) : null;
    return new AdminDocumentSnapshot(this, docData);
  }

  async set(data: Record<string, any>, options?: { merge?: boolean }): Promise<void> {
    const resolved = resolveTablePath(this.segments);
    let currentDoc: Record<string, any> | null = null;
    const hasFieldOp = Object.values(data).some(isFieldOperation);

    if (options?.merge || hasFieldOp || resolved.isJsonEnvelope) {
      const snap = await this.get().catch(() => null);
      if (snap?.exists) currentDoc = snap.data() || null;
    }

    const patched = resolveFieldOperations(currentDoc, data);
    const merged = options?.merge && currentDoc ? { ...currentDoc, ...patched } : patched;
    const row = documentToRow(resolved, merged, resolved.docId || this.id);

    const { error } = await this.client
      .from(resolved.table)
      .upsert(row, { onConflict: resolved.pkColumn });

    if (error) throw new Error(`[SUPABASE_ADMIN_SET:${resolved.table}] ${error.message}`);
  }

  async create(data: Record<string, any>): Promise<void> {
    await this.set(data, { merge: false });
  }

  async update(data: Record<string, any>): Promise<void> {
    await this.set(data, { merge: true });
  }

  async delete(): Promise<void> {
    const resolved = resolveTablePath(this.segments);
    const lookupId = resolved.pkColumn === 'email' ? (resolved.docId || this.id).toLowerCase() : (resolved.docId || this.id);

    let builder: any = this.client.from(resolved.table).delete().eq(resolved.pkColumn, lookupId);
    for (const [col, val] of Object.entries(resolved.parentFilters)) {
      builder = builder.eq(col, val);
    }

    const { error } = await builder;
    if (error) throw new Error(`[SUPABASE_ADMIN_DELETE:${resolved.table}] ${error.message}`);
  }
}

interface AdminQueryFilter {
  type: 'where' | 'orderBy' | 'limit' | 'startAfter';
  field?: string;
  op?: string;
  value?: any;
  direction?: 'asc' | 'desc';
  count?: number;
  cursorValues?: any[];
}

export class AdminQuery {
  protected readonly client: SupabaseClient;
  protected readonly segments: string[];
  protected readonly isCollectionGroup: boolean;
  protected readonly filters: AdminQueryFilter[];

  constructor(
    client: SupabaseClient,
    segments: string[],
    isCollectionGroup = false,
    filters: AdminQueryFilter[] = []
  ) {
    this.client = client;
    this.segments = segments.filter(Boolean);
    this.isCollectionGroup = isCollectionGroup;
    this.filters = filters;
  }

  where(field: string, op: string, value: any): AdminQuery {
    return new AdminQuery(this.client, this.segments, this.isCollectionGroup, [
      ...this.filters,
      { type: 'where', field, op, value },
    ]);
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): AdminQuery {
    return new AdminQuery(this.client, this.segments, this.isCollectionGroup, [
      ...this.filters,
      { type: 'orderBy', field, direction },
    ]);
  }

  limit(count: number): AdminQuery {
    return new AdminQuery(this.client, this.segments, this.isCollectionGroup, [
      ...this.filters,
      { type: 'limit', count },
    ]);
  }

  startAfter(...cursorValues: any[]): AdminQuery {
    return new AdminQuery(this.client, this.segments, this.isCollectionGroup, [
      ...this.filters,
      { type: 'startAfter', cursorValues },
    ]);
  }

  async get(): Promise<AdminQuerySnapshot> {
    const resolved = resolveTablePath(this.segments, this.isCollectionGroup);
    let builder: any = this.client.from(resolved.table).select('*');

    for (const [col, val] of Object.entries(resolved.parentFilters)) {
      builder = builder.eq(col, val);
    }

    const orderFields: Array<{ col: string; direction: 'asc' | 'desc' }> = [];

    for (const f of this.filters) {
      if (f.type === 'where' && f.field) {
        const col = toSnakeColumn(resolved.table, f.field);
        switch (f.op) {
          case '==':
            builder = f.value === null ? builder.is(col, null) : builder.eq(col, f.value);
            break;
          case '!=':
            builder = f.value === null ? builder.not(col, 'is', null) : builder.neq(col, f.value);
            break;
          case '<':
            builder = builder.lt(col, f.value);
            break;
          case '<=':
            builder = builder.lte(col, f.value);
            break;
          case '>':
            builder = builder.gt(col, f.value);
            break;
          case '>=':
            builder = builder.gte(col, f.value);
            break;
          case 'in':
            builder = builder.in(col, Array.isArray(f.value) ? f.value : [f.value]);
            break;
          case 'array-contains':
            builder = builder.contains(col, [f.value]);
            break;
        }
      } else if (f.type === 'orderBy' && f.field) {
        const col = toSnakeColumn(resolved.table, f.field);
        const dir = f.direction || 'asc';
        orderFields.push({ col, direction: dir });
        builder = builder.order(col, { ascending: dir !== 'desc' });
      } else if (f.type === 'startAfter' && f.cursorValues?.length && orderFields.length > 0) {
        const primaryOrder = orderFields[0];
        const primaryCursor = f.cursorValues[0];
        if (primaryCursor !== undefined && primaryCursor !== null) {
          builder = primaryOrder.direction === 'desc'
            ? builder.lt(primaryOrder.col, primaryCursor)
            : builder.gt(primaryOrder.col, primaryCursor);
        }
      } else if (f.type === 'limit' && typeof f.count === 'number') {
        builder = builder.limit(f.count);
      }
    }

    const { data, error } = await builder;
    if (error) throw new Error(`[SUPABASE_ADMIN_QUERY:${resolved.table}] ${error.message}`);

    const rows = Array.isArray(data) ? data : [];
    const docs = rows.map(row => {
      const converted = rowToDocument(resolved, row) || {};
      const docId = String((converted as any).id || row[resolved.pkColumn] || row.id);
      let refSegments = [...this.segments, docId];
      if (this.isCollectionGroup && resolved.table === 'user_fleet' && row.owner_uid) {
        refSegments = ['users', String(row.owner_uid), 'fleet', String(row.plate_number || docId)];
      } else if (this.isCollectionGroup && resolved.table === 'user_held_bills' && row.cashier_uid) {
        refSegments = ['users', String(row.cashier_uid), 'held_bills', docId];
      }
      const dRef = new AdminDocumentReference(this.client, refSegments);
      return new AdminQueryDocumentSnapshot(dRef, converted);
    });

    return new AdminQuerySnapshot(docs);
  }
}

export class AdminCollectionReference extends AdminQuery {
  readonly id: string;
  readonly path: string;

  constructor(client: SupabaseClient, segments: string[], isCollectionGroup = false) {
    super(client, segments, isCollectionGroup, []);
    this.id = this.segments[this.segments.length - 1] || '';
    this.path = this.segments.join('/');
  }

  doc(docId?: string): AdminDocumentReference {
    const resolvedId = docId || (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    return new AdminDocumentReference(this.client, [...this.segments, resolvedId]);
  }

  async add(data: Record<string, any>): Promise<AdminDocumentReference> {
    const dRef = this.doc();
    await dRef.set(data);
    return dRef;
  }
}

export class AdminWriteBatch {
  private ops: Array<() => Promise<void>> = [];

  set(ref: AdminDocumentReference, data: Record<string, any>, options?: { merge?: boolean }) {
    this.ops.push(() => ref.set(data, options));
    return this;
  }

  create(ref: AdminDocumentReference, data: Record<string, any>) {
    this.ops.push(() => ref.create(data));
    return this;
  }

  update(ref: AdminDocumentReference, data: Record<string, any>) {
    this.ops.push(() => ref.update(data));
    return this;
  }

  delete(ref: AdminDocumentReference) {
    this.ops.push(() => ref.delete());
    return this;
  }

  async commit(): Promise<void> {
    for (const op of this.ops) {
      await op();
    }
  }
}

export class AdminTransaction {
  private writes: Array<() => Promise<void>> = [];

  async get(refOrQuery: AdminDocumentReference | AdminQuery): Promise<any> {
    return refOrQuery.get();
  }

  set(ref: AdminDocumentReference, data: Record<string, any>, options?: { merge?: boolean }) {
    this.writes.push(() => ref.set(data, options));
    return this;
  }

  create(ref: AdminDocumentReference, data: Record<string, any>) {
    this.writes.push(() => ref.create(data));
    return this;
  }

  update(ref: AdminDocumentReference, data: Record<string, any>) {
    this.writes.push(() => ref.update(data));
    return this;
  }

  delete(ref: AdminDocumentReference) {
    this.writes.push(() => ref.delete());
    return this;
  }

  async _commit(): Promise<void> {
    for (const w of this.writes) {
      await w();
    }
  }
}

export class AdminDatabase {
  readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getSupabaseServiceRoleClient();
  }

  collection(path: string): AdminCollectionReference {
    return new AdminCollectionReference(this.client, path.split('/').filter(Boolean));
  }

  collectionGroup(collectionId: string): AdminCollectionReference {
    return new AdminCollectionReference(this.client, [collectionId], true);
  }

  doc(path: string): AdminDocumentReference {
    return new AdminDocumentReference(this.client, path.split('/').filter(Boolean));
  }

  batch(): AdminWriteBatch {
    return new AdminWriteBatch();
  }

  async runTransaction<T>(updateFunction: (transaction: AdminTransaction) => Promise<T>): Promise<T> {
    const tx = new AdminTransaction();
    const result = await updateFunction(tx);
    await tx._commit();
    return result;
  }
}

// =============================================================================
// ADMIN AUTH SERVICE (Supabase Auth Admin API)
// =============================================================================

export class AdminAuth {
  readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getSupabaseServiceRoleClient();
  }

  async verifyIdToken(token: string): Promise<{ uid: string; sub: string; email: string; [key: string]: any }> {
    const { data, error } = await this.client.auth.getUser(token);
    if (error || !data?.user) {
      throw new Error(error?.message || 'Invalid or expired authentication token.');
    }
    const u = data.user;
    const appMeta = u.app_metadata || {};
    const userMeta = u.user_metadata || {};
    const uid = String(appMeta.firebase_uid || u.id);

    return {
      uid,
      sub: u.id,
      email: u.email || '',
      email_verified: Boolean(u.email_confirmed_at || userMeta.email_verified),
      name: userMeta.display_name || userMeta.full_name || userMeta.name || u.email || '',
      ...userMeta,
      ...appMeta,
    };
  }

  private async resolveSupabaseUserId(uidOrUuid: string): Promise<string> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(uidOrUuid)) return uidOrUuid;

    const { data: profileRow } = await this.client
      .from('profiles')
      .select('id')
      .eq('uid', uidOrUuid)
      .maybeSingle();
    if (profileRow?.id) return String(profileRow.id);

    const { data: mapRow } = await this.client
      .from('firebase_uid_map')
      .select('supabase_user_id')
      .eq('firebase_uid', uidOrUuid)
      .maybeSingle();
    if (mapRow?.supabase_user_id) return String(mapRow.supabase_user_id);

    return uidOrUuid;
  }

  async getUser(uid: string) {
    const supaId = await this.resolveSupabaseUserId(uid);
    const { data, error } = await this.client.auth.admin.getUserById(supaId);
    if (error || !data?.user) {
      const err = new Error(error?.message || 'User not found') as Error & { code?: string };
      err.code = 'auth/user-not-found';
      throw err;
    }
    const u = data.user;
    return {
      uid: String(u.app_metadata?.firebase_uid || u.id),
      id: u.id,
      email: u.email || undefined,
      emailVerified: Boolean(u.email_confirmed_at || u.user_metadata?.email_verified),
      displayName: u.user_metadata?.display_name || u.user_metadata?.full_name || undefined,
      photoURL: u.user_metadata?.avatar_url || undefined,
      disabled: Boolean((u as any).banned_until),
      customClaims: u.app_metadata || {},
    };
  }

  async getUserByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    const { data: profileRow } = await this.client
      .from('profiles')
      .select('id, uid, email, display_name')
      .ilike('email', normalized)
      .maybeSingle();

    if (profileRow?.id) {
      return this.getUser(String(profileRow.id));
    }

    const { data, error } = await this.client.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(error.message);
    const match = (data?.users || []).find(u => (u.email || '').toLowerCase() === normalized);
    if (!match) {
      const err = new Error('User not found') as Error & { code?: string };
      err.code = 'auth/user-not-found';
      throw err;
    }
    return {
      uid: String(match.app_metadata?.firebase_uid || match.id),
      id: match.id,
      email: match.email || undefined,
      emailVerified: Boolean(match.email_confirmed_at),
      displayName: match.user_metadata?.display_name || match.user_metadata?.full_name || undefined,
      disabled: Boolean((match as any).banned_until),
      customClaims: match.app_metadata || {},
    };
  }

  async createUser(props: { email: string; password?: string; displayName?: string; emailVerified?: boolean }) {
    const { data, error } = await this.client.auth.admin.createUser({
      email: props.email.trim().toLowerCase(),
      password: props.password,
      email_confirm: props.emailVerified ?? true,
      user_metadata: {
        display_name: props.displayName || '',
        full_name: props.displayName || '',
      },
    });
    if (error || !data?.user) {
      throw new Error(error?.message || 'Could not create user in Supabase Auth.');
    }
    return {
      uid: data.user.id,
      email: data.user.email,
      displayName: props.displayName,
    };
  }

  async updateUser(uid: string, props: { password?: string; emailVerified?: boolean; displayName?: string }) {
    const supaId = await this.resolveSupabaseUserId(uid);
    const { error } = await this.client.auth.admin.updateUserById(supaId, {
      ...(props.password ? { password: props.password } : {}),
      ...(props.emailVerified !== undefined ? { email_confirm: props.emailVerified } : {}),
      ...(props.displayName !== undefined
        ? { user_metadata: { display_name: props.displayName, full_name: props.displayName } }
        : {}),
    });
    if (error) throw new Error(error.message);
  }

  async deleteUser(uid: string) {
    const supaId = await this.resolveSupabaseUserId(uid);
    const { error } = await this.client.auth.admin.deleteUser(supaId);
    if (error) throw new Error(error.message);
  }

  async setCustomUserClaims(uid: string, claims: Record<string, any>) {
    const supaId = await this.resolveSupabaseUserId(uid);
    const { data: existing } = await this.client.auth.admin.getUserById(supaId);
    const mergedMeta = {
      ...(existing?.user?.app_metadata || {}),
      ...claims,
    };
    const { error } = await this.client.auth.admin.updateUserById(supaId, {
      app_metadata: mergedMeta,
    });
    if (error) throw new Error(error.message);
  }

  /**
   * Issues a Supabase session for POS Terminal PIN switching:
   * Generates a one-time magiclink token_hash via Supabase Admin API and exchanges it
   * server-side on an isolated anon client to obtain a real `{ access_token, refresh_token }`
   * session for `targetUid`, encoded as a JSON string for `signInWithCustomToken`.
   */
  async createCustomToken(targetUid: string, sessionMeta?: { deviceId?: string; actorUid?: string }): Promise<string> {
    const supaId = await this.resolveSupabaseUserId(targetUid);
    const userRecord = await this.getUser(supaId);
    if (!userRecord.email) {
      throw new Error('Target staff member has no email address for session issuance.');
    }

    const { data: linkData, error: linkErr } = await this.client.auth.admin.generateLink({
      type: 'magiclink',
      email: userRecord.email,
    });

    const tokenHash = linkData?.properties?.hashed_token;
    if (linkErr || !tokenHash) {
      throw new Error(linkErr?.message || 'Could not generate terminal session link.');
    }

    const ephemeralClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: otpData, error: otpErr } = await ephemeralClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    });

    if (otpErr || !otpData?.session) {
      throw new Error(otpErr?.message || 'Could not verify terminal session token.');
    }

    if (sessionMeta?.deviceId) {
      try {
        await this.client.from('terminal_sessions').insert({
          device_id: String(sessionMeta.deviceId),
          target_uid: supaId,
          actor_uid: String(sessionMeta.actorUid || supaId),
        });
      } catch {
        // Non-fatal if audit row cannot be recorded
      }
    }

    return JSON.stringify({
      access_token: otpData.session.access_token,
      refresh_token: otpData.session.refresh_token,
    });
  }

  async generatePasswordResetLink(email: string, actionCodeSettings?: { url?: string; handleCodeInApp?: boolean }) {
    const { data, error } = await this.client.auth.admin.generateLink({
      type: 'recovery',
      email: email.trim().toLowerCase(),
      options: {
        redirectTo: actionCodeSettings?.url,
      },
    });
    if (error || !data?.properties) {
      throw new Error(error?.message || 'Could not generate password reset link.');
    }
    const tokenHash = data.properties.hashed_token || '';
    const baseUrl = actionCodeSettings?.url || 'https://urbanautoexpress.com/auth/reset-password';
    const url = new URL(baseUrl);
    url.searchParams.set('oobCode', tokenHash);
    return url.toString();
  }
}

// =============================================================================
// SINGLETON EXPORTS & COMPATIBILITY HELPERS
// =============================================================================

let adminDbInstance: AdminDatabase | null = null;
let adminAuthInstance: AdminAuth | null = null;

export function getAdminApp() {
  return { name: 'supabase-admin', client: getSupabaseServiceRoleClient() };
}

export function getDbAdmin(): AdminDatabase {
  if (!adminDbInstance) {
    adminDbInstance = new AdminDatabase(getSupabaseServiceRoleClient());
  }
  return adminDbInstance;
}

export function getAuthAdmin(): AdminAuth {
  if (!adminAuthInstance) {
    adminAuthInstance = new AdminAuth(getSupabaseServiceRoleClient());
  }
  return adminAuthInstance;
}

export const apps = [{ name: 'supabase-admin' }];

export function initializeApp(_options?: any) {
  return getAdminApp();
}

export const credential = {
  cert: (c: any) => c,
  applicationDefault: () => ({}),
};

export function auth(_app?: any): AdminAuth {
  return getAuthAdmin();
}

export function firestore(_app?: any): AdminDatabase {
  return getDbAdmin();
}

export namespace firestore {
  export type Firestore = AdminDatabase;
  export type Query = AdminQuery;
  export type DocumentReference = AdminDocumentReference;
  export type DocumentData = Record<string, any>;
  export type QueryDocumentSnapshot = AdminQueryDocumentSnapshot;
  export const FieldValue = {
    serverTimestamp,
    increment,
    arrayUnion,
    delete: deleteField,
  };
  export const FieldPath = {
    documentId: () => 'id',
  };
}

export namespace app {
  export type App = ReturnType<typeof getAdminApp>;
}

export namespace auth {
  export type Auth = AdminAuth;
}
