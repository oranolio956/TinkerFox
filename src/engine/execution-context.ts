/**
 * Execution Context Manager for ScriptFlow
 * 
 * Manages script execution contexts, tab state, and execution timing.
 * Ensures proper isolation and prevents cross-tab script bleeding.
 * 
 * @fileoverview Production-grade execution context management
 */

import { Logger } from '../lib/logger';
import type { Script } from '../types';

/**
 * Execution context for a script
 */
export interface ExecutionContext {
  readonly scriptId: string;
  readonly tabId: number;
  readonly url: string;
  readonly timestamp: number;
  readonly runAt: 'document_start' | 'document_end' | 'document_idle';
  readonly world: 'MAIN' | 'ISOLATED';
  readonly executionId: string;
  readonly retryCount: number;
  readonly maxRetries: number;
}

/**
 * Tab state information
 */
export interface TabState {
  readonly tabId: number;
  readonly url: string;
  readonly status: 'loading' | 'complete' | 'error';
  readonly lastUpdated: number;
  readonly documentReady: boolean;
  readonly scriptsExecuted: Set<string>;
  readonly executionQueue: ExecutionContext[];
}

/**
 * Execution timing configuration
 */
export interface ExecutionTiming {
  readonly documentStartDelay: number;    // ms to wait after document_start
  readonly documentEndDelay: number;      // ms to wait after document_end
  readonly documentIdleDelay: number;     // ms to wait after document_idle
  readonly maxExecutionTime: number;      // max time for script execution
  readonly retryDelay: number;            // delay between retries
}

/**
 * Execution Context Manager class
 */
export class ExecutionContextManager {
  private static instance: ExecutionContextManager | null = null;
  private readonly logger: Logger;
  private readonly tabStates: Map<number, TabState>;
  private readonly executionContexts: Map<string, ExecutionContext>;
  private readonly timing: ExecutionTiming;
  private readonly maxContextsPerTab: number = 50;
  private readonly maxTotalContexts: number = 1000;

  private constructor() {
    this.logger = new Logger('ExecutionContextManager');
    this.tabStates = new Map();
    this.executionContexts = new Map();
    
    this.timing = {
      documentStartDelay: 100,    // 100ms after document_start
      documentEndDelay: 0,        // Immediate after document_end
      documentIdleDelay: 2000,    // 2s after document_idle
      maxExecutionTime: 30000,    // 30s max execution time
      retryDelay: 1000,           // 1s between retries
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ExecutionContextManager {
    if (!ExecutionContextManager.instance) {
      ExecutionContextManager.instance = new ExecutionContextManager();
    }
    return ExecutionContextManager.instance;
  }

  /**
   * Create execution context for a script
   */
  public createExecutionContext(
    script: Script,
    tabId: number,
    url: string,
    retryCount: number = 0
  ): ExecutionContext {
    const executionId = this.generateExecutionId();
    
    const context: ExecutionContext = {
      scriptId: script.id,
      tabId,
      url,
      timestamp: Date.now(),
      runAt: script.runAt || 'document_end',
      world: script.world || 'MAIN',
      executionId,
      retryCount,
      maxRetries: 3,
    };

    this.executionContexts.set(executionId, context);
    this.logger.debug('Created execution context', { executionId, scriptId: script.id, tabId });

    return context;
  }

  /**
   * Update tab state
   */
  public updateTabState(
    tabId: number,
    url: string,
    status: 'loading' | 'complete' | 'error',
    documentReady: boolean = false
  ): void {
    const existingState = this.tabStates.get(tabId);
    
    const newState: TabState = {
      tabId,
      url,
      status,
      lastUpdated: Date.now(),
      documentReady,
      scriptsExecuted: existingState?.scriptsExecuted || new Set(),
      executionQueue: existingState?.executionQueue || [],
    };

    this.tabStates.set(tabId, newState);
    this.logger.debug('Updated tab state', { tabId, url, status, documentReady });
  }

  /**
   * Get tab state
   */
  public getTabState(tabId: number): TabState | null {
    return this.tabStates.get(tabId) || null;
  }

  /**
   * Check if script should execute on tab
   */
  public shouldExecuteScript(script: Script, tabId: number): boolean {
    const tabState = this.getTabState(tabId);
    if (!tabState) {
      return false;
    }

    // Check if script already executed on this tab
    if (tabState.scriptsExecuted.has(script.id)) {
      return false;
    }

    // Check if tab is in correct state for script execution
    const runAt = script.runAt || 'document_end';
    switch (runAt) {
      case 'document_start':
        return tabState.status === 'loading' && !tabState.documentReady;
      case 'document_end':
        return tabState.status === 'complete' && tabState.documentReady;
      case 'document_idle':
        return tabState.status === 'complete' && tabState.documentReady;
      default:
        return false;
    }
  }

  /**
   * Queue script for execution
   */
  public queueScriptExecution(context: ExecutionContext): void {
    const tabState = this.getTabState(context.tabId);
    if (!tabState) {
      this.logger.warn('Cannot queue script execution: tab state not found', { 
        tabId: context.tabId 
      });
      return;
    }

    // Check queue limits
    if (tabState.executionQueue.length >= this.maxContextsPerTab) {
      this.logger.warn('Execution queue full for tab', { tabId: context.tabId });
      return;
    }

    // Add to queue
    tabState.executionQueue.push(context);
    this.logger.debug('Queued script execution', { 
      executionId: context.executionId, 
      tabId: context.tabId 
    });
  }

  /**
   * Get next script to execute from queue
   */
  public getNextScriptToExecute(tabId: number): ExecutionContext | null {
    const tabState = this.getTabState(tabId);
    if (!tabState || tabState.executionQueue.length === 0) {
      return null;
    }

    return tabState.executionQueue.shift() || null;
  }

  /**
   * Mark script as executed
   */
  public markScriptExecuted(scriptId: string, tabId: number): void {
    const tabState = this.getTabState(tabId);
    if (tabState) {
      tabState.scriptsExecuted.add(scriptId);
      this.logger.debug('Marked script as executed', { scriptId, tabId });
    }
  }

  /**
   * Check if script is already executed on tab
   */
  public isScriptExecuted(scriptId: string, tabId: number): boolean {
    const tabState = this.getTabState(tabId);
    return tabState ? tabState.scriptsExecuted.has(scriptId) : false;
  }

  /**
   * Calculate execution delay based on runAt timing
   */
  public getExecutionDelay(runAt: 'document_start' | 'document_end' | 'document_idle'): number {
    switch (runAt) {
      case 'document_start':
        return this.timing.documentStartDelay;
      case 'document_end':
        return this.timing.documentEndDelay;
      case 'document_idle':
        return this.timing.documentIdleDelay;
      default:
        return 0;
    }
  }

  /**
   * Check if execution context is still valid
   */
  public isContextValid(context: ExecutionContext): boolean {
    const tabState = this.getTabState(context.tabId);
    if (!tabState) {
      return false;
    }

    // Check if tab URL has changed
    if (tabState.url !== context.url) {
      return false;
    }

    // Check if context is too old
    const age = Date.now() - context.timestamp;
    if (age > this.timing.maxExecutionTime) {
      return false;
    }

    return true;
  }

  /**
   * Clean up execution context
   */
  public cleanupContext(executionId: string): void {
    this.executionContexts.delete(executionId);
    this.logger.debug('Cleaned up execution context', { executionId });
  }

  /**
   * Clean up tab state
   */
  public cleanupTabState(tabId: number): void {
    this.tabStates.delete(tabId);
    this.logger.debug('Cleaned up tab state', { tabId });
  }

  /**
   * Get execution statistics
   */
  public getExecutionStats(): {
    totalContexts: number;
    totalTabs: number;
    queuedExecutions: number;
    executedScripts: number;
  } {
    let queuedExecutions = 0;
    let executedScripts = 0;

    for (const tabState of this.tabStates.values()) {
      queuedExecutions += tabState.executionQueue.length;
      executedScripts += tabState.scriptsExecuted.size;
    }

    return {
      totalContexts: this.executionContexts.size,
      totalTabs: this.tabStates.size,
      queuedExecutions,
      executedScripts,
    };
  }

  /**
   * Clear all contexts and states
   */
  public clearAll(): void {
    this.executionContexts.clear();
    this.tabStates.clear();
    this.logger.info('Cleared all execution contexts and tab states');
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up old contexts periodically
   */
  public cleanupOldContexts(): void {
    const now = Date.now();
    const maxAge = this.timing.maxExecutionTime * 2; // 2x max execution time

    // Clean up old execution contexts
    for (const [executionId, context] of this.executionContexts.entries()) {
      if (now - context.timestamp > maxAge) {
        this.cleanupContext(executionId);
      }
    }

    // Clean up old tab states
    for (const [tabId, tabState] of this.tabStates.entries()) {
      if (now - tabState.lastUpdated > maxAge) {
        this.cleanupTabState(tabId);
      }
    }
  }
}

// Export singleton instance
export const executionContextManager = ExecutionContextManager.getInstance();