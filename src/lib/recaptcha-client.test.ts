import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRecaptchaToken } from './recaptcha-client';

const setClient = (enterprise: unknown) => Object.assign(window, { grecaptcha: { enterprise } });
const mockClient = (execute = vi.fn().mockResolvedValue('fresh-token')) => ({ ready: (callback: () => void) => callback(), execute });

describe('Enterprise token generation', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.stubEnv('NEXT_PUBLIC_RECAPTCHA_SITE_KEY', 'test-site-key'); setClient(undefined); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); delete (window as any).grecaptcha; });
  it('generates fresh LOGIN tokens at each submit', async () => {
    const client = mockClient(vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second'));
    setClient(client);
    expect(await getRecaptchaToken('LOGIN')).toBe('first');
    expect(await getRecaptchaToken('LOGIN')).toBe('second');
    expect(client.execute).toHaveBeenCalledWith('test-site-key', { action: 'LOGIN' });
  });
  it('waits for a slowly loaded Enterprise script', async () => {
    const token = getRecaptchaToken('SIGNUP');
    setTimeout(() => setClient(mockClient()), 500);
    await vi.advanceTimersByTimeAsync(750);
    expect(await token).toBe('fresh-token');
  });
  it('returns failure when the script stays blocked', async () => {
    const token = getRecaptchaToken('LOGIN');
    await vi.advanceTimersByTimeAsync(5000);
    expect(await token).toBeNull();
  });
  it('times out if ready never runs', async () => {
    setClient({ ready: () => {}, execute: vi.fn() });
    const token = getRecaptchaToken('LOGIN');
    await vi.advanceTimersByTimeAsync(10000);
    expect(await token).toBeNull();
  });
  it('times out if execute never completes', async () => {
    setClient(mockClient(vi.fn(() => new Promise(() => {}))));
    const token = getRecaptchaToken('LOGIN');
    await vi.advanceTimersByTimeAsync(10000);
    expect(await token).toBeNull();
  });
  it('handles synchronous and asynchronous SDK failures', async () => {
    setClient({ ready: () => { throw new Error('SDK failed'); } });
    expect(await getRecaptchaToken('CONTACT')).toBeNull();
    setClient(mockClient(vi.fn().mockRejectedValue(new Error('SDK failed'))));
    expect(await getRecaptchaToken('CONTACT')).toBeNull();
  });
});
