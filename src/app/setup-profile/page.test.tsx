import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SetupProfilePage from './page';

const mocks = vi.hoisted(() => ({
  profile: {} as any, user: { uid: 'staff-a' }, update: vi.fn(), authUpdate: vi.fn(), audit: vi.fn(), doc: vi.fn(), push: vi.fn(), toast: vi.fn(),
}));
vi.mock('@/hooks/use-profile', () => ({ useProfile: () => ({ profile: mocks.profile, loading: false }) }));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: mocks.user }), useFirestore: () => 'db' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('firebase/firestore', () => ({ doc: mocks.doc, updateDoc: mocks.update, addDoc: mocks.audit, collection: vi.fn() }));
vi.mock('firebase/auth', () => ({ updateProfile: mocks.authUpdate }));
vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }));
vi.mock('@/components/shared/image-upload', () => ({ ImageUpload: () => <span /> }));
vi.mock('@/components/ui/scroll-area', () => ({ ScrollArea: ({ children }: any) => <div>{children}</div>, ScrollBar: () => null }));

beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  mocks.user.uid = 'staff-a';
  mocks.profile = { uid: 'staff-a', role: 'CASHIER', firstName: 'Jane', middleName: 'Mary', lastName: 'Doe', displayName: 'Jane Doe (Mary)', phoneNumber: '0700000000', mpesaNumber: '0700000001', photoURL: 'https://example.com/avatar.png' };
  const allowed = new Set(['displayName', 'phoneNumber', 'mpesaNumber', 'photoURL', 'updatedAt']);
  mocks.update.mockImplementation(async (_ref, payload) => {
    if (Object.keys(payload).some(key => !allowed.has(key))) throw { code: 'permission-denied' };
  });
  mocks.authUpdate.mockResolvedValue(undefined); mocks.audit.mockResolvedValue({});
});
afterEach(cleanup);
const submit = () => fireEvent.submit(screen.getByRole('button', { name: 'FINALIZE PROFILE' }).closest('form')!);

describe('staff profile finalization', () => {
  it('saves only self-editable profile fields so ordinary staff can finalize', async () => {
    render(<SetupProfilePage />); submit();
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard'));
    const payload = mocks.update.mock.calls[0][1];
    expect(Object.keys(payload).sort()).toEqual(['displayName', 'mpesaNumber', 'phoneNumber', 'photoURL', 'updatedAt']);
    expect(payload.displayName).toBe('Jane Doe (Mary)');
    expect(mocks.doc).toHaveBeenCalledWith('db', 'users', 'staff-a');
    expect(mocks.audit).toHaveBeenCalledTimes(1);
  });
  it('shows a profile-save failure without claiming completion', async () => {
    mocks.update.mockRejectedValue({ code: 'permission-denied' });
    render(<SetupProfilePage />); submit();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('PROFILE_SAVE_DENIED') })));
    expect(mocks.authUpdate).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled();
  });
  it('distinguishes an audit denial after the details are saved', async () => {
    mocks.audit.mockRejectedValue({ code: 'permission-denied' });
    render(<SetupProfilePage />); submit();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('PROFILE_AUDIT_DENIED') })));
    expect(mocks.update).toHaveBeenCalledTimes(1); expect(mocks.push).not.toHaveBeenCalled();
  });
  it('never saves another profile even when cached profile identity differs', async () => {
    mocks.profile.uid = 'other-staff';
    render(<SetupProfilePage />); submit();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('preserves combined-name components on subsequent visits', () => {
    delete mocks.profile.firstName; delete mocks.profile.middleName; delete mocks.profile.lastName;
    render(<SetupProfilePage />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs[0]).toHaveValue('Jane'); expect(inputs[1]).toHaveValue('Doe'); expect(inputs[2]).toHaveValue('Mary');
  });
  it('distinguishes authentication display-profile sync failure from Firestore save failure', async () => {
    mocks.authUpdate.mockRejectedValue({ code: 'auth/network-request-failed' });
    render(<SetupProfilePage />); submit();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('PROFILE_AUTH_SYNC_FAILED') })));
    expect(mocks.update).toHaveBeenCalledTimes(1); expect(mocks.push).not.toHaveBeenCalled();
  });
});
