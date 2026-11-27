import type { User } from 'firebase/auth';

/** No automatic mutation retries: a lost response can follow a committed write. */
export async function saveInventoryUpdate(user: User | null, body: Record<string, unknown>) {
  if (!user) throw new Error('Sign in again before updating stock. Ref: INVENTORY_AUTH_REQUIRED');
  const token = await user.getIdToken(true);
  let response;
  try {
    response = await fetch('/api/staff-inventory/update', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store', signal: AbortSignal.timeout(20000), body: JSON.stringify(body),
    });
  } catch {
    throw new Error('The save result could not be confirmed. Refresh inventory before retrying. Ref: INVENTORY_UPDATE_UNCONFIRMED');
  }
  let data;
  try { data = await response.json(); } catch { throw new Error('The save result could not be confirmed. Refresh inventory before retrying. Ref: INVENTORY_UPDATE_UNCONFIRMED'); }
  if (!response.ok || data.success !== true) {
    const code = typeof data.code === 'string' && /^INVENTORY_[A-Z_]+$/.test(data.code) ? data.code : 'INVENTORY_UPDATE_UNAVAILABLE';
    const messages: Record<string, string> = {
      INVENTORY_AUTH_REQUIRED: 'Sign out and sign in again before saving.',
      INVENTORY_WRITE_DENIED: 'Your account is not authorized to update inventory.',
      INVENTORY_STOCK_CONFLICT: 'Stock changed since this item was opened. Refresh and reopen it before saving.',
      INVENTORY_INVALID_UPDATE: 'Check the item fields: name/category are required and numeric values must be valid and non-negative.',
      INVENTORY_ITEM_MISSING: 'This item no longer exists. Refresh inventory.',
    };
    throw new Error(`${messages[code] || 'The save could not be confirmed. Refresh inventory before retrying.'} Ref: ${code}`);
  }
  return data as { success: true; stockLevel: number };
}
