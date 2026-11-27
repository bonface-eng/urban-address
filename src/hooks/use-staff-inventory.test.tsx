import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffInventory } from './use-staff-inventory';
const m = vi.hoisted(() => ({ user: { uid: 'staff-a', getIdToken: vi.fn() } as any, fetch: vi.fn() }));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: m.user }) }));
beforeEach(() => { vi.clearAllMocks(); m.user = { uid: 'staff-a', getIdToken: vi.fn().mockResolvedValue('test-token') }; vi.stubGlobal('fetch', m.fetch); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('primary authenticated inventory transport', () => {
  it('starts an authenticated server read immediately without waiting for a failed client query', async () => {
    m.fetch.mockResolvedValue({ ok: true, json: async () => ({ products: [{ id: 'a' }], nextCursor: null }) });
    const { result } = renderHook(() => useStaffInventory(0));
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'a' }]));
    expect(m.user.getIdToken).toHaveBeenCalledWith(true);
    expect(m.fetch).toHaveBeenCalledTimes(1);
  });
  it('loads all pages with a Firebase bearer token', async () => {
    m.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ products: [{ id: 'a' }], nextCursor: 'a' }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ products: [{ id: 'b' }], nextCursor: null }) });
    const { result } = renderHook(() => useStaffInventory(0));
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'a' }, { id: 'b' }]));
    expect(m.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
    expect(m.fetch.mock.calls[1][0]).toBe('/api/staff-inventory?cursor=a');
  });
  it('reports safe server failure instead of empty success', async () => {
    m.fetch.mockResolvedValue({ ok: false, json: async () => ({ code: 'INVENTORY_SERVER_ACCESS' }) });
    const { result } = renderHook(() => useStaffInventory(0));
    await waitFor(() => expect(result.current.error?.code).toBe('INVENTORY_SERVER_ACCESS')); expect(result.current.data).toBeNull();
  });
  it('does not fetch without authentication', () => {
    m.user = null; const { result } = renderHook(() => useStaffInventory(0));
    expect(result.current.error?.code).toBe('INVENTORY_AUTH_REQUIRED'); expect(m.fetch).not.toHaveBeenCalled();
  });
  it('clears results on account sign-out', async () => {
    m.fetch.mockResolvedValue({ ok: true, json: async () => ({ products: [{ id: 'a' }], nextCursor: null }) });
    const { result, rerender } = renderHook(() => useStaffInventory(0));
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    m.user = null; act(() => rerender()); expect(result.current.data).toBeNull();
  });
  it('a page failure never presents a partial catalogue as complete', async () => {
    m.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ products: [{ id: 'a' }], nextCursor: 'a' }) }).mockResolvedValueOnce({ ok: false, json: async () => ({ code: 'INVENTORY_SERVER_UNAVAILABLE' }) });
    const { result } = renderHook(() => useStaffInventory(0));
    await waitFor(() => expect(result.current.error?.code).toBe('INVENTORY_SERVER_UNAVAILABLE')); expect(result.current.data).toBeNull();
  });
  it('keeps server-denied access blocked rather than falling through to public data', async () => {
    m.fetch.mockResolvedValue({ ok: false, json: async () => ({ code: 'INVENTORY_STAFF_REQUIRED' }) });
    const { result } = renderHook(() => useStaffInventory(0));
    await waitFor(() => expect(result.current.error?.code).toBe('INVENTORY_STAFF_REQUIRED'));
    expect(result.current.data).toBeNull();
  });
  it('retry refreshes the query and immediately hides stale records', async () => {
    m.fetch.mockResolvedValue({ ok: true, json: async () => ({ products: [{ id: 'a' }], nextCursor: null }) });
    const { result, rerender } = renderHook(({ retry }) => useStaffInventory(retry), { initialProps: { retry: 0 } });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    m.fetch.mockResolvedValue({ ok: false, json: async () => ({ code: 'INVENTORY_AUTH_REQUIRED' }) });
    rerender({ retry: 1 });
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.error?.code).toBe('INVENTORY_AUTH_REQUIRED'));
  });

});
