import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('shared staff terminal journey', () => {
  const lock = read('src/components/pos/terminal-lock.tsx');
  const welcome = read('src/components/pos/terminal-welcome.tsx');
  const terminal = read('src/hooks/use-terminal.tsx');
  const pinApi = read('src/app/api/terminal/pin/route.ts');
  const adminAuth = read('src/lib/admin-auth.ts');
  const adminSql = read('supabase/migrations/20261127000009_admin_full_access.sql');

  it('offers a home link on the idle welcome screen', () => {
    expect(welcome).toContain('<Link href="/" aria-label="Back to home"');
    expect(welcome).toContain('Back to home');
  });

  it('shows idle welcome before staff selection and PIN entry', () => {
    const idle = lock.indexOf('if (showWelcome &&');
    const access = lock.indexOf('if (isLocked || !activeCashier || isSigningInWithPassword || showStaffSelector)');
    const selector = lock.indexOf(': showSelector ? (');
    const pin = lock.indexOf('Secure Staff Access');

    expect(idle).toBeGreaterThan(-1);
    expect(access).toBeGreaterThan(idle);
    expect(selector).toBeGreaterThan(access);
    expect(pin).toBeGreaterThan(selector);
  });

  it('opens staff selection after the idle screen starts', () => {
    const begin = lock.indexOf('const handleBeginShift');
    const startSelector = lock.indexOf('setShowStaffSelector(true)', begin);
    expect(begin).toBeGreaterThan(-1);
    expect(startSelector).toBeGreaterThan(begin);
  });

  it('locks the terminal again after a page reload instead of trusting local storage', () => {
    expect(terminal).toContain('const [isLocked, setIsLocked] = useState(true)');
    expect(terminal).not.toContain('uax_last_unlocked_at');
  });

  it('signs staff in cleanly with email + password and optional 4-digit PIN without legacy blockers', () => {
    expect(lock).toContain('signInWithEmailAndPassword(primaryAuth');
    expect(lock).toContain("action: 'register'");
    expect(lock).toContain('Optional 4-digit PIN');
    expect(lock).not.toContain('acknowledge-disclaimer');
  });

  it('uses a server-verified PIN to switch the active Supabase identity', () => {
    expect(terminal).toContain("action: 'verify-pin'");
    expect(terminal).toContain('signInWithCustomToken(auth, payload.customToken)');
    expect(adminAuth).toContain('scryptSync');
    expect(adminAuth).toContain('timingSafeEqual');
    expect(pinApi).toContain('verifyPinHash');
    expect(pinApi).toContain('createCustomToken(targetUid');
  });

  it('renders PIN failures inside the PIN form rather than using a toast', () => {
    expect(lock).toContain('Incorrect PIN. Check your entry and try again');
    expect(lock).toContain('role="alert"');
    expect(lock).not.toContain('toast({ variant: "destructive", title: "Invalid PIN" })');
  });

  it('does not compare or persist staff PINs in client profile documents', () => {
    expect(lock).not.toContain("updateDoc(doc(firestore, 'users', activeCashier.uid), { pin:");
    expect(terminal).not.toContain("const storedPin = (activeCashier.pin || '')");
    expect(adminSql).toContain('CREATE TABLE IF NOT EXISTS public.staff_pins');
    expect(adminSql).toContain('ALTER TABLE public.staff_pins ENABLE ROW LEVEL SECURITY');
  });

  it('normalizes the configured Telegram secret consistently with webhook registration', () => {
    const webhook = read('src/app/api/telegram/webhook/route.ts');
    expect(webhook).toContain('process.env.TELEGRAM_WEBHOOK_SECRET?.trim()');
    expect(webhook).toContain('x-telegram-bot-api-secret-token');
  });

  it('supports secure email OTP recovery for a forgotten terminal PIN', () => {
    const reset = read('src/app/api/terminal/pin-reset/route.ts');
    expect(lock).toContain('Forgot your PIN? Reset by email');
    expect(lock).toContain("fetch('/api/terminal/pin-reset'");
    expect(reset).toContain("hashOtp(targetUid, 'terminal-pin-reset', code)");
    expect(reset).toContain('sendTransactionalEmail');
    expect(reset).toContain('expiresAt: now + 10 * 60_000');
    expect(reset).toContain('attempts: 0');
    expect(reset).toContain('timingSafeEqual');
  });

  it('registers the secure Telegram refund, inventory, session, shift and incident workflows', () => {
    const remote = read('src/lib/telegram/remote-operations.ts');
    const bot = read('src/lib/telegram/bot.ts');
    expect(bot).toContain('registerTelegramRemoteOperations(bot)');
    for (const command of ['/request_refund', '/refunds', '/request_stock_adjustment', '/stock_adjustments', '/lock_station', '/unlock_station', '/cashier_sessions', '/end_cashier_session', '/reconcile_shift', '/reconciliations', '/incidents', '/raise_incident', '/emergency_alert']) {
      expect(remote).toContain("bot.command('" + command.slice(1) + "'");
    }
    expect(remote).toContain('db.runTransaction');
    expect(remote).toContain('refundApprovalStatus');
    expect(remote).toContain('current !== Number(x.beforeStock)');
    expect(remote).toContain('EMERGENCY_ALERT');
  });

  it('enforces remote station locks for non-admins while granting admins full RLS access', () => {
    const remote = read('src/lib/telegram/remote-operations.ts');
    expect(remote).toContain('locked: disabled');
    expect(terminal).toContain('terminal.disabled === true || terminal.locked === true');
    expect(pinApi).toContain('stationState.data()?.locked === true');
    expect(adminSql).toContain('CREATE OR REPLACE FUNCTION public.is_admin()');
  });

  it('schedules deduplicated low-stock Telegram alerts', () => {
    const monitor = read('src/app/api/telegram/stock-monitor/route.ts');
    const vercel = read('vercel.json');
    expect(monitor).toContain('CRON_SECRET');
    expect(monitor).toContain('telegram_stock_alert_state');
    expect(monitor).toContain('6 * 60 * 60 * 1000');
    expect(vercel).toContain('/api/telegram/stock-monitor');
  });

  it('refreshes the Telegram command menu and exposes the new workflows in admin status', () => {
    const register = read('src/app/api/admin/telegram/register-webhook/route.ts');
    const status = read('src/app/api/admin/telegram/status/route.ts');
    expect(register).toContain("telegramRequest('setMyCommands'");
    expect(status).toContain("command: 'refunds'");
    expect(status).toContain("command: 'stock_adjustments'");
    expect(status).toContain("command: 'emergency_alert'");
  });
});
