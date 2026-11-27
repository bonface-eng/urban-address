
/**
 * JARVIS Centralized Logging System
 * Handles system telemetry and error reporting.
 */
type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

class JarvisLogger {
  private log(level: LogLevel, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}] JARVIS:`;
    
    switch (level) {
      case 'ERROR':
        console.error(prefix, message, data || '');
        break;
      case 'WARN':
        console.warn(prefix, message, data || '');
        break;
      case 'DEBUG':
        if (process.env.NODE_ENV === 'development') {
          console.debug(prefix, message, data || '');
        }
        break;
      default:
        console.log(prefix, message, data || '');
    }
  }

  info(message: string, data?: any) { this.log('INFO', message, data); }
  warn(message: string, data?: any) { this.log('WARN', message, data); }
  error(message: string, data?: any) { this.log('ERROR', message, data); }
  debug(message: string, data?: any) { this.log('DEBUG', message, data); }
}

export const logger = new JarvisLogger();
