import type { User } from '@/lib/db';

export type TelegramClientEvent =
  | { type: 'SIGNUP'; name?: string }
  | { type: 'SIGNIN'; method?: 'EMAIL' | 'GOOGLE' }
  | { type: 'CARWASH_NEW'; jobId: string; plate?: string; service?: string; attendant?: string; amount?: number }
  | { type: 'CARWASH_STATUS'; jobId: string; status: string; plate?: string; attendant?: string }
  | { type: 'STOCK_ADJUSTMENT'; item: string; before: number; after: number; minimum?: number; unit?: string }
  | { type: 'EMPLOYEE_CREATED'; name: string; role: string }
  | { type: 'EMPLOYEE_ROLE_CHANGED'; name: string; role: string; previousRole?: string }
  | { type: 'EXPENSE_CREATED'; reference: string; amount: number; reason: string; branchId?: string }
  | { type: 'PAYMENT_RECONCILIATION'; reference: string; expected: number; received: number; details?: string; branchId?: string };

export async function notifyTelegramClientEvent(user: User | null, event: TelegramClientEvent) {
  if (!user) return;
  try {
    const token = await user.getIdToken();
    await fetch('/api/telegram/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
    });
  } catch (error) {
    console.warn('[TELEGRAM_EVENT_NOTIFY]', error);
  }
}

export async function notifyTelegramFailedSignIn(email: string) {
  try {
    await fetch('/api/telegram/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'FAILED_SIGNIN', email: email.trim().toLowerCase().slice(0, 254) }),
      keepalive: true,
    });
  } catch (error) {
    console.warn('[TELEGRAM_AUTH_ALERT]', error);
  }
}
