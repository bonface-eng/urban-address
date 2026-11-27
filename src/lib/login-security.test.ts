import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isLoginRecaptchaEnabled, verifyLoginRecaptcha } from './login-security';
import { verifyRecaptcha } from './actions';

vi.mock('./actions', () => ({ verifyRecaptcha: vi.fn() }));

describe('server-controlled temporary login CAPTCHA switch', () => {
  beforeEach(() => { vi.mocked(verifyRecaptcha).mockReset(); });
  afterEach(() => vi.unstubAllEnvs());
  it.each([undefined, 'true', '', 'FALSE', '0', 'no'])('requires verification for %j', async value => {
    vi.stubEnv('LOGIN_RECAPTCHA_ENABLED', value);
    vi.mocked(verifyRecaptcha).mockResolvedValue({ success: false, message: 'Invalid token' });
    expect(await isLoginRecaptchaEnabled()).toBe(true);
    expect((await verifyLoginRecaptcha(null)).success).toBe(false);
    expect(verifyRecaptcha).toHaveBeenCalledWith(null);
  });
  it('skips only login CAPTCHA when explicitly disabled on the server', async () => {
    vi.stubEnv('LOGIN_RECAPTCHA_ENABLED', 'false');
    expect(await isLoginRecaptchaEnabled()).toBe(false);
    expect((await verifyLoginRecaptcha(null)).success).toBe(true);
    expect(verifyRecaptcha).not.toHaveBeenCalled();
  });
  it('rechecks config rather than trusting stale client status', async () => {
    vi.stubEnv('LOGIN_RECAPTCHA_ENABLED', 'false');
    expect(await isLoginRecaptchaEnabled()).toBe(false);
    vi.stubEnv('LOGIN_RECAPTCHA_ENABLED', 'true');
    vi.mocked(verifyRecaptcha).mockResolvedValue({ success: false, message: 'Missing token' });
    expect((await verifyLoginRecaptcha(null)).success).toBe(false);
  });
  it('delegates to existing CAPTCHA verification when re-enabled', async () => {
    vi.stubEnv('LOGIN_RECAPTCHA_ENABLED', 'true');
    vi.mocked(verifyRecaptcha).mockResolvedValue({ success: true, message: 'Verified' });
    expect((await verifyLoginRecaptcha('fresh-token')).success).toBe(true);
    expect(verifyRecaptcha).toHaveBeenCalledWith('fresh-token');
  });
});
