import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './page';

const mocks = vi.hoisted(() => ({
  enabled: vi.fn(), verify: vi.fn(), token: vi.fn(), email: vi.fn(), google: vi.fn(), toast: vi.fn(),
  read: vi.fn(), write: vi.fn(), update: vi.fn(), create: vi.fn(), redirect: vi.fn(),
}));
vi.mock('@/lib/login-security', () => ({ isLoginRecaptchaEnabled: mocks.enabled, verifyLoginRecaptcha: mocks.verify }));
vi.mock('@/lib/recaptcha-client', () => ({ getRecaptchaToken: mocks.token }));
vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.redirect }) }));
vi.mock('next/image', () => ({ default: () => <span /> }));
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: mocks.email,
  signInWithPopup: mocks.google,
  GoogleAuthProvider: class { setCustomParameters() {} },
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})), collection: vi.fn(() => ({})), getDoc: mocks.read,
  addDoc: mocks.write, setDoc: mocks.create, updateDoc: mocks.update,
}));
const submitEmail = () => {
  fireEvent.change(screen.getByPlaceholderText('Email address'), { target: { value: 'user@example.com' } });
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'test-password' } });
  fireEvent.submit(screen.getByPlaceholderText('Password').closest('form')!);
};

describe('login security gate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.enabled.mockResolvedValue(true);
    mocks.token.mockResolvedValue('fresh-token');
    mocks.verify.mockResolvedValue({ success: true, code: 'VERIFIED' });
    mocks.email.mockResolvedValue({ user: { uid: 'user-id' } });
    mocks.read.mockResolvedValue({ exists: () => true, data: () => ({ uid: 'user-id', role: 'CLIENT', displayName: 'User' }) });
    mocks.write.mockResolvedValue({});
  });
  afterEach(cleanup);
  it.each(['email', 'google'])('does not authenticate %s when CAPTCHA fails', async method => {
    mocks.verify.mockResolvedValue({ success: false, code: 'INVALID_TOKEN', message: 'Please retry' });
    render(<LoginPage />);
    if (method === 'email') submitEmail();
    else fireEvent.click(screen.getByRole('button', { name: /Continue with Google/i }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.google).not.toHaveBeenCalled();
    expect(mocks.verify).toHaveBeenCalledTimes(1);
  });
  it('authenticates after verification without copying the password into Firestore', async () => {
    render(<LoginPage />); submitEmail();
    await waitFor(() => expect(mocks.redirect).toHaveBeenCalledWith('/'));
    expect(mocks.verify).toHaveBeenCalledWith('fresh-token');
    expect(mocks.email).toHaveBeenCalledWith(expect.anything(), 'user@example.com', 'test-password');
    expect(mocks.update).not.toHaveBeenCalled();
    expect(JSON.stringify([...mocks.write.mock.calls, ...mocks.create.mock.calls])).not.toMatch(/masterKey|test-password/);
  });
  it('skips token generation only when server config disables login CAPTCHA', async () => {
    mocks.enabled.mockResolvedValue(false);
    render(<LoginPage />); submitEmail();
    await waitFor(() => expect(mocks.email).toHaveBeenCalledTimes(1));
    expect(mocks.token).not.toHaveBeenCalled();
    expect(mocks.verify).toHaveBeenCalledWith(null);
  });
  it('still rejects incorrect credentials when CAPTCHA is off', async () => {
    mocks.enabled.mockResolvedValue(false);
    mocks.email.mockRejectedValue(new Error('invalid credentials'));
    render(<LoginPage />); submitEmail();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Login Failed' })));
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it('does not call an audit permission failure a wrong password', async () => {
    mocks.write.mockRejectedValue({ code: 'permission-denied' });
    render(<LoginPage />); submitEmail();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringContaining('LOGIN_AUDIT_DENIED'),
    }));
    expect(mocks.email).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it('explains profile permission failure after successful authentication', async () => {
    mocks.read.mockRejectedValue({ code: 'permission-denied' });
    render(<LoginPage />); submitEmail();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringContaining('LOGIN_PROFILE_DENIED'),
    }));
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('explains a missing profile instead of silently doing nothing', async () => {
    mocks.read.mockResolvedValue({ exists: () => false });
    render(<LoginPage />); submitEmail();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringContaining('LOGIN_PROFILE_MISSING'),
    })));
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([
    ['auth/invalid-credential', 'LOGIN_AUTH_REJECTED'],
    ['auth/network-request-failed', 'LOGIN_AUTH_NETWORK'],
    ['auth/too-many-requests', 'LOGIN_AUTH_RATE_LIMIT'],
    ['auth/unauthorized-domain', 'LOGIN_AUTH_CONFIGURATION'],
  ])('distinguishes authentication error %s', async (code, ref) => {
    mocks.email.mockRejectedValue({ code, message: 'private backend details' });
    render(<LoginPage />); submitEmail();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining(ref) })));
    expect(mocks.read).not.toHaveBeenCalled();
    expect(JSON.stringify(mocks.toast.mock.calls)).not.toContain('private backend details');
  });
  it('reports Google profile failures without calling them Google authentication failures', async () => {
    mocks.google.mockResolvedValue({ user: { uid: 'staff-id' } });
    mocks.read.mockRejectedValue({ code: 'permission-denied' });
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: /Continue with Google/i }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('LOGIN_PROFILE_DENIED') })));
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it('keeps audit failure blocking staff navigation rather than bypassing permissions', async () => {
    mocks.read.mockResolvedValue({ exists: () => true, data: () => ({ uid: 'staff-id', role: 'CASHIER' }) });
    mocks.write.mockRejectedValue({ code: 'permission-denied' });
    render(<LoginPage />); submitEmail();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('LOGIN_AUDIT_DENIED') })));
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it('navigates staff after authentication, profile access and audit all succeed', async () => {
    mocks.read.mockResolvedValue({ exists: () => true, data: () => ({ uid: 'staff-id', role: 'CASHIER', displayName: 'Staff' }) });
    render(<LoginPage />); submitEmail();
    await waitFor(() => expect(mocks.redirect).toHaveBeenCalledWith('/dashboard'));
    expect(mocks.write).toHaveBeenCalledTimes(1);
  });
  it('distinguishes security service failures from password failures', async () => {
    mocks.enabled.mockRejectedValue(new Error('service failed'));
    render(<LoginPage />); submitEmail();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('LOGIN_SECURITY_UNAVAILABLE') })));
    expect(mocks.email).not.toHaveBeenCalled();
  });

});
