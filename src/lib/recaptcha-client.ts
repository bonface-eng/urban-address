'use client';

export type RecaptchaAction = 'LOGIN' | 'SIGNUP' | 'CONTACT';

type GrecaptchaExecutor = {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

type WindowWithGrecaptcha = Window & {
  grecaptcha?: GrecaptchaExecutor & {
    enterprise?: GrecaptchaExecutor;
  };
};

let scriptLoadingPromise: Promise<void> | null = null;

function ensureRecaptchaScript(siteKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const win = window as WindowWithGrecaptcha;
  if (win.grecaptcha?.execute || win.grecaptcha?.enterprise?.execute) {
    return Promise.resolve();
  }
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="google.com/recaptcha/"]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => resolve(), { once: true });
      setTimeout(() => resolve(), 3000);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

/**
 * Generates a fresh single-use reCAPTCHA token immediately before form submission.
 * Supports both standard Google reCAPTCHA v3 (grecaptcha.execute) and Enterprise
 * (grecaptcha.enterprise.execute) so tokens are valid for siteverify.
 */
export async function getRecaptchaToken(action: RecaptchaAction): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
  if (!siteKey) return null;

  await ensureRecaptchaScript(siteKey);

  const getExecutor = (): GrecaptchaExecutor | null => {
    const g = (window as WindowWithGrecaptcha).grecaptcha;
    if (!g) return null;
    if (typeof g.execute === 'function' && typeof g.ready === 'function') return g;
    if (g.enterprise && typeof g.enterprise.execute === 'function') return g.enterprise;
    return null;
  };

  for (let attempt = 0; attempt < 20 && !getExecutor(); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const executor = getExecutor();
  if (!executor) return null;

  return new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };

    const timeout = setTimeout(() => finish(null), 8000);

    try {
      executor.ready(() => {
        Promise.resolve()
          .then(() => executor.execute(siteKey, { action }))
          .then((token) =>
            finish(typeof token === 'string' && token.trim().length > 0 ? token.trim() : null)
          )
          .catch(() => finish(null));
      });
    } catch {
      finish(null);
    }
  });
}

/**
 * Calls the server-side /api/auth/verify-recaptcha endpoint with a fresh token.
 */
export async function verifyClientRecaptcha(
  action: RecaptchaAction
): Promise<{ success: boolean; message: string }> {
  const token = await getRecaptchaToken(action);
  try {
    const response = await fetch('/api/auth/verify-recaptcha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    return {
      success: Boolean(data?.success),
      message: typeof data?.message === 'string' ? data.message : 'Security verification failed.',
    };
  } catch {
    return {
      success: false,
      message: 'Could not reach the security verification service. Please check your connection and try again.',
    };
  }
}
