/**
 * Server-side logger utility
 * 
 * Provides structured logging for the server components with
 * appropriate formatting and log levels.
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type LogCategory = 
  | 'SERVER' 
  | 'AUTH' 
  | 'DATABASE' 
  | 'API'
  | 'CARDS'
  | 'TRANSACTIONS'
  | 'PAYMENTS'
  | 'TRANSFERS'
  | 'DEPOSITS'
  | 'MIDDLEWARE'
  | 'VALIDATION'
  | 'ERROR';

interface ServerLogConfig {
  enabled: boolean;
  minLevel: LogLevel;
  showTimestamp: boolean;
  showCategory: boolean;
  enabledCategories: LogCategory[] | 'ALL';
}

class ServerLogger {
  private config: ServerLogConfig;
  private logLevels: Record<LogLevel, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  };

  constructor(config?: Partial<ServerLogConfig>) {
    this.config = {
      enabled: true, // Always enabled for server
      minLevel: process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG',
      enabledCategories: 'ALL',
      showTimestamp: true,
      showCategory: true,
      ...config,
    };
  }

  private shouldLog(level: LogLevel, category: LogCategory): boolean {
    if (!this.config.enabled) return false;
    
    // Check log level
    if (this.logLevels[level] < this.logLevels[this.config.minLevel]) {
      return false;
    }

    // Check category filter
    if (this.config.enabledCategories !== 'ALL') {
      return this.config.enabledCategories.includes(category);
    }

    return true;
  }

  private formatMessage(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: any
  ): string {
    let prefix = '';

    if (this.config.showTimestamp) {
      const timestamp = new Date().toISOString();
      prefix += `[${timestamp}] `;
    }

    if (this.config.showCategory) {
      prefix += `[${category}] `;
    }

    prefix += `[${level}] `;

    let result = `${prefix}${message}`;
    
    if (data !== undefined) {
      try {
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        result += ` ${dataStr}`;
      } catch (error) {
        result += ` [Unserializable data: ${String(data)}]`;
      }
    }

    return result;
  }

  debug(category: LogCategory, message: string, data?: any): void {
    if (!this.shouldLog('DEBUG', category)) return;
    const formatted = this.formatMessage('DEBUG', category, message, data);
    console.log(formatted);
  }

  info(category: LogCategory, message: string, data?: any): void {
    if (!this.shouldLog('INFO', category)) return;
    const formatted = this.formatMessage('INFO', category, message, data);
    console.info(formatted);
  }

  warn(category: LogCategory, message: string, data?: any): void {
    if (!this.shouldLog('WARN', category)) return;
    const formatted = this.formatMessage('WARN', category, message, data);
    console.warn(formatted);
  }

  error(category: LogCategory, message: string, data?: any): void {
    if (!this.shouldLog('ERROR', category)) return;
    const formatted = this.formatMessage('ERROR', category, message, data);
    console.error(formatted);
  }
}

// Create and export logger instance
export const logger = new ServerLogger();

// Export factory function for custom logger instances
export const createServerLogger = (config?: Partial<ServerLogConfig>) => new ServerLogger(config);