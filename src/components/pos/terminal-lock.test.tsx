import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TerminalLock } from './terminal-lock';
const mocks = vi.hoisted(() => ({ state: {} as any, enroll: vi.fn(), unlock: vi.fn(), toast: vi.fn() }));
vi.mock('@/hooks/use-terminal', () => ({ useTerminal: () => mocks.state }));
vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: { uid: 'staff-a' } }), useAuth: () => ({ signOut: vi.fn() }) }));
vi.mock('next/image', () => ({ default: () => <span /> }));
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  mocks.enroll.mockResolvedValue(undefined);
  mocks.state = { activeCashier: { uid: 'staff-a', role: 'CASHIER', displayName: 'Staff', email: 'staff@example.com', pin: '9999' }, loading: false, isLocked: true, pinLoading: false, pinEnrolled: false, pinError: '', enrollPin: mocks.enroll, unlockTerminal: mocks.unlock, retryPinStatus: vi.fn(), clearActiveCashier: vi.fn(), locationName: 'Station' };
});
afterEach(cleanup);
const enter = (pin: string) => fireEvent.change(screen.getByPlaceholderText('••••'), { target: { value: pin } });
describe('mandatory post-deployment staff PIN setup', () => {
  it('requires new PIN even with a legacy PIN and cached unlocked state', () => {
    mocks.state.isLocked = false;
    localStorage.setItem('uax_last_unlocked_at', String(Date.now()));
    render(<TerminalLock>Protected content</TerminalLock>);
    expect(screen.getByText('Set your PIN.')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
  it('creates only after matching four-digit confirmation', async () => {
    render(<TerminalLock>Protected content</TerminalLock>);
    enter('0123');
    expect(mocks.enroll).not.toHaveBeenCalled();
    expect(screen.getByText(/Repeat PIN to Confirm/)).toBeInTheDocument();
    enter('0123');
    await waitFor(() => expect(mocks.enroll).toHaveBeenCalledWith('0123', '0123'));
    expect(mocks.unlock).not.toHaveBeenCalled();
  });
  it('rejects mismatch and does not save short PINs', async () => {
    render(<TerminalLock>Protected content</TerminalLock>);
    enter('123'); expect(mocks.enroll).not.toHaveBeenCalled();
    enter('1234'); enter('4321');
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'PIN Mismatch' })));
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it('uses server verification on later terminal locks', async () => {
    mocks.state.pinEnrolled = true; mocks.unlock.mockResolvedValue(true);
    render(<TerminalLock>Protected content</TerminalLock>);
    expect(screen.getByText('Enter your PIN.')).toBeInTheDocument();
    enter('0123');
    await waitFor(() => expect(mocks.unlock).toHaveBeenCalledWith('0123'));
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it('does not reveal protected content when status fails', () => {
    mocks.state.isLocked = false; mocks.state.pinError = 'PIN service unavailable';
    render(<TerminalLock>Protected content</TerminalLock>);
    expect(screen.getByRole('alert')).toHaveTextContent('PIN service unavailable');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
  it('waits for authoritative PIN enrollment status before showing content', () => {
    mocks.state.isLocked = false; mocks.state.pinLoading = true;
    render(<TerminalLock>Protected content</TerminalLock>);
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
  it('does not retain legacy PIN/password fields in recent operators', async () => {
    localStorage.setItem('uax_recent_operators', JSON.stringify([{ ...mocks.state.activeCashier, masterKey: 'legacy-credential' }]));
    render(<TerminalLock>Protected content</TerminalLock>);
    await waitFor(() => expect(localStorage.getItem('uax_recent_operators')).not.toMatch(/masterKey|legacy-credential|9999/));
  });
});
