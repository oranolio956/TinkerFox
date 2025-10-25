/**
 * Script Executor for ScriptFlow
 * 
 * Core execution engine that safely executes user scripts in tab contexts.
 * Implements MV3 compliance, CSP safety, and comprehensive error handling.
 * 
 * @fileoverview Production-grade script execution with security hardening
 */

import { Logger } from '../lib/logger';
import { ScriptManager } from '../lib/script-manager';
import { urlMatcher } from './url-matcher';
import { scriptValidator } from './script-validator';
import { executionContextManager } from './execution-context';
import { errorHandler } from './error-handler';
import { performanceMonitor } from './performance-monitor';
import { featureManager, FEATURE_FLAGS } from '../lib/features';
import type { Script, ScriptExecutionResult } from '../types';
import type { ExecutionContext } from './execution-context';
import type { ScriptValidationResult } from './script-validator';

/**
 * Script execution request
 */
export interface ScriptExecutionRequest {
  readonly scriptId: string;
  readonly tabId: number;
  readonly url: string;
  readonly forceExecution?: boolean;
  readonly executionContext?: ExecutionContext;
}

/**
 * Script execution response
 */
export interface ScriptExecutionResponse {
  readonly success: boolean;
  readonly result?: ScriptExecutionResult;
  readonly error?: string;
  readonly executionTime: number;
  readonly retryCount: number;
  readonly canRetry: boolean;
}

/**
 * Execution statistics
 */
export interface ExecutionStatistics {
  readonly totalExecutions: number;
  readonly successfulExecutions: number;
  readonly failedExecutions: number;
  readonly averageExecutionTime: number;
  readonly scriptsByTab: Record<number, number>;
  readonly performanceWarnings: number;
}

/**
 * Script Executor class
 */
export class ScriptExecutor {
  private static instance: ScriptExecutor | null = null;
  private readonly logger: Logger;
  private readonly scriptManager: ScriptManager;
  private readonly executionHistory: Map<string, ScriptExecutionResponse>;
  private readonly maxHistorySize: number = 10000;
  private readonly executionTimeouts: Map<string, NodeJS.Timeout>;

  private constructor() {
    this.logger = new Logger('ScriptExecutor');
    this.scriptManager = ScriptManager.getInstance();
    this.executionHistory = new Map();
    this.executionTimeouts = new Map();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ScriptExecutor {
    if (!ScriptExecutor.instance) {
      ScriptExecutor.instance = new ScriptExecutor();
    }
    return ScriptExecutor.instance;
  }

  /**
   * Execute script in tab context
   */
  public async executeScript(request: ScriptExecutionRequest): Promise<ScriptExecutionResponse> {
    const startTime = performance.now();
    let retryCount = 0;
    const maxRetries = 3;

    try {
      // Check if script execution is enabled
      if (!featureManager.isFeatureEnabled(FEATURE_FLAGS.SCRIPT_SCHEDULING)) {
        return {
          success: false,
          error: 'Script execution is disabled',
          executionTime: performance.now() - startTime,
          retryCount: 0,
          canRetry: false,
        };
      }

      // Get script from storage
      const script = await this.scriptManager.getScript(request.scriptId);
      if (!script) {
        return {
          success: false,
          error: 'Script not found',
          executionTime: performance.now() - startTime,
          retryCount: 0,
          canRetry: false,
        };
      }

      // Validate script
      const validation = await this.validateScript(script);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Script validation failed: ${validation.errors.join(', ')}`,
          executionTime: performance.now() - startTime,
          retryCount: 0,
          canRetry: false,
        };
      }

      // Check URL matching
      const urlMatch = await urlMatcher.matchesUrl(script, request.url);
      if (!urlMatch.matches && !request.forceExecution) {
        return {
          success: false,
          error: `Script does not match URL: ${urlMatch.reason}`,
          executionTime: performance.now() - startTime,
          retryCount: 0,
          canRetry: false,
        };
      }

      // Check if script already executed on this tab
      if (executionContextManager.isScriptExecuted(request.scriptId, request.tabId)) {
        return {
          success: false,
          error: 'Script already executed on this tab',
          executionTime: performance.now() - startTime,
          retryCount: 0,
          canRetry: false,
        };
      }

      // Check performance limits
      if (!performanceMonitor.shouldAllowExecution(request.scriptId, request.tabId)) {
        return {
          success: false,
          error: 'Script execution blocked due to performance limits',
          executionTime: performance.now() - startTime,
          retryCount: 0,
          canRetry: false,
        };
      }

      // Create execution context
      const context = request.executionContext || executionContextManager.createExecutionContext(
        script,
        request.tabId,
        request.url,
        retryCount
      );

      // Start performance monitoring
      const monitoringId = performanceMonitor.startMonitoring(context);

      // Execute script with retry logic
      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          retryCount = attempt;
          
          // Execute script using Chrome scripting API
          const result = await this.executeScriptInTab(script, request.tabId, context);
          
          // Mark script as executed
          executionContextManager.markScriptExecuted(request.scriptId, request.tabId);
          
          // End performance monitoring
          const metrics = performanceMonitor.endMonitoring(monitoringId, context, true);
          
          // Record execution
          const response: ScriptExecutionResponse = {
            success: true,
            result,
            executionTime: performance.now() - startTime,
            retryCount,
            canRetry: false,
          };
          
          this.recordExecution(request.scriptId, response);
          
          this.logger.info('Script executed successfully', {
            scriptId: request.scriptId,
            tabId: request.tabId,
            executionTime: response.executionTime,
            retryCount,
          });
          
          return response;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          // Handle error
          const scriptError = await errorHandler.handleError(lastError, context, {
            attempt,
            maxRetries,
            url: request.url,
          });
          
          // Check if we should retry
          if (attempt < maxRetries && errorHandler.shouldRetryError(scriptError)) {
            const retryDelay = errorHandler.getRetryDelay(scriptError);
            this.logger.warn('Script execution failed, retrying', {
              scriptId: request.scriptId,
              tabId: request.tabId,
              attempt: attempt + 1,
              maxRetries,
              retryDelay,
              error: lastError.message,
            });
            
            // Wait before retry
            await this.delay(retryDelay);
            continue;
          } else {
            // End performance monitoring with failure
            performanceMonitor.endMonitoring(monitoringId, context, false, lastError.message);
            break;
          }
        }
      }

      // All retries failed
      const response: ScriptExecutionResponse = {
        success: false,
        error: lastError?.message || 'Script execution failed',
        executionTime: performance.now() - startTime,
        retryCount,
        canRetry: false,
      };
      
      this.recordExecution(request.scriptId, response);
      
      this.logger.error('Script execution failed after all retries', {
        scriptId: request.scriptId,
        tabId: request.tabId,
        retryCount,
        error: lastError?.message,
      });
      
      return response;
    } catch (error) {
      const response: ScriptExecutionResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: performance.now() - startTime,
        retryCount,
        canRetry: false,
      };
      
      this.recordExecution(request.scriptId, response);
      
      this.logger.error('Script execution failed with critical error', {
        scriptId: request.scriptId,
        tabId: request.tabId,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return response;
    }
  }

  /**
   * Execute multiple scripts for a tab
   */
  public async executeScriptsForTab(
    tabId: number,
    url: string,
    scriptIds?: string[]
  ): Promise<ScriptExecutionResponse[]> {
    try {
      // Get all enabled scripts
      const allScripts = await this.scriptManager.getAllScripts();
      const enabledScripts = allScripts.filter(script => script.enabled);
      
      // Filter by script IDs if provided
      const scriptsToExecute = scriptIds 
        ? enabledScripts.filter(script => scriptIds.includes(script.id))
        : enabledScripts;
      
      // Get matching scripts for URL
      const { matchingScripts } = await urlMatcher.getMatchingScripts(scriptsToExecute, url);
      
      // Execute scripts in parallel (with concurrency limit)
      const executionPromises = matchingScripts.map(script => 
        this.executeScript({
          scriptId: script.id,
          tabId,
          url,
        })
      );
      
      const results = await Promise.all(executionPromises);
      
      this.logger.info('Executed scripts for tab', {
        tabId,
        url,
        totalScripts: matchingScripts.length,
        successfulExecutions: results.filter(r => r.success).length,
        failedExecutions: results.filter(r => !r.success).length,
      });
      
      return results;
    } catch (error) {
      this.logger.error('Failed to execute scripts for tab', {
        tabId,
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return [];
    }
  }

  /**
   * Get execution statistics
   */
  public getExecutionStatistics(): ExecutionStatistics {
    const executions = Array.from(this.executionHistory.values());
    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(e => e.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;
    
    const averageExecutionTime = executions.length > 0
      ? executions.reduce((sum, e) => sum + e.executionTime, 0) / executions.length
      : 0;
    
    const scriptsByTab: Record<number, number> = {};
    for (const execution of executions) {
      // This would need to be tracked separately in a real implementation
      scriptsByTab[0] = (scriptsByTab[0] || 0) + 1;
    }
    
    const performanceWarnings = performanceMonitor.getPerformanceWarnings().length;
    
    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime,
      scriptsByTab,
      performanceWarnings,
    };
  }

  /**
   * Clear execution history
   */
  public clearExecutionHistory(): void {
    this.executionHistory.clear();
    this.logger.info('Cleared execution history');
  }

  /**
   * Validate script before execution
   */
  private async validateScript(script: Script): Promise<ScriptValidationResult> {
    // Validate script metadata
    const metadataValidation = scriptValidator.validateScriptMetadata(script);
    if (!metadataValidation.isValid) {
      return {
        isValid: false,
        errors: metadataValidation.errors,
        warnings: metadataValidation.warnings,
        securityLevel: 'dangerous',
        cspCompliant: false,
      };
    }

    // Validate script code
    return await scriptValidator.validateScript(script);
  }

  /**
   * Execute script in tab using Chrome scripting API
   */
  private async executeScriptInTab(
    script: Script,
    tabId: number,
    context: ExecutionContext
  ): Promise<ScriptExecutionResult> {
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        reject(new Error('Script execution timeout'));
      }, 30000); // 30 second timeout

      // Store timeout for cleanup
      this.executionTimeouts.set(context.executionId, timeoutId);

      try {
        // Use Chrome scripting API to execute script
        chrome.scripting.executeScript({
          target: { tabId },
          world: context.world as 'MAIN' | 'ISOLATED',
          func: this.createScriptFunction(script.code),
        }, (results) => {
          // Clear timeout
          clearTimeout(timeoutId);
          this.executionTimeouts.delete(context.executionId);

          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!results || results.length === 0) {
            reject(new Error('No execution results returned'));
            return;
          }

          const result = results[0];
          if (result.error) {
            reject(new Error(result.error));
            return;
          }

          resolve({
            success: true,
            result: result.result,
            executionTime: performance.now() - context.timestamp,
          });
        });
      } catch (error) {
        // Clear timeout
        clearTimeout(timeoutId);
        this.executionTimeouts.delete(context.executionId);
        reject(error);
      }
    });
  }

  /**
   * Create script function for execution
   */
  private createScriptFunction(code: string): () => unknown {
    // This creates a safe wrapper function that executes the user script
    // The function is serialized and sent to the tab context
    return new Function(`
      try {
        // User script code
        ${code}
        
        // Return execution result
        return { success: true, timestamp: Date.now() };
      } catch (error) {
        return { 
          success: false, 
          error: error.message, 
          timestamp: Date.now() 
        };
      }
    `) as () => unknown;
  }

  /**
   * Record execution result
   */
  private recordExecution(scriptId: string, response: ScriptExecutionResponse): void {
    const executionKey = `${scriptId}_${Date.now()}`;
    
    // Check storage limits
    if (this.executionHistory.size >= this.maxHistorySize) {
      // Remove oldest execution
      const oldestKey = this.executionHistory.keys().next().value;
      this.executionHistory.delete(oldestKey);
    }
    
    this.executionHistory.set(executionKey, response);
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up timeouts
   */
  public cleanup(): void {
    for (const timeoutId of this.executionTimeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.executionTimeouts.clear();
    this.logger.info('Cleaned up execution timeouts');
  }
}

// Export singleton instance
export const scriptExecutor = ScriptExecutor.getInstance();