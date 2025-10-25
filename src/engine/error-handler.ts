/**
 * Error Handler for ScriptFlow
 * 
 * Comprehensive error detection, logging, and recovery for script execution.
 * Implements retry logic, error categorization, and failure tracking.
 * 
 * @fileoverview Production-grade error handling with recovery strategies
 */

import { Logger } from '../lib/logger';
import type { ExecutionContext } from './execution-context';

/**
 * Error categories for classification
 */
export type ErrorCategory = 
  | 'validation'      // Script validation errors
  | 'security'        // Security/CSP violations
  | 'execution'       // Runtime execution errors
  | 'timeout'         // Execution timeout errors
  | 'permission'      // Permission denied errors
  | 'network'         // Network-related errors
  | 'memory'          // Memory-related errors
  | 'chrome_api'      // Chrome API errors
  | 'unknown';        // Unknown errors

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Script execution error
 */
export interface ScriptExecutionError {
  readonly id: string;
  readonly scriptId: string;
  readonly tabId: number;
  readonly executionId: string;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly message: string;
  readonly stack?: string;
  readonly timestamp: number;
  readonly retryCount: number;
  readonly maxRetries: number;
  readonly canRetry: boolean;
  readonly context: Record<string, unknown>;
}

/**
 * Error recovery strategy
 */
export interface ErrorRecoveryStrategy {
  readonly canRetry: boolean;
  readonly retryDelay: number;
  readonly maxRetries: number;
  readonly fallbackAction: 'skip' | 'disable_script' | 'disable_tab' | 'report';
}

/**
 * Error statistics
 */
export interface ErrorStatistics {
  readonly totalErrors: number;
  readonly errorsByCategory: Record<ErrorCategory, number>;
  readonly errorsBySeverity: Record<ErrorSeverity, number>;
  readonly retrySuccessRate: number;
  readonly criticalErrors: number;
  readonly lastErrorTime: number;
}

/**
 * Error Handler class
 */
export class ErrorHandler {
  private static instance: ErrorHandler | null = null;
  private readonly logger: Logger;
  private readonly errors: Map<string, ScriptExecutionError>;
  private readonly errorPatterns: Map<ErrorCategory, RegExp[]>;
  private readonly recoveryStrategies: Map<ErrorCategory, ErrorRecoveryStrategy>;
  private readonly maxErrors: number = 10000;
  private readonly errorRetentionTime: number = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {
    this.logger = new Logger('ErrorHandler');
    this.errors = new Map();
    
    // Initialize error patterns for categorization
    this.errorPatterns = new Map([
      ['validation', [
        /script validation failed/i,
        /invalid script code/i,
        /malformed script/i,
      ]],
      ['security', [
        /csp violation/i,
        /content security policy/i,
        /eval not allowed/i,
        /inline script/i,
        /unsafe-eval/i,
      ]],
      ['execution', [
        /script error/i,
        /runtime error/i,
        /syntax error/i,
        /reference error/i,
        /type error/i,
      ]],
      ['timeout', [
        /execution timeout/i,
        /script timeout/i,
        /operation timeout/i,
      ]],
      ['permission', [
        /permission denied/i,
        /access denied/i,
        /insufficient permissions/i,
        /blocked by browser/i,
      ]],
      ['network', [
        /network error/i,
        /fetch failed/i,
        /connection error/i,
        /dns error/i,
      ]],
      ['memory', [
        /out of memory/i,
        /memory limit exceeded/i,
        /heap overflow/i,
        /stack overflow/i,
      ]],
      ['chrome_api', [
        /chrome\./i,
        /extension error/i,
        /chrome runtime error/i,
        /chrome scripting error/i,
      ]],
    ]);

    // Initialize recovery strategies
    this.recoveryStrategies = new Map([
      ['validation', {
        canRetry: false,
        retryDelay: 0,
        maxRetries: 0,
        fallbackAction: 'disable_script',
      }],
      ['security', {
        canRetry: false,
        retryDelay: 0,
        maxRetries: 0,
        fallbackAction: 'disable_script',
      }],
      ['execution', {
        canRetry: true,
        retryDelay: 1000,
        maxRetries: 3,
        fallbackAction: 'skip',
      }],
      ['timeout', {
        canRetry: true,
        retryDelay: 2000,
        maxRetries: 2,
        fallbackAction: 'skip',
      }],
      ['permission', {
        canRetry: false,
        retryDelay: 0,
        maxRetries: 0,
        fallbackAction: 'report',
      }],
      ['network', {
        canRetry: true,
        retryDelay: 5000,
        maxRetries: 3,
        fallbackAction: 'skip',
      }],
      ['memory', {
        canRetry: false,
        retryDelay: 0,
        maxRetries: 0,
        fallbackAction: 'disable_script',
      }],
      ['chrome_api', {
        canRetry: true,
        retryDelay: 1000,
        maxRetries: 2,
        fallbackAction: 'skip',
      }],
      ['unknown', {
        canRetry: true,
        retryDelay: 1000,
        maxRetries: 1,
        fallbackAction: 'skip',
      }],
    ]);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle script execution error
   */
  public async handleError(
    error: Error,
    context: ExecutionContext,
    additionalContext: Record<string, unknown> = {}
  ): Promise<ScriptExecutionError> {
    const errorId = this.generateErrorId();
    const category = this.categorizeError(error);
    const severity = this.determineSeverity(error, category);
    const strategy = this.recoveryStrategies.get(category) || this.recoveryStrategies.get('unknown')!;

    const scriptError: ScriptExecutionError = {
      id: errorId,
      scriptId: context.scriptId,
      tabId: context.tabId,
      executionId: context.executionId,
      category,
      severity,
      message: error.message || 'Unknown error',
      stack: error.stack,
      timestamp: Date.now(),
      retryCount: context.retryCount,
      maxRetries: context.maxRetries,
      canRetry: strategy.canRetry && context.retryCount < strategy.maxRetries,
      context: {
        ...additionalContext,
        url: context.url,
        runAt: context.runAt,
        world: context.world,
      },
    };

    // Store error
    this.storeError(scriptError);

    // Log error
    this.logError(scriptError);

    // Execute recovery strategy
    await this.executeRecoveryStrategy(scriptError, strategy);

    return scriptError;
  }

  /**
   * Check if error should be retried
   */
  public shouldRetryError(error: ScriptExecutionError): boolean {
    return error.canRetry && error.retryCount < error.maxRetries;
  }

  /**
   * Get retry delay for error
   */
  public getRetryDelay(error: ScriptExecutionError): number {
    const strategy = this.recoveryStrategies.get(error.category);
    return strategy?.retryDelay || 1000;
  }

  /**
   * Get error by ID
   */
  public getError(errorId: string): ScriptExecutionError | null {
    return this.errors.get(errorId) || null;
  }

  /**
   * Get errors for script
   */
  public getErrorsForScript(scriptId: string): ScriptExecutionError[] {
    const errors: ScriptExecutionError[] = [];
    for (const error of this.errors.values()) {
      if (error.scriptId === scriptId) {
        errors.push(error);
      }
    }
    return errors.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get errors for tab
   */
  public getErrorsForTab(tabId: number): ScriptExecutionError[] {
    const errors: ScriptExecutionError[] = [];
    for (const error of this.errors.values()) {
      if (error.tabId === tabId) {
        errors.push(error);
      }
    }
    return errors.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get error statistics
   */
  public getErrorStatistics(): ErrorStatistics {
    const errors = Array.from(this.errors.values());
    const now = Date.now();
    
    // Filter recent errors (last 24 hours)
    const recentErrors = errors.filter(error => now - error.timestamp < this.errorRetentionTime);
    
    const errorsByCategory: Record<ErrorCategory, number> = {
      validation: 0,
      security: 0,
      execution: 0,
      timeout: 0,
      permission: 0,
      network: 0,
      memory: 0,
      chrome_api: 0,
      unknown: 0,
    };

    const errorsBySeverity: Record<ErrorSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    let retrySuccesses = 0;
    let totalRetries = 0;
    let criticalErrors = 0;

    for (const error of recentErrors) {
      errorsByCategory[error.category]++;
      errorsBySeverity[error.severity]++;
      
      if (error.severity === 'critical') {
        criticalErrors++;
      }
      
      if (error.retryCount > 0) {
        totalRetries++;
        if (error.retryCount < error.maxRetries) {
          retrySuccesses++;
        }
      }
    }

    const retrySuccessRate = totalRetries > 0 ? (retrySuccesses / totalRetries) * 100 : 0;
    const lastErrorTime = errors.length > 0 ? Math.max(...errors.map(e => e.timestamp)) : 0;

    return {
      totalErrors: recentErrors.length,
      errorsByCategory,
      errorsBySeverity,
      retrySuccessRate,
      criticalErrors,
      lastErrorTime,
    };
  }

  /**
   * Clear old errors
   */
  public clearOldErrors(): void {
    const now = Date.now();
    const cutoffTime = now - this.errorRetentionTime;
    
    for (const [errorId, error] of this.errors.entries()) {
      if (error.timestamp < cutoffTime) {
        this.errors.delete(errorId);
      }
    }
    
    this.logger.info('Cleared old errors', { 
      remainingErrors: this.errors.size 
    });
  }

  /**
   * Clear all errors
   */
  public clearAllErrors(): void {
    this.errors.clear();
    this.logger.info('Cleared all errors');
  }

  /**
   * Categorize error based on message and stack
   */
  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    for (const [category, patterns] of this.errorPatterns.entries()) {
      for (const pattern of patterns) {
        if (pattern.test(message) || pattern.test(stack)) {
          return category;
        }
      }
    }

    return 'unknown';
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
    // Critical errors
    if (category === 'security' || category === 'memory') {
      return 'critical';
    }

    // High severity errors
    if (category === 'validation' || category === 'permission') {
      return 'high';
    }

    // Medium severity errors
    if (category === 'execution' || category === 'timeout') {
      return 'medium';
    }

    // Low severity errors
    if (category === 'network' || category === 'chrome_api') {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Store error
   */
  private storeError(error: ScriptExecutionError): void {
    // Check storage limits
    if (this.errors.size >= this.maxErrors) {
      // Remove oldest error
      const oldestError = Array.from(this.errors.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0];
      this.errors.delete(oldestError[0]);
    }

    this.errors.set(error.id, error);
  }

  /**
   * Log error
   */
  private logError(error: ScriptExecutionError): void {
    const logLevel = this.getLogLevel(error.severity);
    const logData = {
      errorId: error.id,
      scriptId: error.scriptId,
      tabId: error.tabId,
      category: error.category,
      severity: error.severity,
      message: error.message,
      retryCount: error.retryCount,
      canRetry: error.canRetry,
    };

    switch (logLevel) {
      case 'error':
        this.logger.error('Script execution error', logData);
        break;
      case 'warn':
        this.logger.warn('Script execution warning', logData);
        break;
      case 'info':
        this.logger.info('Script execution info', logData);
        break;
      default:
        this.logger.debug('Script execution debug', logData);
    }
  }

  /**
   * Execute recovery strategy
   */
  private async executeRecoveryStrategy(
    error: ScriptExecutionError,
    strategy: ErrorRecoveryStrategy
  ): Promise<void> {
    switch (strategy.fallbackAction) {
      case 'disable_script':
        this.logger.warn('Disabling script due to error', {
          scriptId: error.scriptId,
          category: error.category,
        });
        // TODO: Implement script disabling
        break;
        
      case 'disable_tab':
        this.logger.warn('Disabling script execution for tab', {
          tabId: error.tabId,
          category: error.category,
        });
        // TODO: Implement tab disabling
        break;
        
      case 'report':
        this.logger.error('Critical error requiring user attention', {
          scriptId: error.scriptId,
          tabId: error.tabId,
          category: error.category,
        });
        // TODO: Implement error reporting
        break;
        
      case 'skip':
      default:
        this.logger.debug('Skipping script execution', {
          scriptId: error.scriptId,
          category: error.category,
        });
        break;
    }
  }

  /**
   * Get log level for severity
   */
  private getLogLevel(severity: ErrorSeverity): 'debug' | 'info' | 'warn' | 'error' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      case 'low':
        return 'info';
      default:
        return 'debug';
    }
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();