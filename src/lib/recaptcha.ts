const SITEVERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

export type RecaptchaVerifyResult = {
  success: boolean;
  message: string;
  skipped?: boolean;
};

/**
 * Server-side Google reCAPTCHA verification against https://www.google.com/recaptcha/api/siteverify.
 * Never exposes secret keys or raw internal tokens to the client; logs full Google response
 * (success, score, action, hostname, error-codes) server-side only.
 */
export async function verifyRecaptchaServer(
  token: string | null | undefined,
  expectedAction?: string,
  remoteIp?: string
): Promise<RecaptchaVerifyResult> {
  const globalEnabled = process.env.RECAPTCHA_ENABLED?.trim().toLowerCase();
  const loginEnabled = process.env.LOGIN_RECAPTCHA_ENABLED?.trim().toLowerCase();

  if (globalEnabled === 'false') {
    return { success: true, skipped: true, message: 'reCAPTCHA disabled by RECAPTCHA_ENABLED=false.' };
  }
  if (expectedAction === 'LOGIN' && loginEnabled === 'false') {
    return { success: true, skipped: true, message: 'Login reCAPTCHA disabled by LOGIN_RECAPTCHA_ENABLED=false.' };
  }

  const secretKey = process.env.RECAPTCHA_SECRET_KEY?.trim();
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();

  // If reCAPTCHA keys are not configured (e.g. local dev or placeholder), log a warning and allow auth
  if (!secretKey || !siteKey || secretKey === '[SENSITIVE]' || siteKey === '[SENSITIVE]') {
    console.warn('[RECAPTCHA_SERVER] RECAPTCHA_SECRET_KEY or NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not configured. Skipping verification.');
    return { success: true, skipped: true, message: 'reCAPTCHA not configured on server.' };
  }

  const cleanToken = typeof token === 'string' ? token.trim() : '';
  if (!cleanToken) {
    console.warn('[RECAPTCHA_SERVER] Missing client reCAPTCHA token for action:', expectedAction || 'UNKNOWN');
    if (process.env.RECAPTCHA_STRICT?.trim().toLowerCase() === 'true') {
      return {
        success: false,
        message: 'Security verification could not initialize. Please refresh the page and disable any script blockers.',
      };
    }
    console.warn('[RECAPTCHA_SERVER] Proceeding in permissive mode because client token was null (check NEXT_PUBLIC_RECAPTCHA_SITE_KEY domain/type in Google reCAPTCHA Admin).');
    return { success: true, skipped: true, message: 'Client token unavailable; permissive fallback applied.' };
  }

  try {
    const params = new URLSearchParams();
    params.set('secret', secretKey);
    params.set('response', cleanToken);
    if (remoteIp && remoteIp !== 'unknown') {
      params.set('remoteip', remoteIp);
    }

    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      cache: 'no-store',
    });

    const data = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      score?: number;
      action?: string;
      challenge_ts?: string;
      hostname?: string;
      'error-codes'?: string[];
    };

    const errorCodes = Array.isArray(data['error-codes']) ? data['error-codes'] : [];

    // Always log the full diagnostic payload server-side (never exposing secretKey)
    console.info('[RECAPTCHA_SITEVERIFY]', JSON.stringify({
      success: Boolean(data.success),
      score: data.score ?? null,
      action: data.action ?? null,
      expectedAction: expectedAction ?? null,
      hostname: data.hostname ?? null,
      errorCodes,
    }));

    if (data.success) {
      if (typeof data.score === 'number' && data.score < 0.3) {
        return {
          success: false,
          message: 'Automated request detected. Please try again.',
        };
      }
      return { success: true, message: 'Security check passed.' };
    }

    const isKeyConfigMismatch = errorCodes.some((code) =>
      ['invalid-input-secret', 'missing-input-secret', 'invalid-keys', 'bad-request'].includes(code)
    );

    if (isKeyConfigMismatch || (errorCodes.includes('invalid-input-response') && process.env.RECAPTCHA_STRICT?.trim().toLowerCase() !== 'true')) {
      console.error(
        '[RECAPTCHA_CONFIG_MISMATCH] Google siteverify returned error-codes:',
        errorCodes,
        'Verify that NEXT_PUBLIC_RECAPTCHA_SITE_KEY and RECAPTCHA_SECRET_KEY in Vercel belong to the same reCAPTCHA v3 key pair and allow urbanautoexpress.com.'
      );
      if (process.env.RECAPTCHA_STRICT?.trim().toLowerCase() !== 'true') {
        return {
          success: true,
          skipped: true,
          message: 'Security check bypassed due to provider key configuration warning.',
        };
      }
    }

    if (errorCodes.includes('timeout-or-duplicate')) {
      return {
        success: false,
        message: 'Security token expired. Please submit the form again.',
      };
    }

    return {
      success: false,
      message: 'Security verification failed. Please refresh the page and try again.',
    };
  } catch (error) {
    console.error('[RECAPTCHA_VERIFY_ERROR]', error);
    return {
      success: false,
      message: 'Security verification service is temporarily unreachable. Please try again.',
    };
  }
}
