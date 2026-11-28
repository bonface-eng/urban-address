import { createHash, randomInt } from 'node:crypto';
export function createOtp() { return String(randomInt(0, 1_000_000)).padStart(6, '0'); }
export function hashOtp(uid: string, purpose: string, code: string) {
  const secret = process.env.RESEND_API_KEY;
  if (!secret) throw new Error('RESEND_API_KEY is not configured.');
  return createHash('sha256').update([secret, uid, purpose, code].join(':')).digest('hex');
}
export function utcDayKey(date = new Date()) { return date.toISOString().slice(0, 10); }
export function utcDayEnd(date = new Date()) { const end = new Date(date); end.setUTCHours(23,59,59,999); return end.getTime(); }
