// Centralized logging system for ScriptFlow
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  maxStorageEntries: number;
}

class Logger {
  private config: LogConfig;
  private storage: LogEntry[] = [];
  private isDevelopment: boolean;

  constructor(config: Partial<LogConfig> = {}) {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    
    this.config = {
      level: this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO,
      enableConsole: true,
      enableStorage: true,
      maxStorageEntries: 1000,
      ...config,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const prefix = `[ScriptFlow:${levelName}] ${timestamp}`;
    
    if (args.length > 0) {
      return `${prefix} ${message} ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')}`;
    }
    
    return `${prefix} ${message}`;
  }

  private addToStorage(level: LogLevel, message: string, ...args: any[]): void {
    if (!this.config.enableStorage) return;

    const entry: LogEntry = {
      id: Date.now().toString(),
      level,
      message: this.formatMessage(level, message, ...args),
      timestamp: Date.now(),
      args: args.length > 0 ? args : undefined,
    };

    this.storage.push(entry);

    // Keep only the most recent entries
    if (this.storage.length > this.config.maxStorageEntries) {
      this.storage = this.storage.slice(-this.config.maxStorageEntries);
    }
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, ...args);

    if (this.config.enableConsole) {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
      }
    }

    this.addToStorage(level, message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  // Get stored logs
  getLogs(level?: LogLevel, limit?: number): LogEntry[] {
    let logs = this.storage;
    
    if (level !== undefined) {
      logs = logs.filter(entry => entry.level >= level);
    }
    
    if (limit !== undefined) {
      logs = logs.slice(-limit);
    }
    
    return logs;
  }

  // Clear stored logs
  clearLogs(): void {
    this.storage = [];
  }

  // Update configuration
  updateConfig(newConfig: Partial<LogConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: number;
  args?: any[];
}

// Create singleton instance
export const logger = new Logger();

// Export convenience methods
export const debug = logger.debug.bind(logger);
export const info = logger.info.bind(logger);
export const warn = logger.warn.bind(logger);
export const error = logger.error.bind(logger);