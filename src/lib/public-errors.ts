/**
 * Public-facing error copy. Provider diagnostics and infrastructure identifiers
 * belong in server-side logs, never in customer/staff notifications.
 */
const INTERNAL_TRACE_PATTERN =
  /firebase|firestore|auth\/[a-z-]+|permission-denied|\bgrpc\b|\bhttp\s*\d{3}\b|googleapis\.com|firebaseapp\.com|firebaseio\.com|\/databases\/|studio-\d+-[a-z0-9-]+|project[_ -]?id|collection\(|document\(/i;

const STACK_TRACE_PATTERN = /\n\s*at\s+[^\n]+/g;

export function sanitizePublicErrorMessage(
  value: unknown,
  fallback = 'We could not complete your request. Please try again. If the issue continues, contact Urban Auto Express support.'
): string {
  const raw = value instanceof Error ? value.message : String(value ?? '');
  const normalized = raw.trim();
  if (!normalized || INTERNAL_TRACE_PATTERN.test(normalized)) return fallback;

  const safe = normalized
    .replace(STACK_TRACE_PATTERN, '')
    .replace(/https?:\/\/\S+/gi, '[link hidden]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email hidden]')
    .replace(/(?:\+?\d[\d ()-]{7,}\d)/g, '[number hidden]')
    .replace(/(token|authorization|password|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[hidden]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 180);

  return safe || fallback;
}

export function sanitizeToastCopy(value: unknown, fallback: string): unknown {
  if (typeof value !== 'string') return value;
  return sanitizePublicErrorMessage(value, fallback);
}

/** Safe replacement for provider errors stored in client-visible hook state. */
export function toPublicServiceError(value: unknown): Error & { code?: string } {
  const source = value as { code?: unknown; message?: unknown; name?: unknown } | null;
  const message = sanitizePublicErrorMessage(
    value,
    'Urban Auto Express could not complete this request. Please try again.'
  );
  const error = new Error(message) as Error & { code?: string };
  error.name = 'ServiceError';
  if (typeof source?.code === 'string') error.code = source.code;
  return error;
}
