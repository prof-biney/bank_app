/**
 * Configurable logging utility for the Bank App
 * 
 * Features:
 * - Log levels (DEBUG, INFO, WARN, ERROR)
 * - Categories for different app areas
 * - Environment-based enabling/disabling
 * - Cleaner console output formatting
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type LogCategory = 
  | 'AUTH' 
  | 'DATABASE' 
  | 'NETWORK' 
  | 'UI' 
  | 'STORAGE' 
  | 'FIREBASE' 
  | 'CONFIG' 
  | 'TRANSACTION'
  | 'CARD'
  | 'CARDS'
  | 'NOTIFICATION'
  | 'ACTIVITY'
  | 'JWT'
  | 'CONNECTION'
  | 'GENERAL'
  | 'SCREEN';

interface LogConfig {
  enabled: boolean;
  minLevel: LogLevel;
  enabledCategories: LogCategory[] | 'ALL';
  showTimestamp: boolean;
  showCategory: boolean;
  colorEnabled: boolean;
}

class Logger {
  private config: LogConfig;
  private configuration: {
    debug: (message: string, ...data: any[]) => void;
    info: (message: string, ...data: any[]) => void;
    warn: (message: string, ...data: any[]) => void;
    error: (message: string, ...data: any[]) => void;
  };
  private logLevels: Record<LogLevel, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  };

  private colors = {
    DEBUG: '\x1b[36m', // Cyan
    INFO: '\x1b[32m',  // Green
    WARN: '\x1b[33m',  // Yellow
    ERROR: '\x1b[31m', // Red
    RESET: '\x1b[0m',  // Reset
    CATEGORY: '\x1b[35m', // Magenta
    TIMESTAMP: '\x1b[90m', // Gray
  };


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
    data?: any[]
  ): [string, any[]] {
    let prefix = '';

    if (this.config.showTimestamp) {
      const timestamp = new Date().toISOString().split('T')[1].slice(0, -1); // HH:MM:SS.mmm
      prefix += this.config.colorEnabled 
        ? `${this.colors.TIMESTAMP}[${timestamp}]${this.colors.RESET} `
        : `[${timestamp}] `;
    }

    if (this.config.showCategory) {
      const categoryStr = `[${category}]`;
      prefix += this.config.colorEnabled
        ? `${this.colors.CATEGORY}${categoryStr}${this.colors.RESET} `
        : `${categoryStr} `;
    }

    const levelColor = this.config.colorEnabled ? this.colors[level] : '';
    const resetColor = this.config.colorEnabled ? this.colors.RESET : '';
    const levelStr = `[${level}]`;

    const formattedMessage = `${prefix}${levelColor}${levelStr}${resetColor} ${message}`;
    return [formattedMessage, data || []];
  }

  debug(category: LogCategory, message: string, ...data: any[]): void {
    if (!this.shouldLog('DEBUG', category)) return;
    const [formatted, args] = this.formatMessage('DEBUG', category, message, data);
    console.log(formatted, ...args);
  }

  info(category: LogCategory, message: string, ...data: any[]): void {
    if (!this.shouldLog('INFO', category)) return;
    const [formatted, args] = this.formatMessage('INFO', category, message, data);
    console.info(formatted, ...args);
  }

  warn(category: LogCategory, message: string, ...data: any[]): void {
    if (!this.shouldLog('WARN', category)) return;
    const [formatted, args] = this.formatMessage('WARN', category, message, data);
    console.warn(formatted, ...args);
  }

  error(category: LogCategory, message: string, ...data: any[]): void {
    if (!this.shouldLog('ERROR', category)) return;
    const [formatted, args] = this.formatMessage('ERROR', category, message, data);
    console.error(formatted, ...args);
  }

  // Convenience methods for common categories (bound methods)
  auth = {
    debug: (message: string, ...data: any[]) => this.debug('AUTH', message, ...data),
    info: (message: string, ...data: any[]) => this.info('AUTH', message, ...data),
    warn: (message: string, ...data: any[]) => this.warn('AUTH', message, ...data),
    error: (message: string, ...data: any[]) => this.error('AUTH', message, ...data),
  };

  database = {
    debug: (message: string, ...data: any[]) => this.debug('DATABASE', message, ...data),
    info: (message: string, ...data: any[]) => this.info('DATABASE', message, ...data),
    warn: (message: string, ...data: any[]) => this.warn('DATABASE', message, ...data),
    error: (message: string, ...data: any[]) => this.error('DATABASE', message, ...data),
  };

  firebase = {
    debug: (message: string, ...data: any[]) => this.debug('FIREBASE', message, ...data),
    info: (message: string, ...data: any[]) => this.info('FIREBASE', message, ...data),
    warn: (message: string, ...data: any[]) => this.warn('FIREBASE', message, ...data),
    error: (message: string, ...data: any[]) => this.error('FIREBASE', message, ...data),
  };

  network = {
    debug: (message: string, ...data: any[]) => this.debug('NETWORK', message, ...data),
    info: (message: string, ...data: any[]) => this.info('NETWORK', message, ...data),
    warn: (message: string, ...data: any[]) => this.warn('NETWORK', message, ...data),
    error: (message: string, ...data: any[]) => this.error('NETWORK', message, ...data),
  };

  // 'config' runtime value is initialized in the constructor; no top-level initializer here

  constructor(config?: Partial<LogConfig>) {
    this.config = {
      enabled: __DEV__, // Only enabled in development by default
      minLevel: 'DEBUG',
      enabledCategories: 'ALL',
      showTimestamp: true,
      showCategory: true,
      colorEnabled: __DEV__,
      ...config,
    };
    
    // Re-bind convenience methods to ensure 'this' context is correct
    this.auth = {
      debug: (message: string, ...data: any[]) => this.debug('AUTH', message, ...data),
      info: (message: string, ...data: any[]) => this.info('AUTH', message, ...data),
      warn: (message: string, ...data: any[]) => this.warn('AUTH', message, ...data),
      error: (message: string, ...data: any[]) => this.error('AUTH', message, ...data),
    };

    this.database = {
      debug: (message: string, ...data: any[]) => this.debug('DATABASE', message, ...data),
      info: (message: string, ...data: any[]) => this.info('DATABASE', message, ...data),
      warn: (message: string, ...data: any[]) => this.warn('DATABASE', message, ...data),
      error: (message: string, ...data: any[]) => this.error('DATABASE', message, ...data),
    };

    this.firebase = {
      debug: (message: string, ...data: any[]) => this.debug('FIREBASE', message, ...data),
      info: (message: string, ...data: any[]) => this.info('FIREBASE', message, ...data),
      warn: (message: string, ...data: any[]) => this.warn('FIREBASE', message, ...data),
      error: (message: string, ...data: any[]) => this.error('FIREBASE', message, ...data),
    };

    this.network = {
      debug: (message: string, ...data: any[]) => this.debug('NETWORK', message, ...data),
      info: (message: string, ...data: any[]) => this.info('NETWORK', message, ...data),
      warn: (message: string, ...data: any[]) => this.warn('NETWORK', message, ...data),
      error: (message: string, ...data: any[]) => this.error('NETWORK', message, ...data),
    };

    // Configuration logging methods (use 'configuration' helper)
    this.configuration = {
      debug: (message: string, ...data: any[]) => this.debug('CONFIG', message, ...data),
      info: (message: string, ...data: any[]) => this.info('CONFIG', message, ...data),
      warn: (message: string, ...data: any[]) => this.warn('CONFIG', message, ...data),
      error: (message: string, ...data: any[]) => this.error('CONFIG', message, ...data),
    };
  }

  // Method to update configuration at runtime
  updateConfig(updates: Partial<LogConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  // Method to get current configuration
  getConfig(): LogConfig {
    return { ...this.config };
  }

  // Method to disable all logging
  disable(): void {
    this.config.enabled = false;
  }

  // Method to enable logging
  enable(): void {
    this.config.enabled = true;
  }
}

// Create and export default logger instance
export const logger = new Logger();

// Export factory function for custom logger instances
export const createLogger = (config?: Partial<LogConfig>) => new Logger(config);

// Environment-based configurations
export const loggerConfigs = {
  // Development: Show all logs with full formatting
  development: {
    enabled: true,
    minLevel: 'DEBUG' as LogLevel,
    enabledCategories: 'ALL' as const,
    showTimestamp: true,
    showCategory: true,
    colorEnabled: true,
  },
  
  // Production: Only errors and warnings, minimal formatting
  production: {
    enabled: true,
    minLevel: 'WARN' as LogLevel,
    enabledCategories: 'ALL' as const,
    showTimestamp: false,
    showCategory: false,
    colorEnabled: false,
  },
  
  // Silent: No logging at all
  silent: {
    enabled: false,
    minLevel: 'ERROR' as LogLevel,
    enabledCategories: 'ALL' as const,
    showTimestamp: false,
    showCategory: false,
    colorEnabled: false,
  },
  
  // Debug specific categories only
  authOnly: {
    enabled: true,
    minLevel: 'DEBUG' as LogLevel,
    enabledCategories: ['AUTH', 'JWT', 'CONFIG'] as LogCategory[],
    showTimestamp: true,
    showCategory: true,
    colorEnabled: true,
  },
  
  networkOnly: {
    enabled: true,
    minLevel: 'DEBUG' as LogLevel,
    enabledCategories: ['NETWORK', 'FIREBASE', 'CONNECTION'] as LogCategory[],
    showTimestamp: true,
    showCategory: true,
    colorEnabled: true,
  },
};

// Apply configuration based on environment
if (process.env.NODE_ENV === 'production') {
  logger.updateConfig(loggerConfigs.production);
} else if (process.env.EXPO_PUBLIC_LOG_LEVEL) {
  // Allow override via environment variable
  const configName = process.env.EXPO_PUBLIC_LOG_LEVEL as keyof typeof loggerConfigs;
  if (loggerConfigs[configName]) {
    logger.updateConfig(loggerConfigs[configName]);
  }
}
