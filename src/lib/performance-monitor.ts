// Performance monitoring and analytics system
import { logger } from './logger';
import { db } from './database';
import { ScriptAnalytics } from '@/types';

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PerformanceReport {
  timestamp: number;
  metrics: PerformanceMetric[];
  summary: {
    averageExecutionTime: number;
    totalExecutions: number;
    errorRate: number;
    memoryUsage: number;
    cacheHitRate: number;
  };
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetric[] = [];
  private static maxMetrics = 1000;
  private static isEnabled = true;

  static startTiming(operation: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(operation, duration);
    };
  }

  static recordMetric(name: string, value: number, metadata?: Record<string, any>): void {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      metadata,
    };

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log significant performance issues
    if (name.includes('execution') && value > 1000) {
      logger.warn(`Slow operation detected: ${name} took ${value.toFixed(2)}ms`, {
        metric,
      });
    }
  }

  static async recordScriptExecution(
    scriptId: string,
    executionTime: number,
    success: boolean,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const analytics: ScriptAnalytics = {
        id: 0, // Auto-increment
        scriptId,
        metric: 'execution_time',
        value: executionTime,
        timestamp: Date.now(),
        metadata: {
          success,
          ...metadata,
        },
      };

      await db.analytics.add(analytics);
    } catch (error) {
      logger.error('Failed to record script execution analytics', { error });
    }
  }

  static async recordMemoryUsage(): Promise<void> {
    if (!performance.memory) return;

    const memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024; // MB
    this.recordMetric('memory_usage', memoryUsage, {
      totalJSHeapSize: performance.memory.totalJSHeapSize / 1024 / 1024,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit / 1024 / 1024,
    });
  }

  static async recordCacheHitRate(hitRate: number): Promise<void> {
    this.recordMetric('cache_hit_rate', hitRate);
  }

  static async recordDatabaseOperation(
    operation: string,
    duration: number,
    recordCount: number
  ): Promise<void> {
    this.recordMetric(`db_${operation}`, duration, { recordCount });
  }

  static getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.filter(m => m.name === name);
    }
    return [...this.metrics];
  }

  static getRecentMetrics(minutes: number = 5): PerformanceMetric[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  static async generateReport(): Promise<PerformanceReport> {
    const recentMetrics = this.getRecentMetrics(60); // Last hour
    const executionMetrics = recentMetrics.filter(m => m.name.includes('execution'));
    const errorMetrics = recentMetrics.filter(m => m.metadata?.success === false);
    const memoryMetrics = recentMetrics.filter(m => m.name === 'memory_usage');
    const cacheMetrics = recentMetrics.filter(m => m.name === 'cache_hit_rate');

    const averageExecutionTime = executionMetrics.length > 0
      ? executionMetrics.reduce((sum, m) => sum + m.value, 0) / executionMetrics.length
      : 0;

    const totalExecutions = executionMetrics.length;
    const errorRate = totalExecutions > 0 ? errorMetrics.length / totalExecutions : 0;
    
    const memoryUsage = memoryMetrics.length > 0
      ? memoryMetrics[memoryMetrics.length - 1].value
      : 0;

    const cacheHitRate = cacheMetrics.length > 0
      ? cacheMetrics.reduce((sum, m) => sum + m.value, 0) / cacheMetrics.length
      : 0;

    return {
      timestamp: Date.now(),
      metrics: recentMetrics,
      summary: {
        averageExecutionTime: Math.round(averageExecutionTime * 100) / 100,
        totalExecutions,
        errorRate: Math.round(errorRate * 100) / 100,
        memoryUsage: Math.round(memoryUsage * 100) / 100,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      },
    };
  }

  static async exportMetrics(): Promise<string> {
    const report = await this.generateReport();
    return JSON.stringify(report, null, 2);
  }

  static clearMetrics(): void {
    this.metrics = [];
  }

  static setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  // Performance optimization suggestions
  static async getOptimizationSuggestions(): Promise<string[]> {
    const suggestions: string[] = [];
    const report = await this.generateReport();

    if (report.summary.averageExecutionTime > 500) {
      suggestions.push('Consider optimizing script execution - average time is high');
    }

    if (report.summary.errorRate > 0.1) {
      suggestions.push('High error rate detected - review script code and error handling');
    }

    if (report.summary.memoryUsage > 100) {
      suggestions.push('High memory usage detected - consider implementing memory cleanup');
    }

    if (report.summary.cacheHitRate < 0.5) {
      suggestions.push('Low cache hit rate - consider improving caching strategy');
    }

    return suggestions;
  }

  // Automatic performance monitoring
  static startMonitoring(): void {
    // Monitor memory usage every 30 seconds
    setInterval(() => {
      this.recordMemoryUsage();
    }, 30000);

    // Generate performance report every 5 minutes
    setInterval(async () => {
      const report = await this.generateReport();
      logger.info('Performance report generated', { summary: report.summary });
    }, 300000);

    // Check for optimization opportunities every 10 minutes
    setInterval(async () => {
      const suggestions = await this.getOptimizationSuggestions();
      if (suggestions.length > 0) {
        logger.warn('Performance optimization suggestions', { suggestions });
      }
    }, 600000);
  }
}