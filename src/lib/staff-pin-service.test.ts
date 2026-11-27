import { beforeEach, describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { PIN_ENROLLMENT_VERSION, staffPinOperation } from './staff-pin-service';

const now = 1800000000000;
const identity = { uid: 'staff-a', auth_time: now / 1000, email: 'staff@example.com', email_verified: true };
let records: Map<string, Record<string, any>>;
let db: Firestore;
const op = (body: Record<string, unknown>, actor = identity, time = now) => staffPinOperation(db, actor, body, 'test-pepper', time);
const enroll = (pin = '0123') => op({ action: 'enroll', pin, confirmPin: pin });

beforeEach(() => {
  records = new Map([['users/staff-a', { role: 'CASHIER', pin: '9999' }], ['users/staff-b', { role: 'ATTENDANT' }]]);
  let queue = Promise.resolve();
  db = {
    collection: (name: string) => ({ doc: (uid: string) => `${name}/${uid}` }),
    runTransaction: (callback: any) => {
      const run = queue.then(async () => {
        const writes: Array<() => void> = [];
        const result = await callback({
          get: async (ref: string) => ({ exists: records.has(ref), get: (key: string) => records.get(ref)?.[key] }),
          set: (ref: string, data: any) => writes.push(() => records.set(ref, data)),
          update: (ref: string, data: any) => writes.push(() => records.set(ref, { ...records.get(ref), ...data })),
        });
        writes.forEach(write => write()); return result;
      });
      queue = run.then(() => {}, () => {}); return run;
    },
  } as unknown as Firestore;
});

describe('one-time staff PIN enrollment', () => {
  it('requires enrollment despite an existing legacy PIN', async () => {
    expect(await op({ action: 'status' })).toEqual({ enrolled: false });
    await expect(op({ action: 'verify', pin: '9999' })).rejects.toMatchObject({ code: 'ENROLLMENT_REQUIRED' });
  });
  it('stores only a salted hash and recognizes enrollment across sessions', async () => {
    await enroll();
    const saved = records.get('staff_pin_credentials/staff-a')!;
    expect(saved.version).toBe(PIN_ENROLLMENT_VERSION);
    expect(saved.hash).toHaveLength(128); expect(saved.salt).toHaveLength(32);
    expect(JSON.stringify(saved)).not.toContain('0123');
    expect(saved.pin).toBeUndefined();
    expect(await op({ action: 'status' })).toEqual({ enrolled: true });
    expect((await op({ action: 'verify', pin: '0123' })).success).toBe(true);
    expect((await op({ action: 'verify', pin: '9999' })).success).toBe(false);
  });
  it('never overwrites an enrolled PIN, including competing enrollment requests', async () => {
    const result = await Promise.allSettled([enroll('0123'), enroll('4321')]);
    expect(result.filter(item => item.status === 'fulfilled')).toHaveLength(1);
    expect(result.filter(item => item.status === 'rejected')).toHaveLength(1);
    await expect(enroll()).rejects.toMatchObject({ code: 'ALREADY_ENROLLED' });
  });
  it.each(['', '123', '12345', 'abcd', 1234, null])('rejects malformed PIN %j', async pin => {
    await expect(op({ action: 'enroll', pin, confirmPin: pin })).rejects.toMatchObject({ code: 'PIN_FORMAT' });
    expect(records.has('staff_pin_credentials/staff-a')).toBe(false);
  });
  it('rejects mismatch and stale authentication', async () => {
    await expect(op({ action: 'enroll', pin: '1234', confirmPin: '4321' })).rejects.toMatchObject({ code: 'PIN_MISMATCH' });
    await expect(op({ action: 'enroll', pin: '1234', confirmPin: '1234' }, { ...identity, auth_time: now / 1000 - 901 })).rejects.toMatchObject({ code: 'RECENT_LOGIN_REQUIRED' });
  });
  it.each(['CLIENT', undefined, 42])('rejects non-staff role %j', async role => {
    records.set('users/staff-a', { role });
    await expect(op({ action: 'status' })).rejects.toMatchObject({ code: 'STAFF_REQUIRED' });
  });
  it('rejects missing/disabled profiles and cross-account requests', async () => {
    await expect(op({ action: 'enroll', pin: '1234', confirmPin: '1234', targetUid: 'staff-b' })).rejects.toMatchObject({ code: 'SELF_ONLY' });
    records.set('users/staff-a', { role: 'CASHIER', disabled: true });
    await expect(op({ action: 'status' })).rejects.toMatchObject({ code: 'STAFF_REQUIRED' });
    records.delete('users/staff-a');
    await expect(op({ action: 'status' })).rejects.toMatchObject({ code: 'STAFF_REQUIRED' });
  });
  it('limits guesses by account, including the correct PIN during cooldown', async () => {
    await enroll();
    for (let i = 0; i < 4; i++) expect((await op({ action: 'verify', pin: '0000' })).code).toBe('INCORRECT_PIN');
    expect((await op({ action: 'verify', pin: '0000' })).code).toBe('PIN_RATE_LIMIT');
    expect((await op({ action: 'verify', pin: '0123' })).code).toBe('PIN_RATE_LIMIT');
    expect((await op({ action: 'verify', pin: '0123' }, identity, now + 600001)).success).toBe(true);
  });
  it('keeps credentials separate between staff', async () => {
    await enroll();
    expect(await op({ action: 'status' }, { ...identity, uid: 'staff-b' })).toEqual({ enrolled: false });
    records.set('users/staff-a', { role: 'CLIENT' });
    await expect(op({ action: 'verify', pin: '0123' })).rejects.toMatchObject({ code: 'STAFF_REQUIRED' });
  });
  it('fails closed without pepper', async () => {
    await expect(staffPinOperation(db, identity, { action: 'status' }, '', now)).rejects.toMatchObject({ code: 'PIN_CONFIGURATION' });
  });
  it('recognizes the existing root admin from authenticated verified email even when profile role is CLIENT', async () => {
    records.set('users/staff-a', { role: 'CLIENT' });
    const root = { ...identity, email: 'bonfacewana3072@gmail.com' };
    expect(await op({ action: 'status' }, root)).toEqual({ enrolled: false });
    expect((await op({ action: 'enroll', pin: '0123', confirmPin: '0123' }, root)).success).toBe(true);
    expect((await op({ action: 'verify', pin: '0123' }, root)).success).toBe(true);
  });
  it('recognizes server admin registry membership using only authenticated email', async () => {
    records.set('users/staff-a', { role: 'CLIENT' });
    records.set('admins/staff@example.com', {});
    expect(await op({ action: 'status' })).toEqual({ enrolled: false });
  });
  it('does not trust a profile or request email to claim root admin', async () => {
    records.set('users/staff-a', { role: 'CLIENT', email: 'bonfacewana3072@gmail.com' });
    await expect(op({ action: 'status', email: 'bonfacewana3072@gmail.com' })).rejects.toMatchObject({ code: 'STAFF_REQUIRED' });
  });
  it('does not grant email-based admin fallback to an unverified email', async () => {
    records.set('users/staff-a', { role: 'CLIENT' });
    await expect(op({ action: 'status' }, { ...identity, email: 'bonfacewana3072@gmail.com', email_verified: false })).rejects.toMatchObject({ code: 'ADMIN_EMAIL_VERIFICATION_REQUIRED' });
  });
  it.each([{ disabled: true }, { active: false }, { status: 'DISABLED' }])('retains disabled-profile rejection for root admin %j', async flags => {
    records.set('users/staff-a', { role: 'CLIENT', ...flags });
    await expect(op({ action: 'status' }, { ...identity, email: 'bonfacewana3072@gmail.com' })).rejects.toMatchObject({ code: 'STAFF_REQUIRED' });
  });
  it('does not fabricate a missing profile for root admins', async () => {
    records.delete('users/staff-a');
    await expect(op({ action: 'status' }, { ...identity, email: 'bonfacewana3072@gmail.com' })).rejects.toMatchObject({ code: 'STAFF_REQUIRED' });
  });

});
