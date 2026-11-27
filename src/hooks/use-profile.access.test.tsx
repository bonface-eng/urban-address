import React from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.unmock('@/hooks/use-profile');
import { ProfileProvider, useProfile } from './use-profile';
const m = vi.hoisted(() => ({ user: {} as any, profile: {} as any, registry: null as any, doc: vi.fn() }));
vi.mock('@/firebase', () => ({
  useUser: () => ({ user: m.user, loading: false }), useFirestore: () => 'db',
  useDoc: (ref: any) => ({ data: ref?.path.startsWith('users/') ? m.profile : ref?.path.startsWith('admins/') ? m.registry : null, loading: false }),
}));
vi.mock('firebase/firestore', () => ({ doc: m.doc }));
beforeEach(() => { vi.clearAllMocks(); m.user = { uid: 'a', email: 'bonfacewana3072@gmail.com' }; m.profile = { role: 'CLIENT', uid: 'a' }; m.registry = null; m.doc.mockImplementation((_db, ...parts) => ({ path: parts.join('/') })); });
afterEach(cleanup);
const wrapper = ({ children }: { children: React.ReactNode }) => <ProfileProvider>{children}</ProfileProvider>;
describe('shared profile admin recognition', () => {
  it('does not request the protected registry for an existing root administrator', async () => {
    const { result } = renderHook(useProfile, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isSuperAdmin).toBe(true);
    expect(result.current.role).toBe('ADMIN');
    expect(m.doc.mock.calls.some(call => call[1] === 'admins')).toBe(false);
  });
  it('still looks up registry-admin accounts without granting ordinary clients admin', async () => {
    m.user.email = 'regular@example.com';
    const { result, rerender } = renderHook(useProfile, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isSuperAdmin).toBe(false);
    expect(m.doc).toHaveBeenCalledWith('db', 'admins', 'regular@example.com');
    m.registry = { authorized: true }; rerender(); expect(result.current.isSuperAdmin).toBe(true);
  });
  it('does not request the registry without a signed-in identity', () => {
    m.user = null;
    const { result } = renderHook(useProfile, { wrapper });
    expect(result.current.isSuperAdmin).toBe(false);
    expect(m.doc).not.toHaveBeenCalled();
  });
});
