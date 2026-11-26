const recent = new Map<string, number>();

function safe(value: unknown) {
  return String(value instanceof Error ? value.message : value ?? 'Unknown system error')
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/(token|authorization|password|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/[\r\n<>]/g, ' ')
    .slice(0, 220);
}

/** Best-effort server-only alert; it must never interfere with the request being logged. */
export async function notifyTelegramSystemError(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return;
  const now = Date.now();
  const fingerprint = safe(message).toLowerCase();
  const last = recent.get(fingerprint) || 0;
  if (now - last < 60_000) return;
  recent.set(fingerprint, now);
  for (const [key, value] of recent) if (now - value > 10 * 60_000) recent.delete(key);

  const recipients = new Set<string>();
  const owners = String(process.env.OWNER_TELEGRAM_IDS || '').split(/[;,\s]+/);
  owners.filter(id => /^\d{1,20}$/.test(id)).forEach(id => recipients.add(id));
  try {
    const access = JSON.parse(process.env.TELEGRAM_USER_ACCESS || '{}') as Record<string, { role?: string }>;
    for (const [id, value] of Object.entries(access)) {
      if (/^\d{1,20}$/.test(id) && ['OWNER', 'MANAGER'].includes(String(value.role || '').toUpperCase())) recipients.add(id);
    }
  } catch { /* Ignore malformed optional access configuration. */ }
  await Promise.allSettled([...recipients].map(async chatId => {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `SYSTEM ALERT | Urban Address\n${safe(message)}\nTime: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}` }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('Telegram system alert delivery failed');
  }));
}
