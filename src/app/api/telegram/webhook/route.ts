import { NextRequest, NextResponse } from 'next/server';
import { bot } from '@/lib/telegram/bot';
import { getDbAdmin } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const supplied = req.headers.get('x-telegram-bot-api-secret-token');
  if (!expected || expected.length < 32) {
    logger.error('Telegram webhook is disabled: a strong TELEGRAM_WEBHOOK_SECRET is required');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }
  if (!supplied || supplied !== expected) {
    logger.warn('Rejected Telegram webhook request: invalid secret');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let update: any;
  try { update = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!Number.isSafeInteger(update?.update_id)) return NextResponse.json({ error: 'Invalid update' }, { status: 400 });
  const db = getDbAdmin();
  const ref = db.collection('telegram_updates').doc(String(update.update_id));
  try {
    const claim = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const previous = snap.data();
      const now = Date.now();
      if (previous?.status === 'COMPLETED') return 'COMPLETED' as const;
      // Telegram may redeliver an update while the first invocation is still running.
      // A short processing lease prevents concurrent executions from flooding the bot/API.
      if (previous?.status === 'PROCESSING' && now - Number(previous.processingStartedAt || 0) < 60_000) {
        return 'PROCESSING' as const;
      }
      tx.set(ref, {
        status: 'PROCESSING',
        receivedAt: Number(previous?.receivedAt || now),
        processingStartedAt: now,
        attempts: Number(previous?.attempts || 0) + 1,
      }, { merge: true });
      return 'CLAIMED' as const;
    });
    if (claim !== 'CLAIMED') {
      return NextResponse.json({ ok: true, duplicate: true, processing: claim === 'PROCESSING' });
    }
    await bot.handleUpdate(update);
    await ref.set({ status: 'COMPLETED', completedAt: Date.now(), processingStartedAt: null, lastError: null }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('Telegram webhook processing failed', { updateId: update.update_id, error });
    await ref.set({ status: 'FAILED', failedAt: Date.now(), processingStartedAt: null, lastError: error instanceof Error ? error.message.slice(0, 300) : 'Unknown error' }, { merge: true }).catch(() => undefined);
    return NextResponse.json({ error: 'Processing failed; retry permitted' }, { status: 500 });
  }
}
