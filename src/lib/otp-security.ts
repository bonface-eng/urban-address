import { createHash, randomInt } from 'node:crypto';
export function createOtp() { return String(randomInt(0, 1_000_000)).padStart(6, '0'); }
export function hashOtp(uid: string, purpose: string, code: string) {
  const secret = process.env.RESEND_API_KEY;
  if (!secret) throw new Error('RESEND_API_KEY is not configured.');
  return createHash('sha256').update([secret, uid, purpose, code].join(':')).digest('hex');
}
export function utcDayKey(date = new Date()) { return date.toISOString().slice(0, 10); }
export function utcDayEnd(date = new Date()) { const end = new Date(date); end.setUTCHours(23,59,59,999); return end.getTime(); }


/** Count OTP requests in a short rolling window without storing the code or raw email. */
export async function recordOtpRequestSignal(db: any, uid: string, purpose: string) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = createHash('sha256').update(uid + ':' + purpose).digest('hex');
  const ref = db.collection('telegram_otp_request_windows').doc(key + '-' + windowStart);
  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref);
    const count = Number(snap.data()?.count || 0) + 1;
    tx.set(ref, { uidHash: key, purpose, windowStart, count, lastRequestedAt: now, spamSuspected: count >= 3 }, { merge: true });
    return { count, spamSuspected: count >= 3, shouldNotify: count === 1 || count === 3 || (count > 3 && count % 5 === 0) };
  });
}
