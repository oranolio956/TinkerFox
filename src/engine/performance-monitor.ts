/**
 * Performance Monitor for ScriptFlow
 * 
 * Monitors script execution performance, memory usage, and execution limits.
 * Implements performance-based script blocking and optimization suggestions.
 * 
 * @fileoverview Production-grade performance monitoring and optimization
 */

import { Logger } from '../lib/logger';
import type { ExecutionContext } from './execution-context';

/**
 * Performance metrics for a script execution
 */
export interface ExecutionMetrics {
  readonly executionId: string;
  readonly scriptId: string;
  readonly tabId: number;
  readonly startTime: number;
  readonly endTime: number;
  readonly executionTime: number;
  readonly memoryUsage: number;
  readonly cpuTime: number;
  readonly success: boolean;
  readonly errorType?: string;
}

/**
 * Performance limits configuration
 */
export interface PerformanceLimits {
  readonly maxExecutionTime: number;        // Max execution time in ms
  readonly maxMemoryUsage: number;         // Max memory usage in MB
  readonly maxCpuTime: number;             // Max CPU time in ms
  readonly maxConcurrentExecutions: number; // Max concurrent executions per tab
  readonly maxTotalExecutions: number;     // Max total executions per hour
  readonly performanceThreshold: number;   // Performance threshold (0-1)
}

/**
 * Performance statistics
 */
export interface PerformanceStatistics {
  readonly totalExecutions: number;
  readonly successfulExecutions: number;
  readonly failedExecutions: number;
  readonly averageExecutionTime: number;
  readonly averageMemoryUsage: number;
  readonly slowestExecution: number;
  readonly fastestExecution: number;
  readonly performanceScore: number; // 0-100
  readonly memoryEfficiency: number; // 0-100
  readonly executionEfficiency: number; // 0-100
}

/**
 * Performance warning
 */
export interface PerformanceWarning {
  readonly type: 'slow_execution' | 'high_memory' | 'frequent_failures' | 'resource_exhaustion';
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly message: string;
  readonly scriptId: string;
  readonly timestamp: number;
  readonly metrics: ExecutionMetrics;
  readonly recommendation: string;
}

/**
 * Performance Monitor class
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor | null = null;
  private readonly logger: Logger;
  private readonly metrics: Map<string, ExecutionMetrics>;
  private readonly warnings: Map<string, PerformanceWarning>;
  private readonly limits: PerformanceLimits;
  private readonly maxMetrics: number = 10000;
  private readonly maxWarnings: number = 1000;
  private readonly performanceHistory: ExecutionMetrics[];

  private constructor() {
    this.logger = new Logger('PerformanceMonitor');
    this.metrics = new Map();
    this.warnings = new Map();
    this.performanceHistory = [];
    
    this.limits = {
      maxExecutionTime: 30000,        // 30 seconds
      maxMemoryUsage: 100,            // 100 MB
      maxCpuTime: 10000,              // 10 seconds
      maxConcurrentExecutions: 10,    // 10 concurrent per tab
      maxTotalExecutions: 1000,       // 1000 per hour
      performanceThreshold: 0.8,      // 80% performance threshold
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start monitoring script execution
   */
  public startMonitoring(context: ExecutionContext): string {
    const monitoringId = this.generateMonitoringId();
    const startTime = performance.now();
    
    this.logger.debug('Started performance monitoring', {
      monitoringId,
      scriptId: context.scriptId,
      tabId: context.tabId,
    });

    return monitoringId;
  }

  /**
   * End monitoring and record metrics
   */
  public endMonitoring(
    monitoringId: string,
    context: ExecutionContext,
    success: boolean,
    errorType?: string
  ): ExecutionMetrics {
    const endTime = performance.now();
    const startTime = endTime - (performance.now() - endTime); // Approximate start time
    
    const metrics: ExecutionMetrics = {
      executionId: context.executionId,
      scriptId: context.scriptId,
      tabId: context.tabId,
      startTime,
      endTime,
      executionTime: endTime - startTime,
      memoryUsage: this.getMemoryUsage(),
      cpuTime: this.getCpuTime(),
      success,
      errorType,
    };

    this.recordMetrics(metrics);
    this.checkPerformanceLimits(metrics);
    this.updatePerformanceHistory(metrics);

    this.logger.debug('Ended performance monitoring', {
      monitoringId,
      executionTime: metrics.executionTime,
      memoryUsage: metrics.memoryUsage,
      success,
    });

    return metrics;
  }

  /**
   * Check if script execution should be allowed based on performance
   */
  public shouldAllowExecution(scriptId: string, tabId: number): boolean {
    // Check concurrent execution limit
    const concurrentCount = this.getConcurrentExecutions(tabId);
    if (concurrentCount >= this.limits.maxConcurrentExecutions) {
      this.logger.warn('Blocking execution: too many concurrent executions', {
        scriptId,
        tabId,
        concurrentCount,
        limit: this.limits.maxConcurrentExecutions,
      });
      return false;
    }

    // Check total execution limit
    const totalCount = this.getTotalExecutionsLastHour();
    if (totalCount >= this.limits.maxTotalExecutions) {
      this.logger.warn('Blocking execution: too many total executions', {
        scriptId,
        totalCount,
        limit: this.limits.maxTotalExecutions,
      });
      return false;
    }

    // Check script-specific performance
    const scriptMetrics = this.getScriptMetrics(scriptId);
    if (scriptMetrics.length > 0) {
      const avgExecutionTime = this.calculateAverageExecutionTime(scriptMetrics);
      const avgMemoryUsage = this.calculateAverageMemoryUsage(scriptMetrics);
      
      if (avgExecutionTime > this.limits.maxExecutionTime) {
        this.logger.warn('Blocking execution: script too slow', {
          scriptId,
          avgExecutionTime,
          limit: this.limits.maxExecutionTime,
        });
        return false;
      }

      if (avgMemoryUsage > this.limits.maxMemoryUsage) {
        this.logger.warn('Blocking execution: script uses too much memory', {
          scriptId,
          avgMemoryUsage,
          limit: this.limits.maxMemoryUsage,
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStatistics(): PerformanceStatistics {
    const recentMetrics = this.getRecentMetrics(24 * 60 * 60 * 1000); // Last 24 hours
    const totalExecutions = recentMetrics.length;
    const successfulExecutions = recentMetrics.filter(m => m.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;
    
    const executionTimes = recentMetrics.map(m => m.executionTime);
    const memoryUsages = recentMetrics.map(m => m.memoryUsage);
    
    const averageExecutionTime = executionTimes.length > 0 
      ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length 
      : 0;
    
    const averageMemoryUsage = memoryUsages.length > 0 
      ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length 
      : 0;
    
    const slowestExecution = executionTimes.length > 0 ? Math.max(...executionTimes) : 0;
    const fastestExecution = executionTimes.length > 0 ? Math.min(...executionTimes) : 0;
    
    const performanceScore = this.calculatePerformanceScore(recentMetrics);
    const memoryEfficiency = this.calculateMemoryEfficiency(recentMetrics);
    const executionEfficiency = this.calculateExecutionEfficiency(recentMetrics);

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime,
      averageMemoryUsage,
      slowestExecution,
      fastestExecution,
      performanceScore,
      memoryEfficiency,
      executionEfficiency,
    };
  }

  /**
   * Get performance warnings
   */
  public getPerformanceWarnings(): PerformanceWarning[] {
    return Array.from(this.warnings.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Clear old metrics and warnings
   */
  public clearOldData(): void {
    const now = Date.now();
    const cutoffTime = now - (24 * 60 * 60 * 1000); // 24 hours ago

    // Clear old metrics
    for (const [id, metric] of this.metrics.entries()) {
      if (metric.endTime < cutoffTime) {
        this.metrics.delete(id);
      }
    }

    // Clear old warnings
    for (const [id, warning] of this.warnings.entries()) {
      if (warning.timestamp < cutoffTime) {
        this.warnings.delete(id);
      }
    }

    // Clear old performance history
    const historyIndex = this.performanceHistory.findIndex(m => m.endTime >= cutoffTime);
    if (historyIndex > 0) {
      this.performanceHistory.splice(0, historyIndex);
    }

    this.logger.info('Cleared old performance data', {
      remainingMetrics: this.metrics.size,
      remainingWarnings: this.warnings.size,
      remainingHistory: this.performanceHistory.length,
    });
  }

  /**
   * Record execution metrics
   */
  private recordMetrics(metrics: ExecutionMetrics): void {
    // Check storage limits
    if (this.metrics.size >= this.maxMetrics) {
      // Remove oldest metric
      const oldestMetric = Array.from(this.metrics.entries())
        .sort(([, a], [, b]) => a.endTime - b.endTime)[0];
      this.metrics.delete(oldestMetric[0]);
    }

    this.metrics.set(metrics.executionId, metrics);
  }

  /**
   * Check performance limits and generate warnings
   */
  private checkPerformanceLimits(metrics: ExecutionMetrics): void {
    const warnings: PerformanceWarning[] = [];

    // Check execution time
    if (metrics.executionTime > this.limits.maxExecutionTime) {
      warnings.push({
        type: 'slow_execution',
        severity: this.getSeverity(metrics.executionTime, this.limits.maxExecutionTime),
        message: `Script execution took ${metrics.executionTime}ms (limit: ${this.limits.maxExecutionTime}ms)`,
        scriptId: metrics.scriptId,
        timestamp: Date.now(),
        metrics,
        recommendation: 'Consider optimizing the script or breaking it into smaller chunks',
      });
    }

    // Check memory usage
    if (metrics.memoryUsage > this.limits.maxMemoryUsage) {
      warnings.push({
        type: 'high_memory',
        severity: this.getSeverity(metrics.memoryUsage, this.limits.maxMemoryUsage),
        message: `Script used ${metrics.memoryUsage}MB of memory (limit: ${this.limits.maxMemoryUsage}MB)`,
        scriptId: metrics.scriptId,
        timestamp: Date.now(),
        metrics,
        recommendation: 'Consider reducing memory usage or implementing cleanup logic',
      });
    }

    // Check for frequent failures
    const scriptMetrics = this.getScriptMetrics(metrics.scriptId);
    if (scriptMetrics.length >= 5) {
      const failureRate = scriptMetrics.filter(m => !m.success).length / scriptMetrics.length;
      if (failureRate > 0.5) {
        warnings.push({
          type: 'frequent_failures',
          severity: failureRate > 0.8 ? 'critical' : 'high',
          message: `Script has ${(failureRate * 100).toFixed(1)}% failure rate`,
          scriptId: metrics.scriptId,
          timestamp: Date.now(),
          metrics,
          recommendation: 'Review script code for errors and implement proper error handling',
        });
      }
    }

    // Store warnings
    for (const warning of warnings) {
      this.storeWarning(warning);
    }
  }

  /**
   * Update performance history
   */
  private updatePerformanceHistory(metrics: ExecutionMetrics): void {
    this.performanceHistory.push(metrics);
    
    // Keep only last 1000 entries
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory.shift();
    }
  }

  /**
   * Get recent metrics within time window
   */
  private getRecentMetrics(timeWindow: number): ExecutionMetrics[] {
    const cutoffTime = Date.now() - timeWindow;
    return Array.from(this.metrics.values())
      .filter(m => m.endTime >= cutoffTime);
  }

  /**
   * Get script-specific metrics
   */
  private getScriptMetrics(scriptId: string): ExecutionMetrics[] {
    return Array.from(this.metrics.values())
      .filter(m => m.scriptId === scriptId);
  }

  /**
   * Get concurrent executions for tab
   */
  private getConcurrentExecutions(tabId: number): number {
    const now = Date.now();
    return Array.from(this.metrics.values())
      .filter(m => m.tabId === tabId && (now - m.startTime) < 60000) // Last minute
      .length;
  }

  /**
   * Get total executions in last hour
   */
  private getTotalExecutionsLastHour(): number {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    return Array.from(this.metrics.values())
      .filter(m => m.endTime >= oneHourAgo).length;
  }

  /**
   * Calculate average execution time
   */
  private calculateAverageExecutionTime(metrics: ExecutionMetrics[]): number {
    if (metrics.length === 0) return 0;
    const totalTime = metrics.reduce((sum, m) => sum + m.executionTime, 0);
    return totalTime / metrics.length;
  }

  /**
   * Calculate average memory usage
   */
  private calculateAverageMemoryUsage(metrics: ExecutionMetrics[]): number {
    if (metrics.length === 0) return 0;
    const totalMemory = metrics.reduce((sum, m) => sum + m.memoryUsage, 0);
    return totalMemory / metrics.length;
  }

  /**
   * Calculate performance score (0-100)
   */
  private calculatePerformanceScore(metrics: ExecutionMetrics[]): number {
    if (metrics.length === 0) return 100;
    
    const successRate = metrics.filter(m => m.success).length / metrics.length;
    const avgExecutionTime = this.calculateAverageExecutionTime(metrics);
    const timeScore = Math.max(0, 1 - (avgExecutionTime / this.limits.maxExecutionTime));
    
    return Math.round((successRate * 0.7 + timeScore * 0.3) * 100);
  }

  /**
   * Calculate memory efficiency (0-100)
   */
  private calculateMemoryEfficiency(metrics: ExecutionMetrics[]): number {
    if (metrics.length === 0) return 100;
    
    const avgMemoryUsage = this.calculateAverageMemoryUsage(metrics);
    const memoryScore = Math.max(0, 1 - (avgMemoryUsage / this.limits.maxMemoryUsage));
    
    return Math.round(memoryScore * 100);
  }

  /**
   * Calculate execution efficiency (0-100)
   */
  private calculateExecutionEfficiency(metrics: ExecutionMetrics[]): number {
    if (metrics.length === 0) return 100;
    
    const successRate = metrics.filter(m => m.success).length / metrics.length;
    return Math.round(successRate * 100);
  }

  /**
   * Get severity level based on ratio
   */
  private getSeverity(value: number, limit: number): 'low' | 'medium' | 'high' | 'critical' {
    const ratio = value / limit;
    if (ratio >= 2) return 'critical';
    if (ratio >= 1.5) return 'high';
    if (ratio >= 1.2) return 'medium';
    return 'low';
  }

  /**
   * Store performance warning
   */
  private storeWarning(warning: PerformanceWarning): void {
    const warningId = this.generateWarningId();
    
    // Check storage limits
    if (this.warnings.size >= this.maxWarnings) {
      // Remove oldest warning
      const oldestWarning = Array.from(this.warnings.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0];
      this.warnings.delete(oldestWarning[0]);
    }

    this.warnings.set(warningId, warning);
    
    this.logger.warn('Performance warning generated', {
      warningId,
      type: warning.type,
      severity: warning.severity,
      scriptId: warning.scriptId,
    });
  }

  /**
   * Get current memory usage (approximation)
   */
  private getMemoryUsage(): number {
    // This is a simplified approximation
    // In a real implementation, you'd use performance.memory if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
    }
    return 0;
  }

  /**
   * Get CPU time (approximation)
   */
  private getCpuTime(): number {
    // This is a simplified approximation
    // In a real implementation, you'd use more sophisticated CPU time measurement
    return performance.now();
  }

  /**
   * Generate unique monitoring ID
   */
  private generateMonitoringId(): string {
    return `monitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique warning ID
   */
  private generateWarningId(): string {
    return `warning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();