import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
const m = vi.hoisted(() => ({ verify: vi.fn(), update: vi.fn() }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: m.verify }) }));
vi.mock('@/lib/firebase-admin', () => ({ getAdminApp: () => ({}), getDbAdmin: () => ({}) }));
vi.mock('@/lib/inventory-update', async original => ({ ...await original<typeof import('@/lib/inventory-update')>(), updateInventory: m.update }));
const request = (token = 'Bearer test-token') => new NextRequest('http://localhost/api/staff-inventory/update', { method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'edit', id: 'item', expectedStock: 10, changes: { stockLevel: 20 } }) });
beforeEach(() => { vi.clearAllMocks(); m.verify.mockResolvedValue({ uid: 'operator', email: 'staff@example.com', email_verified: true }); m.update.mockResolvedValue({ success: true, stockLevel: 20 }); });
describe('stock update API boundary', () => {
  it('denies anonymous and expired tokens before writes', async () => {
    expect((await POST(request(''))).status).toBe(401);
    m.verify.mockRejectedValue(new Error('expired')); expect((await POST(request())).status).toBe(401);
    expect(m.update).not.toHaveBeenCalled();
  });
  it('uses revocation-checked identity, not browser supplied role', async () => {
    const response = await POST(request()); expect(response.status).toBe(200);
    expect(m.verify).toHaveBeenCalledWith('test-token', true);
    expect(m.update.mock.calls[0][1]).toEqual({ uid: 'operator', email: 'staff@example.com', email_verified: true });
  });
  it('does not claim success on an unconfirmed transaction', async () => {
    m.update.mockRejectedValue(new Error('database details'));
    const response = await POST(request()); expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: 'INVENTORY_UPDATE_UNAVAILABLE', error: expect.stringContaining('Refresh inventory') });
  });
});
