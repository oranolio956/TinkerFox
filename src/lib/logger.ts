/**
 * ScriptFlow Logger
 * 
 * Production-grade logging system with structured logging,
 * log levels, and comprehensive error tracking
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  readonly level: LogLevel
  readonly message: string
  readonly timestamp: number
  readonly context?: Record<string, unknown>
  readonly error?: Error
  readonly stack?: string
}

export interface LoggerConfig {
  readonly level: LogLevel
  readonly enableConsole: boolean
  readonly enableStorage: boolean
  readonly maxStorageEntries: number
  readonly enableRemoteLogging: boolean
  readonly remoteEndpoint?: string
}

/**
 * Production Logger Class
 * 
 * Handles all logging operations with proper error handling,
 * context preservation, and performance optimization
 */
export class Logger {
  private readonly config: LoggerConfig
  private readonly logs: LogEntry[] = []
  private readonly logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  }

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: 'info',
      enableConsole: true,
      enableStorage: true,
      maxStorageEntries: 1000,
      enableRemoteLogging: false,
      ...config
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context)
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context)
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context)
  }

  /**
   * Log error message
   */
  error(message: string, context?: Record<string, unknown>, error?: Error): void {
    this.log('error', message, context, error)
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel, 
    message: string, 
    context?: Record<string, unknown>, 
    error?: Error
  ): void {
    // Check if we should log this level
    if (this.logLevels[level] < this.logLevels[this.config.level]) {
      return
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context: this.sanitizeContext(context),
      error: error ? this.sanitizeError(error) : undefined,
      stack: error?.stack
    }

    // Add to in-memory logs
    this.logs.push(entry)
    this.trimLogs()

    // Console logging
    if (this.config.enableConsole) {
      this.logToConsole(entry)
    }

    // Storage logging
    if (this.config.enableStorage) {
      this.logToStorage(entry).catch(err => {
        // Don't use this.logger here to avoid infinite recursion
        console.error('Failed to log to storage:', err)
      })
    }

    // Remote logging
    if (this.config.enableRemoteLogging && this.config.remoteEndpoint) {
      this.logToRemote(entry).catch(err => {
        console.error('Failed to log to remote:', err)
      })
    }
  }

  /**
   * Log to console with appropriate formatting
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString()
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}]`
    
    const logData = {
      message: entry.message,
      ...entry.context
    }

    switch (entry.level) {
      case 'debug':
        console.debug(prefix, logData)
        break
      case 'info':
        console.info(prefix, logData)
        break
      case 'warn':
        console.warn(prefix, logData)
        break
      case 'error':
        console.error(prefix, logData, entry.error)
        break
    }
  }

  /**
   * Log to Chrome storage
   */
  private async logToStorage(entry: LogEntry): Promise<void> {
    try {
      const storageKey = `scriptflow_logs_${entry.level}`
      const existingLogs = await chrome.storage.local.get(storageKey)
      const logs = existingLogs[storageKey] || []
      
      logs.push(entry)
      
      // Keep only recent logs
      if (logs.length > this.config.maxStorageEntries) {
        logs.splice(0, logs.length - this.config.maxStorageEntries)
      }
      
      await chrome.storage.local.set({ [storageKey]: logs })
    } catch (error) {
      // Silently fail to avoid infinite recursion
      console.error('Storage logging failed:', error)
    }
  }

  /**
   * Log to remote endpoint
   */
  private async logToRemote(entry: LogEntry): Promise<void> {
    if (!this.config.remoteEndpoint) return

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry)
      })
    } catch (error) {
      // Silently fail to avoid infinite recursion
      console.error('Remote logging failed:', error)
    }
  }

  /**
   * Sanitize context data to prevent sensitive information leakage
   */
  private sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!context) return undefined

    const sanitized: Record<string, unknown> = {}
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential']

    for (const [key, value] of Object.entries(context)) {
      const lowerKey = key.toLowerCase()
      
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]'
      } else if (value instanceof Error) {
        sanitized[key] = this.sanitizeError(value)
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeContext(value as Record<string, unknown>)
      } else {
        sanitized[key] = value
      }
    }

    return sanitized
  }

  /**
   * Sanitize error object
   */
  private sanitizeError(error: Error): Error {
    const sanitized = new Error(error.message)
    sanitized.name = error.name
    sanitized.stack = error.stack
    return sanitized
  }

  /**
   * Trim logs to prevent memory leaks
   */
  private trimLogs(): void {
    if (this.logs.length > this.config.maxStorageEntries) {
      this.logs.splice(0, this.logs.length - this.config.maxStorageEntries)
    }
  }

  /**
   * Get recent logs
   */
  getLogs(level?: LogLevel, limit = 100): LogEntry[] {
    let filteredLogs = this.logs

    if (level) {
      filteredLogs = this.logs.filter(log => log.level === level)
    }

    return filteredLogs.slice(-limit)
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs.length = 0
  }

  /**
   * Export logs for debugging
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  /**
   * Update logger configuration
   */
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    Object.assign(this.config, newConfig)
  }
}

// Global logger instance
export const logger = new Logger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  enableConsole: true,
  enableStorage: true,
  maxStorageEntries: 1000
})