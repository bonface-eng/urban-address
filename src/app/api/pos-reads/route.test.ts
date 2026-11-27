import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
const m = vi.hoisted(() => ({ verify: vi.fn(), read: vi.fn() }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: m.verify }) }));
vi.mock('@/lib/firebase-admin', () => ({ getAdminApp: () => ({}), getDbAdmin: () => ({}) }));
vi.mock('@/lib/pos-read-service', async original => ({ ...await original<typeof import('@/lib/pos-read-service')>(), readPosData: m.read }));
const request = (auth = 'Bearer token') => new NextRequest('http://localhost/api/pos-reads?resource=customers',{ headers: { Authorization: auth } });
beforeEach(() => { vi.clearAllMocks(); m.verify.mockResolvedValue({ uid: 'a', email: 'a@example.com', email_verified: true }); m.read.mockResolvedValue({ records: [], nextCursor: null }); });
describe('POS read endpoint boundary', () => {
  it('rejects missing and revoked tokens before reads', async () => {
    expect((await GET(request(''))).status).toBe(401);
    m.verify.mockRejectedValue(new Error('revoked')); expect((await GET(request())).status).toBe(401); expect(m.read).not.toHaveBeenCalled();
  });
  it('uses verified Firebase identity and no-store response', async () => {
    const response = await GET(request()); expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(m.verify).toHaveBeenCalledWith('token',true);
    expect(m.read.mock.calls[0][1]).toEqual({ uid: 'a', email: 'a@example.com', email_verified: true });
  });
});
