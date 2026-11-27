'use server';

import { verifyRecaptcha } from './actions';

/** Only the exact server-side value false disables the login CAPTCHA gate. */
export async function isLoginRecaptchaEnabled() {
  return process.env.LOGIN_RECAPTCHA_ENABLED !== 'false';
}

export async function verifyLoginRecaptcha(token: string | null) {
  if (!(await isLoginRecaptchaEnabled())) {
    return { success: true, message: 'Login CAPTCHA temporarily disabled by the site owner.' };
  }
  return verifyRecaptcha(token);
}
