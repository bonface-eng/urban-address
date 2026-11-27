import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { readPosData } from './pos-read-service';
vi.mock('firebase-admin/firestore', () => ({ FieldPath: { documentId: () => '__name__' } }));
const actor = { uid: 'operator-a', email: 'staff@example.com', email_verified: true };
let db: Firestore;
let profile: any;
let registry: boolean;
let docs: any[];
let paths: string[];
let queries: any[];
beforeEach(() => {
  profile = { role: 'CASHIER' }; registry = false; docs = []; paths = []; queries = [];
  const snapshot = (data: any, exists = true, id = 'item') => ({ exists, id, get: (key: string) => data?.[key], data: () => data });
  const ref = (path: string): any => ({
    doc: (id: string) => { const next = path + '/' + id; paths.push(next); return ref(next); },
    collection: (name: string) => { paths.push(path + '/' + name); return ref(path + '/' + name); },
    get: async () => path.startsWith('users/') && !path.includes('held_bills') ? snapshot(profile, !!profile) : path.startsWith('admins/') ? snapshot({},registry) : { docs: docs.map((data,i) => snapshot(data,true,'item-'+i)), size: docs.length },
    where: (...args: any[]) => { queries.push(args); return ref(path); }, orderBy: () => ref(path), limit: () => ref(path), startAfter: () => ref(path),
  });
  db = { collection: (name: string) => { paths.push(name); return ref(name); } } as unknown as Firestore;
});
const run = (query: string, identity = actor) => readPosData(db,identity,new URLSearchParams(query));
describe('scoped POS data authorization', () => {
  it('returns only lookup fields for customers and enforces CLIENT-only query', async () => {
    docs = [{ displayName: 'Member', email: 'member@example.com', phoneNumber: '0700000000', loyaltyPoints: 12, pin: '9999', masterKey: 'secret', mpesaNumber: 'private', role: 'CLIENT' }];
    const result = await run('resource=customers');
    expect(queries).toContainEqual(['role','==','CLIENT']);
    expect(Object.keys(result.records[0]).sort()).toEqual(['displayName','email','loyaltyPoints','phoneNumber','role','uid']);
    expect(JSON.stringify(result)).not.toMatch(/9999|secret|mpesaNumber/);
  });
  it('reads held tabs from authenticated UID, never another operator', async () => {
    docs = [{ type: 'LOUNGE', items: [{ name: 'Drink', quantity: 1, price: 300, secret: 'private' }], masterKey: 'private' }, { type: 'STORE' }];
    const result = await run('resource=own-tabs&unit=LOUNGE');
    expect(paths).toContain('users/operator-a/held_bills');
    expect(result.records).toHaveLength(1); expect(JSON.stringify(result)).not.toContain('private');
    await expect(run('resource=own-tabs&targetUid=operator-b')).rejects.toMatchObject({ code: 'POS_READ_INVALID' });
  });
  it.each(['users','admins','orders','../../users'])('rejects arbitrary resource %s', async name => {
    await expect(run('resource='+encodeURIComponent(name))).rejects.toMatchObject({ code: 'POS_READ_INVALID' });
    expect(paths).toHaveLength(0);
  });
  it.each([{ role: 'CLIENT' }, { role: 'ADMIN', disabled: true }, { role: 'CASHIER', active: false }, null])('rejects nonstaff or inactive identity %j', async data => {
    profile = data; await expect(run('resource=customers')).rejects.toMatchObject({ code: 'POS_STAFF_REQUIRED' });
  });
  it('recognizes verified existing admin but not an email supplied in the profile', async () => {
    profile = { role: 'CLIENT', email: 'bonfacewana3072@gmail.com' };
    await expect(run('resource=customers')).rejects.toMatchObject({ code: 'POS_STAFF_REQUIRED' });
    expect((await run('resource=customers', { ...actor,email: 'bonfacewana3072@gmail.com' })).records).toEqual([]);
    await expect(run('resource=customers', { ...actor,email: 'bonfacewana3072@gmail.com', email_verified: false })).rejects.toMatchObject({ code: 'POS_STAFF_REQUIRED' });
  });
  it('validates department and cursor rather than using arbitrary paths', async () => {
    await expect(run('resource=own-tabs&cursor=bad/path')).rejects.toMatchObject({ code: 'POS_READ_INVALID' });
    await expect(run('resource=own-tabs&unit=ADMIN')).rejects.toMatchObject({ code: 'POS_READ_INVALID' });
  });
});
