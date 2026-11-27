/** Read-only normalization. Do not invent a date for absent or invalid records. */
export function reportDateMillis(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    try { const time = value.toMillis(); return typeof time === 'number' && Number.isFinite(time) ? time : null; }
    catch { return null; }
  }
  return null;
}
