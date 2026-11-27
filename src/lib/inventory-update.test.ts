import { beforeEach, describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { updateInventory } from './inventory-update';
let records: Map<string, any>;
let db: Firestore;
let auditFails: boolean;
const actor = { uid: 'operator', email: 'staff@example.com', email_verified: true };
const edit = (changes: any, extra = {}) => updateInventory(db, actor, { id: 'oil', action: 'edit', expectedStock: 10, changes, ...extra });
beforeEach(() => {
  records = new Map([['users/operator', { role: 'CASHIER' }], ['inventory/oil', { name: 'Oil', unit: 'LOUNGE', stockLevel: 10 }]]); auditFails = false;
  let queue = Promise.resolve();
  db = {
    collection: (name: string) => ({ doc: (id = 'audit-id') => `${name}/${id}` }),
    runTransaction: (callback: any) => {
      const result = queue.then(async () => {
        const writes: Array<() => void> = [];
        const response = await callback({
          get: async (ref: string) => ({ exists: records.has(ref), get: (key: string) => records.get(ref)?.[key] }),
          update: (ref: string, data: any) => writes.push(() => records.set(ref, { ...records.get(ref), ...data })),
          set: (ref: string, data: any) => { if (auditFails) throw new Error('audit denied'); writes.push(() => records.set(ref, data)); },
        });
        writes.forEach(write => write()); return response;
      });
      queue = result.then(() => {}, () => {}); return result;
    },
  } as unknown as Firestore;
});
describe('authorized transactional inventory updates', () => {
  it('updates existing stock and audit together without overwriting unrelated fields', async () => {
    expect(await edit({ stockLevel: 25, name: ' Oil revised ' })).toEqual({ success: true, stockLevel: 25 });
    expect(records.get('inventory/oil')).toMatchObject({ stockLevel: 25, name: 'Oil revised', unit: 'LOUNGE' });
    expect(records.get('audit_logs/audit-id')).toMatchObject({ userId: 'operator', productId: 'oil', stockBefore: 10, stockAfter: 25 });
  });
  it('rolls stock back when audit cannot be written', async () => {
    auditFails = true; await expect(edit({ stockLevel: 25 })).rejects.toThrow();
    expect(records.get('inventory/oil').stockLevel).toBe(10);
  });
  it('rejects stale stock edits instead of losing intervening sales', async () => {
    await expect(edit({ stockLevel: 25 }, { expectedStock: 8 })).rejects.toMatchObject({ code: 'INVENTORY_STOCK_CONFLICT' });
    expect(records.get('inventory/oil').stockLevel).toBe(10);
  });
  it('serializes +/- adjustments against stored stock, not browser values', async () => {
    await Promise.all([updateInventory(db, actor, { id: 'oil', action: 'adjust', delta: 1 }), updateInventory(db, actor, { id: 'oil', action: 'adjust', delta: 1 })]);
    expect(records.get('inventory/oil').stockLevel).toBe(12);
  });
  it.each(['CLIENT', 'KITCHEN', undefined, 3])('denies role %j', async role => {
    records.set('users/operator', { role });
    await expect(edit({ stockLevel: 25 })).rejects.toMatchObject({ code: 'INVENTORY_WRITE_DENIED' });
  });
  it('denies disabled operator even when profile role is ADMIN', async () => {
    records.set('users/operator', { role: 'ADMIN', disabled: true });
    await expect(edit({ stockLevel: 25 })).rejects.toMatchObject({ code: 'INVENTORY_WRITE_DENIED' });
  });
  it('accepts verified existing root admin but not profile email spoofing', async () => {
    records.set('users/operator', { role: 'CLIENT', email: 'bonfacewana3072@gmail.com' });
    await expect(edit({ stockLevel: 25 })).rejects.toMatchObject({ code: 'INVENTORY_WRITE_DENIED' });
    await updateInventory(db, { ...actor, email: 'bonfacewana3072@gmail.com' }, { id: 'oil', action: 'edit', expectedStock: 10, changes: { stockLevel: 25 } });
    expect(records.get('inventory/oil').stockLevel).toBe(25);
  });
  it.each([{ stockLevel: -1 }, { stockLevel: '25' }, { stockLevel: Infinity }, { role: 'ADMIN' }, { name: '' }, { image: 'javascript:bad' }, { unit: 'WRONG' }])('rejects unsafe field input %j', async changes => {
    await expect(edit(changes)).rejects.toMatchObject({ code: 'INVENTORY_INVALID_UPDATE' });
    expect(records.get('inventory/oil').stockLevel).toBe(10);
  });
  it('does not create a missing item and rejects cross-collection paths', async () => {
    await expect(edit({ stockLevel: 25 }, { id: 'missing' })).rejects.toMatchObject({ code: 'INVENTORY_ITEM_MISSING' });
    await expect(edit({ stockLevel: 25 }, { id: '../users' })).rejects.toMatchObject({ code: 'INVENTORY_INVALID_UPDATE' });
  });
});
