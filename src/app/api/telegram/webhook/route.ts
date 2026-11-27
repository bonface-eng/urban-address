
import { NextRequest, NextResponse } from 'next/server';
import { bot } from '@/lib/telegram/bot';
import { logger } from '@/lib/logger';

/**
 * Telegram Webhook Route Handler
 * Receives real-time updates from Telegram and dispatches to Telegraf.
 */

export async function POST(req: NextRequest) {
  const secretToken = req.headers.get('x-telegram-bot-api-secret-token');
  
  // Security Verification
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    logger.warn('Unauthorized Telegram Webhook Attempt: Invalid Secret Token');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    
    // Process update via Telegraf
    // Note: Telegraf handleUpdate is synchronous in its default usage here
    await bot.handleUpdate(body);

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('Telegram Webhook Error:', err);
    // Return 200 to Telegram to prevent retry loops on logical errors
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
