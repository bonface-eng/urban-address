/**
 * LIVE integration test for the data-access layer (src/lib/db) against the real
 * Supabase project. Skipped unless RUN_LIVE_DB=1 and credentials are present.
 *
 *   $env:RUN_LIVE_DB=1; npx vitest run src/lib/db/live.integration.test.ts
 *
 * Creates a throwaway MANAGER user + rows and removes them afterwards.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const live =
  process.env.RUN_LIVE_DB === '1' &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY;

const stamp = Date.now();
const email = `uax.e2e.live.${stamp}@mailinator.com`;
const password = `Uax!live-${stamp}Aa`;
const invId = `live-inv-${stamp}`;
const ordId = `live-ord-${stamp}`;

describe.skipIf(!live)('data layer ⇄ live Supabase', () => {
  let adminClient: any;
  let userId = '';
  let db: any;
  let api: typeof import('@/lib/db');

  beforeAll(async () => {
    adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const created = await adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Live Test' } });
    if (created.error) throw created.error;
    userId = created.data.user.id;
    await adminClient.from('profiles').update({ role: 'MANAGER', account_type: 'STAFF' }).eq('id', userId);

    api = await import('@/lib/db');
    db = api.getSupabaseBrowserClient();
    await api.signInWithEmailAndPassword(db, email, password);
  }, 30_000);

  afterAll(async () => {
    await adminClient.from('orders').delete().eq('id', ordId);
    await adminClient.from('inventory').delete().eq('id', invId);
    if (userId) {
      await adminClient.from('profiles').delete().eq('id', userId);
      await adminClient.auth.admin.deleteUser(userId);
    }
  }, 30_000);

  it('maps users/{uid} to the profiles row created by the signup trigger', async () => {
    const snap = await api.getDoc(api.doc(db, 'users', userId));
    expect(snap.exists()).toBe(true);
    expect(snap.data()?.role).toBe('MANAGER');
    expect(snap.data()?.email).toBe(email);
  });

  it('inventory: setDoc → getDoc → updateDoc(increment) → getDocs → deleteDoc', async () => {
    const ref = api.doc(db, 'inventory', invId);
    await api.setDoc(ref, { name: 'Live Item', category: 'LIVE_TEST', price: 10.5, stockLevel: 5, minStock: 1, unit: 'STORE', createdAt: Date.now() });

    const got = await api.getDoc(ref);
    expect(got.exists()).toBe(true);
    expect(got.data()).toMatchObject({ name: 'Live Item', stockLevel: 5, unit: 'STORE' });

    await api.updateDoc(ref, { stockLevel: api.increment(-2) }); // decreases are allowed for managers
    expect((await api.getDoc(ref)).data()?.stockLevel).toBe(3);

    const list = await api.getDocs(api.query(api.collection(db, 'inventory'), api.where('category', '==', 'LIVE_TEST'), api.orderBy('name'), api.limit(5)));
    expect(list.docs.map((d) => d.id)).toContain(invId);

    await api.deleteDoc(ref);
    expect((await api.getDoc(ref)).exists()).toBe(false);
  }, 30_000);

  it('orders: items array round-trips and order_items stay in sync', async () => {
    const ref = api.doc(db, 'orders', ordId);
    await api.setDoc(ref, {
      type: 'STORE', status: 'PENDING', total: 21, cashierId: userId, timestamp: Date.now(),
      items: [{ productId: invId, name: 'Live Item', quantity: 2, price: 10.5 }],
    });
    const got = await api.getDoc(ref);
    expect(got.data()?.items).toHaveLength(1);
    expect(got.data()?.total).toBe(21);

    await api.updateDoc(ref, { status: 'PAID' });
    expect((await api.getDoc(ref)).data()?.status).toBe('PAID');

    const { data } = await adminClient.from('order_items').select('*').eq('order_id', ordId);
    expect((data || []).length).toBeGreaterThanOrEqual(1);

    await api.deleteDoc(ref);
  }, 30_000);

  it('onSnapshot delivers the initial snapshot and a realtime update', async () => {
    const ref = api.doc(db, 'inventory', invId);
    await api.setDoc(ref, { name: 'RT Item', category: 'LIVE_TEST', price: 1, stockLevel: 8, minStock: 1, unit: 'STORE', createdAt: Date.now() });

    const seen: number[] = [];
    const unsubscribe = api.onSnapshot(ref, (s: any) => { if (s.exists()) seen.push(s.data().stockLevel); });
    await new Promise((r) => setTimeout(r, 3000)); // let the channel subscribe
    // Keep nudging the row (decreasing only) until the realtime event arrives; avoids a join-timing flake.
    const deadline = Date.now() + 25_000;
    let level = 7;
    while (!seen.some((v) => v < 8) && Date.now() < deadline) {
      await api.updateDoc(ref, { stockLevel: level-- });
      await new Promise((r) => setTimeout(r, 2000));
    }
    unsubscribe();

    expect(seen[0]).toBe(8);
    expect(seen.some((v) => v < 8)).toBe(true);
  }, 60_000);

  it('rejects client writes to server-only collections', async () => {
    await expect(api.setDoc(api.doc(db, 'admin_daily_otps', 'x'), { codeHash: 'x' })).rejects.toThrow();
  });
});
