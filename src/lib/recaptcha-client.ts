type EnterpriseClient = {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

/** Generate a fresh token at submit time, tolerating slow or blocked scripts. */
export async function getRecaptchaToken(action: 'LOGIN' | 'SIGNUP' | 'CONTACT'): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) return null;
  const client = () => (window as Window & { grecaptcha?: { enterprise?: EnterpriseClient } }).grecaptcha?.enterprise;
  for (let attempt = 0; attempt < 20 && !client(); attempt++) {
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const enterprise = client();
  if (!enterprise) return null;
  return new Promise(resolve => {
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };
    const timeout = setTimeout(() => finish(null), 10000);
    try {
      enterprise.ready(() => {
        Promise.resolve().then(() => enterprise.execute(siteKey, { action }))
          .then(token => finish(typeof token === 'string' && token.length > 0 ? token : null))
          .catch(() => finish(null));
      });
    } catch {
      finish(null);
    }
  });
}
