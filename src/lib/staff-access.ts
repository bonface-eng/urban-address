import type { Firestore } from 'firebase-admin/firestore';
import { ROOT_ADMIN_EMAILS } from './admin-identity';
export type StaffIdentity = { uid: string; email?: string; email_verified?: boolean };
export class StaffAccessError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}
const roles = new Set(['ADMIN','MANAGER','SUPERVISOR','CASHIER','STOREKEEPER','ATTENDANT','KITCHEN']);
export async function staffAccess(db: Firestore, identity: StaffIdentity) {
  const snapshot = await db.collection('users').doc(identity.uid).get();
  if (!snapshot.exists || snapshot.get('disabled') === true || snapshot.get('active') === false || snapshot.get('status') === 'DISABLED') throw new StaffAccessError('STAFF_ACCESS_DENIED',403);
  const data = snapshot.data() || {};
  const role = typeof data.role === 'string' ? data.role.toUpperCase() : '';
  const email = typeof identity.email === 'string' ? identity.email.toLowerCase().trim() : '';
  let registryAdmin = false;
  if (email && !email.includes('/') && email.length <= 254 && identity.email_verified === true) registryAdmin = ROOT_ADMIN_EMAILS.includes(email) || (await db.collection('admins').doc(email).get()).exists;
  if (!roles.has(role) && !registryAdmin) throw new StaffAccessError('STAFF_ACCESS_DENIED',403);
  return { uid: identity.uid, role: registryAdmin ? 'ADMIN' : role, manager: registryAdmin || ['ADMIN','MANAGER','SUPERVISOR'].includes(role), profile: data };
}
