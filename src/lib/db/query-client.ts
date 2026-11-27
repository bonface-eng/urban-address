/**
 * src/lib/db/query-client.ts
 *
 * Client & shared Supabase data-access primitives.
 * Translates document/collection queries, filters, ordering, limits, batches,
 * atomic field operations (increment, arrayUnion, deleteField), and realtime
 * subscriptions (onSnapshot -> Supabase postgres_changes) to PostgreSQL.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  resolveTablePath,
  toSnakeColumn,
  rowToDocument,
  documentToRow,
  type ResolvedTablePath,
} from './table-map';

export type DocumentData = Record<string, any>;

/** Data handle passed to collection()/doc(): the Supabase client. */
export type Firestore = SupabaseClient;

export interface FirestoreError extends Error {
  code: string;
}

// =============================================================================
// FIELD VALUE SENTINELS (increment, arrayUnion, deleteField, serverTimestamp)
// =============================================================================

export interface FieldOperation {
  __op: 'increment' | 'arrayUnion' | 'deleteField' | 'serverTimestamp';
  value?: any;
}

export function isFieldOperation(val: unknown): val is FieldOperation {
  return Boolean(val && typeof val === 'object' && '__op' in (val as any));
}

export function increment(n: number): FieldOperation {
  return { __op: 'increment', value: n };
}

export function arrayUnion(...elements: any[]): FieldOperation {
  return { __op: 'arrayUnion', value: elements };
}

export function deleteField(): FieldOperation {
  return { __op: 'deleteField' };
}

export function serverTimestamp(): FieldOperation {
  return { __op: 'serverTimestamp' };
}

export function resolveFieldOperations(
  currentDoc: Record<string, any> | null,
  patch: Record<string, any>
): Record<string, any> {
  const resolved: Record<string, any> = {};
  for (const [key, val] of Object.entries(patch)) {
    if (isFieldOperation(val)) {
      if (val.__op === 'increment') {
        const currentVal = Number(currentDoc?.[key] ?? 0);
        resolved[key] = (Number.isFinite(currentVal) ? currentVal : 0) + Number(val.value || 0);
      } else if (val.__op === 'arrayUnion') {
        const currentArr = Array.isArray(currentDoc?.[key]) ? [...currentDoc![key]] : [];
        for (const item of val.value || []) {
          if (!currentArr.includes(item)) currentArr.push(item);
        }
        resolved[key] = currentArr;
      } else if (val.__op === 'deleteField') {
        resolved[key] = null;
      } else if (val.__op === 'serverTimestamp') {
        resolved[key] = Date.now();
      }
    } else {
      resolved[key] = val;
    }
  }
  return resolved;
}

// =============================================================================
// REFERENCES & QUERY CONSTRAINTS
// =============================================================================

export interface CollectionReference<T = DocumentData> {
  readonly type: 'collection';
  readonly id: string;
  readonly path: string;
  readonly segments: string[];
  readonly isCollectionGroup?: boolean;
  readonly client?: SupabaseClient;
  readonly _query: { path: { segments: string[] } };
}

export interface DocumentReference<T = DocumentData> {
  readonly type: 'document';
  readonly id: string;
  readonly path: string;
  readonly segments: string[];
  readonly client?: SupabaseClient;
}

export type WhereFilterOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains' | 'array-contains-any';

export interface QueryConstraint {
  readonly type: 'where' | 'orderBy' | 'limit' | 'startAfter';
  readonly field?: string;
  readonly op?: WhereFilterOp;
  readonly value?: any;
  readonly direction?: 'asc' | 'desc';
  readonly count?: number;
  readonly values?: any[];
}

export interface Query<T = DocumentData> {
  readonly type: 'query' | 'collection';
  readonly path: string;
  readonly segments: string[];
  readonly isCollectionGroup?: boolean;
  readonly constraints: QueryConstraint[];
  readonly client?: SupabaseClient;
  readonly _query: { path: { segments: string[] } };
}

function getClient(source?: any): SupabaseClient {
  if (source && typeof source.from === 'function') return source as SupabaseClient;
  if (source?.client && typeof source.client.from === 'function') return source.client as SupabaseClient;
  return getSupabaseBrowserClient();
}

export function collection(
  dbOrRef: any,
  path: string,
  ...pathSegments: string[]
): CollectionReference {
  const baseSegments = Array.isArray(dbOrRef?.segments) ? dbOrRef.segments : [];
  const allSegments = [...baseSegments, path, ...pathSegments]
    .join('/')
    .split('/')
    .filter(Boolean);
  const fullPath = allSegments.join('/');
  return {
    type: 'collection',
    id: allSegments[allSegments.length - 1] || '',
    path: fullPath,
    segments: allSegments,
    client: getClient(dbOrRef),
    _query: { path: { segments: allSegments } },
  };
}

export function collectionGroup(db: any, collectionId: string): CollectionReference {
  return {
    type: 'collection',
    id: collectionId,
    path: collectionId,
    segments: [collectionId],
    isCollectionGroup: true,
    client: getClient(db),
    _query: { path: { segments: [collectionId] } },
  };
}

export function doc(
  dbOrCol: any,
  path?: string,
  ...pathSegments: string[]
): DocumentReference {
  if (dbOrCol?.type === 'collection' && !path) {
    const autoId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const segments = [...dbOrCol.segments, autoId];
    return {
      type: 'document',
      id: autoId,
      path: segments.join('/'),
      segments,
      client: getClient(dbOrCol),
    };
  }
  const baseSegments = Array.isArray(dbOrCol?.segments) ? dbOrCol.segments : [];
  const allSegments = [...baseSegments, ...(path ? [path] : []), ...pathSegments]
    .join('/')
    .split('/')
    .filter(Boolean);
  const id = allSegments[allSegments.length - 1] || '';
  return {
    type: 'document',
    id,
    path: allSegments.join('/'),
    segments: allSegments,
    client: getClient(dbOrCol),
  };
}

export function where(field: string, op: WhereFilterOp, value: any): QueryConstraint {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): QueryConstraint {
  return { type: 'orderBy', field, direction };
}

export function limit(count: number): QueryConstraint {
  return { type: 'limit', count };
}

export function query<T = DocumentData>(
  base: CollectionReference<T> | Query<T>,
  ...constraints: QueryConstraint[]
): Query<T> {
  const existing = 'constraints' in base && Array.isArray(base.constraints) ? base.constraints : [];
  return {
    type: 'query',
    path: base.path,
    segments: base.segments,
    isCollectionGroup: base.isCollectionGroup,
    constraints: [...existing, ...constraints.filter(Boolean)],
    client: base.client,
    _query: { path: { segments: base.segments } },
  };
}

// =============================================================================
// SNAPSHOT CLASSES
// =============================================================================

export class DocumentSnapshot<T = DocumentData> {
  readonly id: string;
  readonly ref: DocumentReference<T>;
  private readonly _data: T | null;

  constructor(ref: DocumentReference<T>, data: T | null) {
    this.id = ref.id;
    this.ref = ref;
    this._data = data;
  }

  exists(): this is QueryDocumentSnapshot<T> {
    return this._data !== null && this._data !== undefined;
  }

  data(): T | undefined {
    return this._data ?? undefined;
  }

  get(field: string): any {
    return this._data ? (this._data as any)[field] : undefined;
  }
}

export class QueryDocumentSnapshot<T = DocumentData> extends DocumentSnapshot<T> {
  override exists(): this is QueryDocumentSnapshot<T> {
    return true;
  }
  override data(): T {
    return super.data() as T;
  }
}

export class QuerySnapshot<T = DocumentData> {
  readonly docs: QueryDocumentSnapshot<T>[];
  readonly size: number;
  readonly empty: boolean;

  constructor(docs: QueryDocumentSnapshot<T>[]) {
    this.docs = docs;
    this.size = docs.length;
    this.empty = docs.length === 0;
  }

  forEach(callback: (doc: QueryDocumentSnapshot<T>) => void): void {
    this.docs.forEach(callback);
  }

  docChanges(): Array<{ type: 'added' | 'modified' | 'removed'; doc: QueryDocumentSnapshot<T> }> {
    return this.docs.map(d => ({ type: 'modified' as const, doc: d }));
  }
}

// =============================================================================
// SUPABASE QUERY EXECUTION
// =============================================================================

export async function executeQuery<T = DocumentData>(
  q: CollectionReference<T> | Query<T>
): Promise<QuerySnapshot<T>> {
  const client = getClient(q);
  const resolved = resolveTablePath(q.segments, q.isCollectionGroup);
  const constraints = 'constraints' in q && Array.isArray(q.constraints) ? q.constraints : [];

  let builder: any = client.from(resolved.table).select('*');

  for (const [col, val] of Object.entries(resolved.parentFilters)) {
    builder = builder.eq(col, val);
  }

  for (const c of constraints) {
    if (c.type === 'where' && c.field) {
      const col = toSnakeColumn(resolved.table, c.field);
      switch (c.op) {
        case '==':
          builder = c.value === null ? builder.is(col, null) : builder.eq(col, c.value);
          break;
        case '!=':
          builder = c.value === null ? builder.not(col, 'is', null) : builder.neq(col, c.value);
          break;
        case '<':
          builder = builder.lt(col, c.value);
          break;
        case '<=':
          builder = builder.lte(col, c.value);
          break;
        case '>':
          builder = builder.gt(col, c.value);
          break;
        case '>=':
          builder = builder.gte(col, c.value);
          break;
        case 'in':
          builder = builder.in(col, Array.isArray(c.value) ? c.value : [c.value]);
          break;
        case 'array-contains':
          builder = builder.contains(col, [c.value]);
          break;
        case 'array-contains-any':
          builder = builder.overlaps(col, Array.isArray(c.value) ? c.value : [c.value]);
          break;
      }
    } else if (c.type === 'orderBy' && c.field) {
      const col = toSnakeColumn(resolved.table, c.field);
      builder = builder.order(col, { ascending: c.direction !== 'desc' });
    } else if (c.type === 'limit' && typeof c.count === 'number') {
      builder = builder.limit(c.count);
    }
  }

  const { data, error } = await builder;
  if (error) {
    const err = new Error(error.message) as FirestoreError;
    err.code = error.code === '42501' || error.message?.toLowerCase().includes('policy')
      ? 'permission-denied'
      : error.code || 'unknown';
    throw err;
  }

  const rows = Array.isArray(data) ? data : [];
  const docs = rows.map(row => {
    const converted = rowToDocument<T>(resolved, row)!;
    const docId = String((converted as any).id || row[resolved.pkColumn] || row.id);
    const dRef = doc({ client, segments: q.segments }, docId) as DocumentReference<T>;
    return new QueryDocumentSnapshot<T>(dRef, converted);
  });

  return new QuerySnapshot<T>(docs);
}

export async function getDocs<T = DocumentData>(
  q: CollectionReference<T> | Query<T>
): Promise<QuerySnapshot<T>> {
  return executeQuery<T>(q);
}

export async function getDoc<T = DocumentData>(
  docRef: DocumentReference<T>
): Promise<DocumentSnapshot<T>> {
  const client = getClient(docRef);
  const resolved = resolveTablePath(docRef.segments);
  const lookupId = resolved.pkColumn === 'email' ? (resolved.docId || docRef.id).toLowerCase() : (resolved.docId || docRef.id);

  let builder: any = client.from(resolved.table).select('*').eq(resolved.pkColumn, lookupId);
  for (const [col, val] of Object.entries(resolved.parentFilters)) {
    builder = builder.eq(col, val);
  }

  const { data, error } = await builder.maybeSingle();
  if (error) {
    const err = new Error(error.message) as FirestoreError;
    err.code = error.code === '42501' ? 'permission-denied' : error.code || 'unknown';
    throw err;
  }

  const converted = data ? rowToDocument<T>(resolved, data) : null;
  return new DocumentSnapshot<T>(docRef, converted);
}

export async function setDoc<T = DocumentData>(
  docRef: DocumentReference<T>,
  data: Partial<T>,
  options?: { merge?: boolean }
): Promise<void> {
  const client = getClient(docRef);
  const resolved = resolveTablePath(docRef.segments);

  let currentDoc: Record<string, any> | null = null;
  const hasFieldOp = Object.values(data as Record<string, any>).some(isFieldOperation);
  if (options?.merge || hasFieldOp || resolved.isJsonEnvelope) {
    const snap = await getDoc(docRef).catch(() => null);
    if (snap && snap.exists()) currentDoc = snap.data() as Record<string, any>;
  }

  const processedPatch = resolveFieldOperations(currentDoc, data as Record<string, any>);
  const finalPayload = options?.merge && currentDoc
    ? { ...currentDoc, ...processedPatch }
    : processedPatch;

  const row = documentToRow(resolved, finalPayload, resolved.docId || docRef.id);
  const { error } = await client
    .from(resolved.table)
    .upsert(row, { onConflict: resolved.pkColumn });

  if (error) {
    const err = new Error(error.message) as FirestoreError;
    err.code = error.code === '42501' ? 'permission-denied' : error.code || 'unknown';
    throw err;
  }
}

export async function addDoc<T = DocumentData>(
  colRef: CollectionReference<T>,
  data: T
): Promise<DocumentReference<T>> {
  const newDocRef = doc(colRef) as DocumentReference<T>;
  await setDoc(newDocRef, data);
  return newDocRef;
}

export async function updateDoc<T = DocumentData>(
  docRef: DocumentReference<T>,
  data: Record<string, any>
): Promise<void> {
  const client = getClient(docRef);
  const resolved = resolveTablePath(docRef.segments);
  const lookupId = resolved.pkColumn === 'email' ? (resolved.docId || docRef.id).toLowerCase() : (resolved.docId || docRef.id);

  const hasFieldOp = Object.values(data).some(isFieldOperation);
  if (hasFieldOp || resolved.isJsonEnvelope) {
    await setDoc(docRef, data as any, { merge: true });
    return;
  }

  const row = documentToRow(resolved, data);
  delete row[resolved.pkColumn];
  delete row.firebase_id;

  let builder: any = client.from(resolved.table).update(row).eq(resolved.pkColumn, lookupId);
  for (const [col, val] of Object.entries(resolved.parentFilters)) {
    builder = builder.eq(col, val);
  }

  const { error } = await builder;
  if (error) {
    const err = new Error(error.message) as FirestoreError;
    err.code = error.code === '42501' ? 'permission-denied' : error.code || 'unknown';
    throw err;
  }
}

export async function deleteDoc(docRef: DocumentReference<any>): Promise<void> {
  const client = getClient(docRef);
  const resolved = resolveTablePath(docRef.segments);
  const lookupId = resolved.pkColumn === 'email' ? (resolved.docId || docRef.id).toLowerCase() : (resolved.docId || docRef.id);

  let builder: any = client.from(resolved.table).delete().eq(resolved.pkColumn, lookupId);
  for (const [col, val] of Object.entries(resolved.parentFilters)) {
    builder = builder.eq(col, val);
  }

  const { error } = await builder;
  if (error) {
    const err = new Error(error.message) as FirestoreError;
    err.code = error.code === '42501' ? 'permission-denied' : error.code || 'unknown';
    throw err;
  }
}

// =============================================================================
// WRITE BATCH
// =============================================================================

export class WriteBatch {
  private operations: Array<() => Promise<void>> = [];

  set(docRef: DocumentReference<any>, data: any, options?: { merge?: boolean }) {
    this.operations.push(() => setDoc(docRef, data, options));
    return this;
  }

  update(docRef: DocumentReference<any>, data: Record<string, any>) {
    this.operations.push(() => updateDoc(docRef, data));
    return this;
  }

  delete(docRef: DocumentReference<any>) {
    this.operations.push(() => deleteDoc(docRef));
    return this;
  }

  async commit(): Promise<void> {
    for (const op of this.operations) {
      await op();
    }
  }
}

export function writeBatch(_db?: any): WriteBatch {
  return new WriteBatch();
}

// =============================================================================
// REALTIME SUBSCRIPTIONS (onSnapshot -> Supabase Realtime postgres_changes)
// =============================================================================

let channelCounter = 0;

export function onSnapshot<T = DocumentData>(
  target: DocumentReference<T>,
  onNext: (snapshot: DocumentSnapshot<T>) => void,
  onError?: (error: FirestoreError) => void
): () => void;
export function onSnapshot<T = DocumentData>(
  target: CollectionReference<T> | Query<T>,
  onNext: (snapshot: QuerySnapshot<T>) => void,
  onError?: (error: FirestoreError) => void
): () => void;
export function onSnapshot<T = DocumentData>(
  target: any,
  onNext: (snapshot: any) => void,
  onError?: (error: FirestoreError) => void
): () => void {
  let active = true;
  const client = getClient(target);
  const resolved = resolveTablePath(target.segments, (target as any).isCollectionGroup);

  const fetchAndEmit = async () => {
    if (!active) return;
    try {
      if (target.type === 'document') {
        const snap = await getDoc(target as DocumentReference<T>);
        if (active) onNext(snap);
      } else {
        const snap = await executeQuery(target as CollectionReference<T> | Query<T>);
        if (active) onNext(snap);
      }
    } catch (err: any) {
      if (active && onError) {
        onError(err);
      }
    }
  };

  void fetchAndEmit();

  // Subscribe to Supabase Realtime postgres_changes for the underlying table
  let channel: any = null;
  try {
    if (typeof client?.channel === 'function') {
      channelCounter += 1;
      const channelName = `realtime_${resolved.table}_${channelCounter}_${Date.now()}`;
      channel = client
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: resolved.table },
          () => {
            if (active) void fetchAndEmit();
          }
        )
        .subscribe((status: string, err?: Error) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[REALTIME] subscription problem on ' + resolved.table + ': ' + status, err?.message || '');
          }
        });
    }
  } catch {
    // Realtime channel creation is best-effort in offline/test environments
  }

  return () => {
    active = false;
    if (channel && typeof client?.removeChannel === 'function') {
      try {
        void client.removeChannel(channel);
      } catch {
        // ignore cleanup warnings
      }
    }
  };
}
