/**
 * ScriptFlow Script Execution Engine
 * 
 * Main entry point for the script execution engine that coordinates
 * all execution components and provides a unified API.
 * 
 * @fileoverview Production-grade script execution engine with full integration
 */

export { ScriptExecutor, scriptExecutor } from './script-executor';
export { UrlMatcher, urlMatcher } from './url-matcher';
export { ScriptValidator, scriptValidator } from './script-validator';
export { ExecutionContextManager, executionContextManager } from './execution-context';
export { ErrorHandler, errorHandler } from './error-handler';
export { PerformanceMonitor, performanceMonitor } from './performance-monitor';

// Re-export types
export type { ScriptExecutionRequest, ScriptExecutionResponse, ExecutionStatistics } from './script-executor';
export type { PatternValidationResult, UrlMatchResult } from './url-matcher';
export type { ScriptValidationResult, SecurityAnalysis } from './script-validator';
export type { ExecutionContext, TabState, ExecutionTiming } from './execution-context';
export type { ScriptExecutionError, ErrorRecoveryStrategy, ErrorStatistics } from './error-handler';
export type { ExecutionMetrics, PerformanceLimits, PerformanceStatistics, PerformanceWarning } from './performance-monitor';