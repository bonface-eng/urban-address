import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TerminalProvider, useTerminal } from './use-terminal';
const mocks = vi.hoisted(() => ({
  user: { uid: 'staff-a', getIdToken: vi.fn() },
  auth: {} as any,
  fetch: vi.fn(),
  profile: {} as any,
}));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: mocks.user }), useAuth: () => mocks.auth, useFirestore: () => 'db' }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(), onSnapshot: (_ref: unknown, callback: any) => { callback({ exists: () => true, id: 'staff-a', data: () => mocks.profile }); return vi.fn(); },
  getDoc: vi.fn(), setDoc: vi.fn(), updateDoc: vi.fn(), collection: vi.fn(), query: vi.fn(), where: vi.fn(), addDoc: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  mocks.profile = { role: 'CASHIER', pin: '9999' };
  mocks.user.getIdToken.mockResolvedValue('session-token'); mocks.auth.currentUser = mocks.user;
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.fetch.mockImplementation(async (url, options) => {
    if (url !== '/api/staff-pin') return { json: async () => ({ ip: '0.0.0.0' }) };
    const body = JSON.parse(options.body);
    return { ok: true, json: async () => body.action === 'status' ? { enrolled: false } : { success: true, enrolled: true } };
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const wrapper = ({ children }: { children: React.ReactNode }) => <TerminalProvider>{children}</TerminalProvider>;
describe('terminal PIN provider server integration', () => {
  it('ignores the old cached unlock timestamp and legacy PIN', async () => {
    localStorage.setItem('uax_last_unlocked_at', String(Date.now()));
    const { result } = renderHook(useTerminal, { wrapper });
    await waitFor(() => expect(result.current.pinLoading).toBe(false));
    expect(result.current.isLocked).toBe(true);
    expect(result.current.pinEnrolled).toBe(false);
    expect(await result.current.unlockTerminal('9999')).toBe(false);
  });
  it('enrolls and verifies via authenticated server requests, never profile writes', async () => {
    const { result } = renderHook(useTerminal, { wrapper });
    await waitFor(() => expect(result.current.pinLoading).toBe(false));
    await act(async () => result.current.enrollPin('0123', '0123'));
    expect(result.current.pinEnrolled).toBe(true); expect(result.current.isLocked).toBe(false);
    act(() => result.current.lockTerminal());
    await act(async () => { expect(await result.current.unlockTerminal('0123')).toBe(true); });
    const calls = mocks.fetch.mock.calls.filter(([url]) => url === '/api/staff-pin');
    expect(calls.map(([, options]) => JSON.parse(options.body).action)).toEqual(['status', 'enroll', 'verify']);
    for (const [, options] of calls) expect(options.headers.Authorization).toBe('Bearer session-token');
  });
  it('does not unlock on backend failure', async () => {
    mocks.fetch.mockImplementation(async url => url === '/api/staff-pin' ? { ok: false, json: async () => ({ error: 'PIN service unavailable' }) } : { json: async () => ({}) });
    const { result } = renderHook(useTerminal, { wrapper });
    await waitFor(() => expect(result.current.pinError).toBe('PIN service unavailable'));
    expect(result.current.isLocked).toBe(true); expect(result.current.pinEnrolled).toBe(false);
  });
});
