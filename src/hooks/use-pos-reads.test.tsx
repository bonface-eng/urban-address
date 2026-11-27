import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePosReads } from './use-pos-reads';
const m = vi.hoisted(() => ({ user: null as any, fetch: vi.fn() }));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: m.user }) }));
beforeEach(() => { vi.clearAllMocks(); m.user = { uid: 'a',getIdToken: vi.fn().mockResolvedValue('token') }; vi.stubGlobal('fetch',m.fetch); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('authenticated scoped POS snapshots', () => {
  it('does not fetch without sign-in or when disabled', () => {
    m.user = null; const { result } = renderHook(() => usePosReads('customers'));
    expect(result.current.error).toBe('POS_AUTH_REQUIRED'); expect(m.fetch).not.toHaveBeenCalled();
    const disabled = renderHook(() => usePosReads('own-tabs','',false)); expect(disabled.result.current.error).toBeNull();
  });
  it('fetches every page with authentication and no target UID', async () => {
    m.fetch.mockResolvedValueOnce({ ok: true,json: async () => ({ records: [{ id: 'one' }], nextCursor: 'one' }) }).mockResolvedValueOnce({ ok: true,json: async () => ({ records: [{ id: 'two' }], nextCursor: null }) });
    const { result } = renderHook(() => usePosReads('own-tabs','LOUNGE'));
    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(m.fetch.mock.calls[0][0]).toBe('/api/pos-reads?resource=own-tabs&unit=LOUNGE');
    expect(m.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer token');
  });
  it('does not turn permission failures into empty success', async () => {
    m.fetch.mockResolvedValue({ ok: false,json: async () => ({ code: 'POS_STAFF_REQUIRED' }) });
    const { result } = renderHook(() => usePosReads('customers'));
    await waitFor(() => expect(result.current.error).toBe('POS_STAFF_REQUIRED')); expect(result.current.data).toBeNull();
  });
  it('never exposes partial results after pagination failure', async () => {
    m.fetch.mockResolvedValueOnce({ ok: true,json: async () => ({ records: [{ id: 'one' }], nextCursor: 'one' }) }).mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => usePosReads('customers'));
    await waitFor(() => expect(result.current.error).toBe('POS_READ_UNAVAILABLE')); expect(result.current.data).toBeNull();
  });
  it('clears records on signout and refreshes on request', async () => {
    m.fetch.mockResolvedValue({ ok: true,json: async () => ({ records: [{ id: 'one' }], nextCursor: null }) });
    const { result,rerender } = renderHook(() => usePosReads('customers'));
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    act(() => result.current.refresh()); expect(result.current.data).toBeNull();
    await waitFor(() => expect(m.fetch).toHaveBeenCalledTimes(2));
    m.user = null; rerender(); expect(result.current.data).toBeNull();
  });
});
