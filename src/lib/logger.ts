type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

function redact(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/https?:\/\/\S+/gi, '[url]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
      .replace(/(?:\+?\d[\d ()-]{7,}\d)/g, '[phone]')
      .replace(/(token|authorization|password|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
      .slice(0, 500);
  }
  if (value instanceof Error) return { name: value.name, message: redact(value.message) };
  if (Array.isArray(value)) return value.slice(0, 20).map(redact);
  if (value && typeof value === 'object') return '[structured data omitted]';
  return value;
}

class UrbanLogger {
  private log(level: LogLevel, message: string, data?: unknown) {
    const prefix = `[${new Date().toISOString()}] [${level}] Urban Address:`;
    const safeMessage = String(redact(message));
    const safeData = redact(data);
    if (level === 'ERROR') {
      console.error(prefix, safeMessage, safeData ?? '');
      if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
        void import('./telegram/system-alerts').then(({ notifyTelegramSystemError }) => notifyTelegramSystemError(safeMessage)).catch(() => undefined);
      }
    }
    else if (level === 'WARN') console.warn(prefix, safeMessage, safeData ?? '');
    else if (level === 'DEBUG') {
      if (process.env.NODE_ENV === 'development') console.debug(prefix, safeMessage, safeData ?? '');
    } else console.info(prefix, safeMessage, safeData ?? '');
  }
  info(message: string, data?: unknown) { this.log('INFO', message, data); }
  warn(message: string, data?: unknown) { this.log('WARN', message, data); }
  error(message: string, data?: unknown) { this.log('ERROR', message, data); }
  debug(message: string, data?: unknown) { this.log('DEBUG', message, data); }
}

export const logger = new UrbanLogger();
