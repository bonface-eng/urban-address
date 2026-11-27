import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInventoryFallback } from './use-inventory-fallback';
const m = vi.hoisted(() => ({ user: { uid: 'staff-a', getIdToken: vi.fn() } as any, fetch: vi.fn() }));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: m.user }) }));
beforeEach(() => { vi.clearAllMocks(); m.user = { uid: 'staff-a', getIdToken: vi.fn().mockResolvedValue('test-token') }; vi.stubGlobal('fetch', m.fetch); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const failure = { code: 'unavailable' };
describe('inventory fallback recovery', () => {
  it('does not call server for healthy direct reads or explicit permission denial', () => {
    const { rerender } = renderHook(({ error }) => useInventoryFallback(error, 0), { initialProps: { error: null as { code: string } | null } });
    rerender({ error: { code: 'permission-denied' } }); expect(m.fetch).not.toHaveBeenCalled();
  });
  it('loads all pages with a Firebase bearer token', async () => {
    m.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ products: [{ id: 'a' }], nextCursor: 'a' }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ products: [{ id: 'b' }], nextCursor: null }) });
    const { result } = renderHook(() => useInventoryFallback(failure, 0));
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'a' }, { id: 'b' }]));
    expect(m.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
    expect(m.fetch.mock.calls[1][0]).toBe('/api/staff-inventory?cursor=a');
  });
  it('reports safe server failure instead of empty success', async () => {
    m.fetch.mockResolvedValue({ ok: false, json: async () => ({ code: 'INVENTORY_SERVER_ACCESS' }) });
    const { result } = renderHook(() => useInventoryFallback(failure, 0));
    await waitFor(() => expect(result.current.error?.code).toBe('INVENTORY_SERVER_ACCESS')); expect(result.current.data).toBeNull();
  });
  it('does not fetch without authentication', () => {
    m.user = null; const { result } = renderHook(() => useInventoryFallback(failure, 0));
    expect(result.current.error?.code).toBe('INVENTORY_AUTH_REQUIRED'); expect(m.fetch).not.toHaveBeenCalled();
  });
  it('clears results on account sign-out', async () => {
    m.fetch.mockResolvedValue({ ok: true, json: async () => ({ products: [{ id: 'a' }], nextCursor: null }) });
    const { result, rerender } = renderHook(() => useInventoryFallback(failure, 0));
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    m.user = null; act(() => rerender()); expect(result.current.data).toBeNull();
  });
  it('a page failure never presents a partial catalogue as complete', async () => {
    m.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ products: [{ id: 'a' }], nextCursor: 'a' }) }).mockResolvedValueOnce({ ok: false, json: async () => ({ code: 'INVENTORY_SERVER_UNAVAILABLE' }) });
    const { result } = renderHook(() => useInventoryFallback(failure, 0));
    await waitFor(() => expect(result.current.error?.code).toBe('INVENTORY_SERVER_UNAVAILABLE')); expect(result.current.data).toBeNull();
  });
});
