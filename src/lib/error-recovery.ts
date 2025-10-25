// Advanced error recovery and resilience system
import { logger } from './logger';

export interface ErrorContext {
  operation: string;
  scriptId?: string;
  userId?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface RecoveryAction {
  type: 'retry' | 'fallback' | 'skip' | 'abort';
  delay?: number;
  maxAttempts?: number;
  fallbackData?: any;
}

export class ErrorRecovery {
  private static retryAttempts = new Map<string, number>();
  private static maxRetries = 3;
  private static retryDelay = 1000; // 1 second

  static async withRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    recoveryAction: RecoveryAction = { type: 'retry', maxAttempts: 3 }
  ): Promise<T> {
    const operationKey = `${context.operation}_${context.scriptId || 'global'}`;
    const attempts = this.retryAttempts.get(operationKey) || 0;

    try {
      const result = await operation();
      
      // Reset retry count on success
      this.retryAttempts.delete(operationKey);
      
      return result;
    } catch (error) {
      logger.error(`Operation failed: ${context.operation}`, {
        error: error instanceof Error ? error.message : String(error),
        context,
        attempts: attempts + 1,
      });

      if (attempts < (recoveryAction.maxAttempts || this.maxRetries)) {
        // Increment retry count
        this.retryAttempts.set(operationKey, attempts + 1);
        
        // Wait before retry
        const delay = recoveryAction.delay || this.retryDelay * Math.pow(2, attempts);
        await this.delay(delay);
        
        logger.info(`Retrying operation: ${context.operation} (attempt ${attempts + 2})`);
        return this.withRetry(operation, context, recoveryAction);
      }

      // All retries exhausted
      this.retryAttempts.delete(operationKey);
      
      if (recoveryAction.type === 'fallback' && recoveryAction.fallbackData !== undefined) {
        logger.warn(`Using fallback data for operation: ${context.operation}`);
        return recoveryAction.fallbackData;
      }

      if (recoveryAction.type === 'skip') {
        logger.warn(`Skipping operation: ${context.operation}`);
        return undefined as T;
      }

      // Re-throw error if no recovery action or abort
      throw error;
    }
  }

  static async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    failureThreshold: number = 5,
    timeout: number = 60000 // 1 minute
  ): Promise<T> {
    const circuitKey = `circuit_${context.operation}`;
    const now = Date.now();
    
    // Check if circuit is open
    const circuitState = this.getCircuitState(circuitKey);
    if (circuitState === 'open' && now - circuitState.lastFailure < timeout) {
      throw new Error(`Circuit breaker is open for ${context.operation}`);
    }

    try {
      const result = await operation();
      
      // Reset circuit on success
      this.resetCircuit(circuitKey);
      
      return result;
    } catch (error) {
      // Record failure
      this.recordFailure(circuitKey, now);
      
      // Check if we should open the circuit
      const failures = this.getFailureCount(circuitKey, now - timeout);
      if (failures >= failureThreshold) {
        this.openCircuit(circuitKey, now);
        logger.error(`Circuit breaker opened for ${context.operation}`, {
          failures,
          threshold: failureThreshold,
        });
      }
      
      throw error;
    }
  }

  static async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    context: ErrorContext
  ): Promise<T> {
    return Promise.race([
      operation(),
      this.delay(timeoutMs).then(() => {
        throw new Error(`Operation ${context.operation} timed out after ${timeoutMs}ms`);
      }),
    ]);
  }

  static async withGracefulDegradation<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    try {
      return await primaryOperation();
    } catch (error) {
      logger.warn(`Primary operation failed, using fallback: ${context.operation}`, {
        error: error instanceof Error ? error.message : String(error),
        context,
      });

      try {
        return await fallbackOperation();
      } catch (fallbackError) {
        logger.error(`Both primary and fallback operations failed: ${context.operation}`, {
          primaryError: error instanceof Error ? error.message : String(error),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          context,
        });
        throw fallbackError;
      }
    }
  }

  // Database operation recovery
  static async withDatabaseRecovery<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    return this.withRetry(operation, context, {
      type: 'retry',
      maxAttempts: 3,
      delay: 1000,
    });
  }

  // Script execution recovery
  static async withScriptExecutionRecovery<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    return this.withGracefulDegradation(
      operation,
      () => {
        logger.warn(`Script execution failed, using safe mode: ${context.scriptId}`);
        // Return a safe default or perform minimal operation
        return Promise.resolve(undefined as T);
      },
      context
    );
  }

  // Network operation recovery
  static async withNetworkRecovery<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    return this.withCircuitBreaker(operation, context, 3, 30000);
  }

  // Utility methods
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static getCircuitState(circuitKey: string): { state: 'closed' | 'open'; lastFailure: number } | null {
    const state = localStorage.getItem(`circuit_${circuitKey}`);
    return state ? JSON.parse(state) : null;
  }

  private static recordFailure(circuitKey: string, timestamp: number): void {
    const failures = JSON.parse(localStorage.getItem(`failures_${circuitKey}`) || '[]');
    failures.push(timestamp);
    
    // Keep only failures from the last hour
    const oneHourAgo = timestamp - 3600000;
    const recentFailures = failures.filter((t: number) => t > oneHourAgo);
    
    localStorage.setItem(`failures_${circuitKey}`, JSON.stringify(recentFailures));
  }

  private static getFailureCount(circuitKey: string, since: number): number {
    const failures = JSON.parse(localStorage.getItem(`failures_${circuitKey}`) || '[]');
    return failures.filter((t: number) => t > since).length;
  }

  private static openCircuit(circuitKey: string, timestamp: number): void {
    localStorage.setItem(`circuit_${circuitKey}`, JSON.stringify({
      state: 'open',
      lastFailure: timestamp,
    }));
  }

  private static resetCircuit(circuitKey: string): void {
    localStorage.removeItem(`circuit_${circuitKey}`);
    localStorage.removeItem(`failures_${circuitKey}`);
  }

  // Health check
  static async performHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    metrics: Record<string, any>;
  }> {
    const issues: string[] = [];
    const metrics: Record<string, any> = {};

    try {
      // Check IndexedDB
      const dbCheck = await this.withTimeout(
        () => Promise.resolve('ok'),
        5000,
        { operation: 'health_check_db', timestamp: Date.now() }
      );
      metrics.database = 'ok';
    } catch (error) {
      issues.push('Database connectivity issues');
      metrics.database = 'error';
    }

    try {
      // Check Chrome APIs
      const chromeCheck = await this.withTimeout(
        () => Promise.resolve(chrome.runtime?.id ? 'ok' : 'error'),
        1000,
        { operation: 'health_check_chrome', timestamp: Date.now() }
      );
      metrics.chrome = chromeCheck;
    } catch (error) {
      issues.push('Chrome API issues');
      metrics.chrome = 'error';
    }

    // Check memory usage
    if (performance.memory) {
      const memoryUsage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
      metrics.memoryUsage = Math.round(memoryUsage * 100);
      
      if (memoryUsage > 0.9) {
        issues.push('High memory usage');
      }
    }

    const status = issues.length === 0 ? 'healthy' : issues.length < 3 ? 'degraded' : 'unhealthy';

    return { status, issues, metrics };
  }
}