import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
const m = vi.hoisted(() => ({ verify: vi.fn(), profile: {} as any, registry: false, get: vi.fn(), start: vi.fn(), limit: vi.fn(), collection: vi.fn() }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: m.verify }) }));
vi.mock('firebase-admin/firestore', () => ({ FieldPath: { documentId: () => '__name__' } }));
vi.mock('@/lib/firebase-admin', () => ({ getAdminApp: () => ({}), getDbAdmin: () => ({ collection: m.collection }) }));
const request = (token = 'Bearer test-token', cursor = '') => new NextRequest('http://localhost/api/staff-inventory' + cursor, { headers: { Authorization: token } });
beforeEach(() => {
  vi.clearAllMocks(); m.profile = { role: 'CASHIER' }; m.registry = false;
  m.verify.mockResolvedValue({ uid: 'staff-a', email: 'staff@example.com', email_verified: true });
  m.get.mockResolvedValue({ size: 1, docs: [{ id: 'stock-a', data: () => ({ name: 'Oil', unit: 'store', stockLevel: 20, costPrice: 30, secret: 'private' }) }] });
  const query: any = { orderBy: () => query, limit: m.limit, startAfter: m.start, get: m.get };
  m.limit.mockReturnValue(query); m.start.mockReturnValue(query);
  m.collection.mockImplementation(name => name === 'inventory' ? query : ({ doc: () => ({ get: async () => name === 'users' ? { exists: !!m.profile, get: (key: string) => m.profile?.[key] } : { exists: m.registry } }) }));
});
describe('staff inventory read authorization and pagination', () => {
  it('requires authentication before reading inventory', async () => {
    expect((await GET(request(''))).status).toBe(401); expect(m.get).not.toHaveBeenCalled();
  });
  it('rejects revoked tokens', async () => {
    m.verify.mockRejectedValue(new Error('expired')); expect((await GET(request())).status).toBe(401); expect(m.get).not.toHaveBeenCalled();
  });
  it('returns full authorized stock values but only allowlisted fields', async () => {
    const response = await GET(request()); const body = await response.json();
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(body.products[0]).toMatchObject({ id: 'stock-a', name: 'Oil', unit: 'STORE', stockLevel: 20, costPrice: 30 });
    expect(body.products[0].secret).toBeUndefined(); expect(m.verify).toHaveBeenCalledWith('test-token', true); expect(m.limit).toHaveBeenCalledWith(250);
  });
  it.each([{ role: 'CLIENT' }, null, { role: 'ADMIN', disabled: true }, { role: 'ADMIN', active: false }])('rejects unauthorized/inactive profile %j', async profile => {
    m.profile = profile; expect((await GET(request())).status).toBe(403); expect(m.get).not.toHaveBeenCalled();
  });
  it('recognizes verified root admin and rejects spoofed profile email', async () => {
    m.profile = { role: 'CLIENT', email: 'bonfacewana3072@gmail.com' };
    expect((await GET(request())).status).toBe(403);
    m.verify.mockResolvedValue({ uid: 'staff-a', email: 'bonfacewana3072@gmail.com', email_verified: true });
    expect((await GET(request())).status).toBe(200);
    m.verify.mockResolvedValue({ uid: 'staff-a', email: 'bonfacewana3072@gmail.com', email_verified: false });
    expect((await GET(request())).status).toBe(403);
  });
  it('validates cursor and uses ID pagination', async () => {
    expect((await GET(request('Bearer token', '?cursor=bad/path'))).status).toBe(400);
    await GET(request('Bearer token', '?cursor=stock-a')); expect(m.start).toHaveBeenCalledWith('stock-a');
  });
  it('reports server database errors with a safe diagnostic', async () => {
    m.get.mockRejectedValue({ code: 7, message: 'sensitive backend data' });
    const result = await GET(request()); expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ code: 'INVENTORY_SERVER_ACCESS' });
  });
});
