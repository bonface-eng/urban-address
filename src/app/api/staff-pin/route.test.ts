import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
const mocks = vi.hoisted(() => ({ verify: vi.fn(), operation: vi.fn() }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: mocks.verify }) }));
vi.mock('@/lib/firebase-admin', () => ({ getAdminApp: () => ({}), getDbAdmin: () => ({}) }));
vi.mock('@/lib/staff-pin-service', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/staff-pin-service')>(), staffPinOperation: mocks.operation }));
const request = (body: unknown, auth = 'Bearer test-token') => new NextRequest('http://localhost/api/staff-pin', { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); mocks.verify.mockResolvedValue({ uid: 'staff-a', auth_time: 123, email: 'staff@example.com', email_verified: true }); mocks.operation.mockResolvedValue({ enrolled: false }); });
describe('staff PIN API authentication boundary', () => {
  it('rejects unauthenticated requests before accessing the database', async () => {
    expect((await POST(request({ action: 'status' }, ''))).status).toBe(401);
    expect(mocks.operation).not.toHaveBeenCalled();
  });
  it('rejects revoked or expired Firebase tokens', async () => {
    mocks.verify.mockRejectedValue(new Error('invalid token'));
    expect((await POST(request({ action: 'status' }))).status).toBe(401);
    expect(mocks.operation).not.toHaveBeenCalled();
  });
  it('uses verified identity and revocation checking, never a browser-provided UID', async () => {
    const response = await POST(request({ action: 'status' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.verify).toHaveBeenCalledWith('test-token', true);
    expect(mocks.operation.mock.calls[0][1]).toEqual({ uid: 'staff-a', auth_time: 123, email: 'staff@example.com', email_verified: true });
  });
  it('returns 429 for account attempt cooldown', async () => {
    mocks.operation.mockResolvedValue({ success: false, code: 'PIN_RATE_LIMIT' });
    expect((await POST(request({ action: 'verify', pin: '0000' }))).status).toBe(429);
  });
  it('does not accept administrator identity from the request body', async () => {
    await POST(request({ action: 'status', email: 'bonfacewana3072@gmail.com', email_verified: true }));
    expect(mocks.operation.mock.calls[0][1]).toEqual({ uid: 'staff-a', auth_time: 123, email: 'staff@example.com', email_verified: true });
  });

});
