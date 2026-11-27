import type { User } from '@/lib/db';

/** Best-effort notification after a POS sale has committed; never rolls back the sale. */
export async function notifyCommittedSale(user: User | null, orderId: string) {
  if (!user || !orderId) return;
  try {
    const token = await user.getIdToken();
    const response = await fetch('/api/telegram/sales/notify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.warn('[TELEGRAM_SALE_NOTIFY]', body.error || response.statusText);
    }
  } catch (error) {
    console.warn('[TELEGRAM_SALE_NOTIFY]', error);
  }
}
