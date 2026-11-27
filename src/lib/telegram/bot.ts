import { Telegraf } from 'telegraf';
import { getTelegramDashboard, getTelegramLowStock, getTelegramSalesBreakdown, getTelegramPendingExpenses } from './actions';
import { logger } from '../logger';

/**
 * Urban Express Telegram Bot Core
 * Integrates with Firebase Admin for secure management alerts and reporting.
 */

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

// Authorization Middleware
bot.use(async (ctx, next) => {
  const authorizedIds = (process.env.OWNER_TELEGRAM_IDS || '').split(',').map(id => id.trim());
  const userId = ctx.from?.id.toString();

  if (!userId || !authorizedIds.includes(userId)) {
    const msg = `⚠️ UNAUTHORIZED ACCESS\n\nYour Telegram ID (${userId || 'UNKNOWN'}) is not recognized.\n\nPlease add this ID to your server's OWNER_TELEGRAM_IDS whitelist.`;
    
    try {
      await ctx.reply(msg);
    } catch (err) {
      logger.error('Failed to send unauthorized warning:', err);
    }
    
    logger.warn(`Unauthorized access attempt blocked for Telegram ID: ${userId}`);
    return;
  }
  return next();
});

// Command: /start
bot.start(async (ctx) => {
  await ctx.reply(
    '🛡️ URBAN EXPRESS MANAGEMENT BOT\n\n' +
    'Neural Link Established. Authorized modules available:\n\n' +
    '/dashboard - Operational Summary\n' +
    '/sales - Revenue Breakdown\n' +
    '/inventory - Low Stock Alerts\n' +
    '/expenses - Petty Cash Queue\n' +
    '/help - Command Reference'
  );
});

// Command: /dashboard
bot.command('dashboard', async (ctx) => {
  try {
    const data = await getTelegramDashboard();
    await ctx.replyWithMarkdown(data);
  } catch (err: any) {
    logger.error('Telegram Command Error [Dashboard]:', err);
    await ctx.reply(`⚠️ Telemetry Failure: ${err.message || 'Database node unreachable'}`);
  }
});

// Command: /inventory
bot.command('inventory', async (ctx) => {
  try {
    const data = await getTelegramLowStock();
    await ctx.replyWithMarkdown(data);
  } catch (err: any) {
    logger.error('Telegram Command Error [Inventory]:', err);
    await ctx.reply(`⚠️ Catalog Failure: ${err.message || 'Product node unreachable'}`);
  }
});

// Command: /sales
bot.command('sales', async (ctx) => {
  try {
    const data = await getTelegramSalesBreakdown();
    await ctx.replyWithMarkdown(data);
  } catch (err: any) {
    logger.error('Telegram Command Error [Sales]:', err);
    await ctx.reply(`⚠️ Ledger Failure: ${err.message || 'Revenue node unreachable'}`);
  }
});

// Command: /expenses
bot.command('expenses', async (ctx) => {
  try {
    const data = await getTelegramPendingExpenses();
    await ctx.replyWithMarkdown(data);
  } catch (err: any) {
    logger.error('Telegram Command Error [Expenses]:', err);
    await ctx.reply(`⚠️ Treasury Failure: ${err.message || 'Expense node unreachable'}`);
  }
});

// Command: /help
bot.help((ctx) => {
  ctx.reply(
    'Management Commands:\n' +
    '• /dashboard - High-level system overview\n' +
    '• /sales - Daily revenue by department\n' +
    '• /inventory - Alert list for restocking\n' +
    '• /expenses - Pending treasury authorizations'
  );
});

export { bot };
