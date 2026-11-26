type EmailSender = 'auth' | 'finance' | 'general';

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  sender?: EmailSender;
};

const SENDERS: Record<EmailSender, string> = {
  auth: 'Urban Auto Express Security <otp@urbanautoexpress.com>',
  finance: 'Urban Auto Express Finance <finance@urbanautoexpress.com>',
  general: 'Urban Auto Express <mail@urbanautoexpress.com>',
};

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const MAX_ATTEMPTS = 4;
const MIN_REQUEST_INTERVAL_MS = 650;
let sendQueue: Promise<void> = Promise.resolve();
let lastRequestStartedAt = 0;

function sleep(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function retryDelay(response: Response, attempt: number) {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const retryAt = Number.isFinite(seconds)
      ? Date.now() + Math.max(0, seconds) * 1000
      : Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) {
      return Math.min(30_000, Math.max(0, retryAt - Date.now()));
    }
  }
  return Math.min(8_000, 1_000 * 2 ** attempt);
}

async function sendWithRateLimit(input: SendEmailInput, apiKey: string) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const waitForSlot = Math.max(0, lastRequestStartedAt + MIN_REQUEST_INTERVAL_MS - Date.now());
    if (waitForSlot) await sleep(waitForSlot);
    lastRequestStartedAt = Date.now();

    let response: Response;
    try {
      response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: SENDERS[input.sender || 'general'],
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
        cache: 'no-store',
      });
    } catch (error) {
      if (attempt === MAX_ATTEMPTS - 1) throw error;
      await sleep(Math.min(8_000, 1_000 * 2 ** attempt));
      continue;
    }

    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      return { id: typeof result?.id === 'string' ? result.id : undefined };
    }

    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < MAX_ATTEMPTS - 1) {
      console.warn('[RESEND] Retrying transient provider response:', response.status, `attempt ${attempt + 1}/${MAX_ATTEMPTS}`);
      await sleep(retryDelay(response, attempt));
      continue;
    }

    console.error('[RESEND] Email request failed:', response.status, result?.name || 'provider_error');
    throw new Error(response.status === 429 ? 'Email provider rate limit reached after retries.' : 'Email delivery failed.');
  }

  throw new Error('Email delivery failed after retries.');
}

/** Server-only Resend transport. Serializes sends within an instance and retries transient provider limits. */
export async function sendTransactionalEmail(input: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.');

  const queued = sendQueue.then(() => sendWithRateLimit(input, apiKey));
  sendQueue = queued.then(() => undefined, () => undefined);
  return queued;
}

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}
