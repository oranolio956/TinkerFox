/**
 * Unit Tests for Script Executor
 * 
 * Comprehensive test suite for the script execution engine with edge cases,
 * error scenarios, and integration testing.
 * 
 * @fileoverview Production-grade test coverage for mission-critical execution
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { ScriptExecutor } from '../script-executor';
import { ScriptManager } from '../../lib/script-manager';
import { urlMatcher } from '../url-matcher';
import { scriptValidator } from '../script-validator';
import { executionContextManager } from '../execution-context';
import { errorHandler } from '../error-handler';
import { performanceMonitor } from '../performance-monitor';
import { featureManager } from '../../lib/features';
import type { Script, ScriptExecutionResult } from '../../types';
import type { ScriptExecutionRequest } from '../script-executor';

// Mock Chrome APIs
const mockChrome = {
  scripting: {
    executeScript: vi.fn(),
  },
  runtime: {
    lastError: null,
  },
};

// @ts-ignore
global.chrome = mockChrome;

// Mock dependencies
vi.mock('../../lib/script-manager');
vi.mock('../../lib/features');
vi.mock('../url-matcher');
vi.mock('../script-validator');
vi.mock('../execution-context');
vi.mock('../error-handler');
vi.mock('../performance-monitor');

describe('ScriptExecutor', () => {
  let executor: ScriptExecutor;
  let mockScriptManager: jest.Mocked<ScriptManager>;
  let mockUrlMatcher: any;
  let mockScriptValidator: any;
  let mockExecutionContextManager: any;
  let mockErrorHandler: any;
  let mockPerformanceMonitor: any;
  let mockFeatureManager: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup mock implementations
    mockScriptManager = {
      getScript: vi.fn(),
      getAllScripts: vi.fn(),
    } as any;

    mockUrlMatcher = {
      matchesUrl: vi.fn(),
      getMatchingScripts: vi.fn(),
    };

    mockScriptValidator = {
      validateScript: vi.fn(),
      validateScriptMetadata: vi.fn(),
    };

    mockExecutionContextManager = {
      createExecutionContext: vi.fn(),
      isScriptExecuted: vi.fn(),
      markScriptExecuted: vi.fn(),
    };

    mockErrorHandler = {
      handleError: vi.fn(),
      shouldRetryError: vi.fn(),
      getRetryDelay: vi.fn(),
    };

    mockPerformanceMonitor = {
      startMonitoring: vi.fn(),
      endMonitoring: vi.fn(),
      shouldAllowExecution: vi.fn(),
    };

    mockFeatureManager = {
      isFeatureEnabled: vi.fn(),
    };

    // Mock static methods
    (ScriptManager.getInstance as Mock).mockReturnValue(mockScriptManager);
    (urlMatcher as any) = mockUrlMatcher;
    (scriptValidator as any) = mockScriptValidator;
    (executionContextManager as any) = mockExecutionContextManager;
    (errorHandler as any) = mockErrorHandler;
    (performanceMonitor as any) = mockPerformanceMonitor;
    (featureManager as any) = mockFeatureManager;

    // Create executor instance
    executor = new ScriptExecutor();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Script Execution', () => {
    const mockScript: Script = {
      id: 'test-script',
      name: 'Test Script',
      description: 'A test script',
      code: 'console.log("Hello World");',
      matches: ['https://example.com/*'],
      enabled: true,
      runAt: 'document_end',
      world: 'MAIN',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockRequest: ScriptExecutionRequest = {
      scriptId: 'test-script',
      tabId: 1,
      url: 'https://example.com/page',
    };

    it('should execute script successfully', async () => {
      // Setup mocks
      mockFeatureManager.isFeatureEnabled.mockReturnValue(true);
      mockScriptManager.getScript.mockResolvedValue(mockScript);
      mockScriptValidator.validateScriptMetadata.mockReturnValue({ isValid: true, errors: [], warnings: [] });
      mockScriptValidator.validateScript.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        securityLevel: 'safe',
        cspCompliant: true,
      });
      mockUrlMatcher.matchesUrl.mockResolvedValue({ matches: true, reason: 'match' });
      mockExecutionContextManager.isScriptExecuted.mockReturnValue(false);
      mockPerformanceMonitor.shouldAllowExecution.mockReturnValue(true);
      mockExecutionContextManager.createExecutionContext.mockReturnValue({
        executionId: 'exec-1',
        scriptId: 'test-script',
        tabId: 1,
        url: 'https://example.com/page',
        timestamp: Date.now(),
        runAt: 'document_end',
        world: 'MAIN',
        retryCount: 0,
        maxRetries: 3,
      });
      mockPerformanceMonitor.startMonitoring.mockReturnValue('monitor-1');
      mockPerformanceMonitor.endMonitoring.mockReturnValue({
        executionId: 'exec-1',
        scriptId: 'test-script',
        tabId: 1,
        startTime: Date.now(),
        endTime: Date.now() + 100,
        executionTime: 100,
        memoryUsage: 10,
        cpuTime: 50,
        success: true,
      });

      // Mock Chrome API
      mockChrome.scripting.executeScript.mockImplementation((options, callback) => {
        setTimeout(() => {
          callback([{ result: { success: true, timestamp: Date.now() } }]);
        }, 10);
      });

      // Execute script
      const result = await executor.executeScript(mockRequest);

      // Verify result
      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.retryCount).toBe(0);
      expect(result.canRetry).toBe(false);

      // Verify mocks were called
      expect(mockScriptManager.getScript).toHaveBeenCalledWith('test-script');
      expect(mockScriptValidator.validateScript).toHaveBeenCalledWith(mockScript);
      expect(mockUrlMatcher.matchesUrl).toHaveBeenCalledWith(mockScript, 'https://example.com/page');
      expect(mockChrome.scripting.executeScript).toHaveBeenCalled();
    });

    it('should handle script not found', async () => {
      mockFeatureManager.isFeatureEnabled.mockReturnValue(true);
      mockScriptManager.getScript.mockResolvedValue(null);

      const result = await executor.executeScript(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Script not found');
      expect(result.canRetry).toBe(false);
    });

    it('should handle script validation failure', async () => {
      mockFeatureManager.isFeatureEnabled.mockReturnValue(true);
      mockScriptManager.getScript.mockResolvedValue(mockScript);
      mockScriptValidator.validateScriptMetadata.mockReturnValue({
        isValid: false,
        errors: ['Invalid script name'],
        warnings: [],
      });

      const result = await executor.executeScript(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Script validation failed');
      expect(result.canRetry).toBe(false);
    });

    it('should handle URL mismatch', async () => {
      mockFeatureManager.isFeatureEnabled.mockReturnValue(true);
      mockScriptManager.getScript.mockResolvedValue(mockScript);
      mockScriptValidator.validateScriptMetadata.mockReturnValue({ isValid: true, errors: [], warnings: [] });
      mockScriptValidator.validateScript.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        securityLevel: 'safe',
        cspCompliant: true,
      });
      mockUrlMatcher.matchesUrl.mockResolvedValue({ matches: false, reason: 'no_pattern' });

      const result = await executor.executeScript(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Script does not match URL');
      expect(result.canRetry).toBe(false);
    });

    it('should handle already executed script', async () => {
      mockFeatureManager.isFeatureEnabled.mockReturnValue(true);
      mockScriptManager.getScript.mockResolvedValue(mockScript);
      mockScriptValidator.validateScriptMetadata.mockReturnValue({ isValid: true, errors: [], warnings: [] });
      mockScriptValidator.validateScript.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        securityLevel: 'safe',
        cspCompliant: true,
      });
      mockUrlMatcher.matchesUrl.mockResolvedValue({ matches: true, reason: 'match' });
      mockExecutionContextManager.isScriptExecuted.mockReturnValue(true);

      const result = await executor.executeScript(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Script already executed on this tab');
      expect(result.canRetry).toBe(false);
    });

    it('should handle performance limits', async () => {
      mockFeatureManager.isFeatureEnabled.mockReturnValue(true);
      mockScriptManager.getScript.mockResolvedValue(mockScript);
      mockScriptValidator.validateScriptMetadata.mockReturnValue({ isValid: true, errors: [], warnings: [] });
      mockScriptValidator.validateScript.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        securityLevel: 'safe',
        cspCompliant: true,
      });
      mockUrlMatcher.matchesUrl.mockResolvedValue({ matches: true, reason: 'match' });
      mockExecutionContextManager.isScriptExecuted.mockReturnValue(false);
      mockPerformanceMonitor.shouldAllowExecution.mockReturnValue(false);

      const result = await executor.executeScript(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Script execution blocked due to performance limits');
      expect(result.canRetry).toBe(false);
    });

    it('should handle Chrome API errors', async () => {
      mockFeatureManager.isFeatureEnabled.mockReturnValue(true);
      mockScriptManager.getScript.mockResolvedValue(mockScript);
      mockScriptValidator.validateScriptMetadata.mockReturnValue({ isValid: true, errors: [], warnings: [] });
      mockScriptValidator.validateScript.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        securityLevel: 'safe',
        cspCompliant: true,
      });
      mockUrlMatcher.matchesUrl.mockResolvedValue({ matches: true, reason: 'match' });
      mockExecutionContextManager.isScriptExecuted.mockReturnValue(false);
      mockPerformanceMonitor.shouldAllowExecution.mockReturnValue(true);
      mockExecutionContextManager.createExecutionContext.mockReturnValue({
        executionId: 'exec-1',
        scriptId: 'test-script',
        tabId: 1,
        url: 'https://example.com/page',
        timestamp: Date.now(),
        runAt: 'document_end',
        world: 'MAIN',
        retryCount: 0,
        maxRetries: 3,
      });
      mockPerformanceMonitor.startMonitoring.mockReturnValue('monitor-1');

      // Mock Chrome API error
      mockChrome.scripting.executeScript.mockImplementation((options, callback) => {
        setTimeout(() => {
          mockChrome.runtime.lastError = { message: 'Chrome API error' };
          callback([]);
        }, 10);
      });

      mockErrorHandler.handleError.mockResolvedValue({
        id: 'error-1',
        scriptId: 'test-script',
        tabId: 1,
        executionId: 'exec-1',
        category: 'chrome_api',
        severity: 'high',
        message: 'Chrome API error',
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        canRetry: false,
        context: {},
      });
      mockErrorHandler.shouldRetryError.mockReturnValue(false);
      mockPerformanceMonitor.endMonitoring.mockReturnValue({
        executionId: 'exec-1',
        scriptId: 'test-script',
        tabId: 1,
        startTime: Date.now(),
        endTime: Date.now() + 100,
        executionTime: 100,
        memoryUsage: 10,
        cpuTime: 50,
        success: false,
        errorType: 'Chrome API error',
      });

      const result = await executor.executeScript(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Chrome API error');
      expect(result.canRetry).toBe(false);
    });

    it('should retry on retryable errors', async () => {
      mockFeatureManager.isFeatureEnabled.mockReturnValue(true);
      mockScriptManager.getScript.mockResolvedValue(mockScript);
      mockScriptValidator.validateScriptMetadata.mockReturnValue({ isValid: true, errors: [], warnings: [] });
      mockScriptValidator.validateScript.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        securityLevel: 'safe',
        cspCompliant: true,
      });
      mockUrlMatcher.matchesUrl.mockResolvedValue({ matches: true, reason: 'match' });
      mockExecutionContextManager.isScriptExecuted.mockReturnValue(false);
      mockPerformanceMonitor.shouldAllowExecution.mockReturnValue(true);
      mockExecutionContextManager.createExecutionContext.mockReturnValue({
        executionId: 'exec-1',
        scriptId: 'test-script',
        tabId: 1,
        url: 'https://example.com/page',
        timestamp: Date.now(),
        runAt: 'document_end',
        world: 'MAIN',
        retryCount: 0,
        maxRetries: 3,
      });
      mockPerformanceMonitor.startMonitoring.mockReturnValue('monitor-1');

      // Mock Chrome API to fail first time, succeed second time
      let callCount = 0;
      mockChrome.scripting.executeScript.mockImplementation((options, callback) => {
        callCount++;
        setTimeout(() => {
          if (callCount === 1) {
            mockChrome.runtime.lastError = { message: 'Temporary error' };
            callback([]);
          } else {
            mockChrome.runtime.lastError = null;
            callback([{ result: { success: true, timestamp: Date.now() } }]);
          }
        }, 10);
      });

      mockErrorHandler.handleError.mockResolvedValue({
        id: 'error-1',
        scriptId: 'test-script',
        tabId: 1,
        executionId: 'exec-1',
        category: 'execution',
        severity: 'medium',
        message: 'Temporary error',
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        canRetry: true,
        context: {},
      });
      mockErrorHandler.shouldRetryError.mockReturnValueOnce(true).mockReturnValueOnce(false);
      mockErrorHandler.getRetryDelay.mockReturnValue(100);
      mockPerformanceMonitor.endMonitoring.mockReturnValue({
        executionId: 'exec-1',
        scriptId: 'test-script',
        tabId: 1,
        startTime: Date.now(),
        endTime: Date.now() + 200,
        executionTime: 200,
        memoryUsage: 10,
        cpuTime: 50,
        success: true,
      });

      const result = await executor.executeScript(mockRequest);

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(1);
      expect(mockChrome.scripting.executeScript).toHaveBeenCalledTimes(2);
    });

    it('should handle feature disabled', async () => {
      mockFeatureManager.isFeatureEnabled.mockReturnValue(false);

      const result = await executor.executeScript(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Script execution is disabled');
      expect(result.canRetry).toBe(false);
    });
  });

  describe('Batch Execution', () => {
    it('should execute multiple scripts for tab', async () => {
      const mockScripts: Script[] = [
        {
          id: 'script-1',
          name: 'Script 1',
          description: 'First script',
          code: 'console.log("Script 1");',
          matches: ['https://example.com/*'],
          enabled: true,
          runAt: 'document_end',
          world: 'MAIN',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'script-2',
          name: 'Script 2',
          description: 'Second script',
          code: 'console.log("Script 2");',
          matches: ['https://example.com/*'],
          enabled: true,
          runAt: 'document_end',
          world: 'MAIN',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      mockScriptManager.getAllScripts.mockResolvedValue(mockScripts);
      mockUrlMatcher.getMatchingScripts.mockResolvedValue({
        matchingScripts: mockScripts,
        executionTime: 10,
      });

      // Mock individual script execution
      mockFeatureManager.isFeatureEnabled.mockReturnValue(true);
      mockScriptManager.getScript.mockImplementation((id) => 
        Promise.resolve(mockScripts.find(s => s.id === id) || null)
      );
      mockScriptValidator.validateScriptMetadata.mockReturnValue({ isValid: true, errors: [], warnings: [] });
      mockScriptValidator.validateScript.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        securityLevel: 'safe',
        cspCompliant: true,
      });
      mockUrlMatcher.matchesUrl.mockResolvedValue({ matches: true, reason: 'match' });
      mockExecutionContextManager.isScriptExecuted.mockReturnValue(false);
      mockPerformanceMonitor.shouldAllowExecution.mockReturnValue(true);
      mockExecutionContextManager.createExecutionContext.mockReturnValue({
        executionId: 'exec-1',
        scriptId: 'script-1',
        tabId: 1,
        url: 'https://example.com/page',
        timestamp: Date.now(),
        runAt: 'document_end',
        world: 'MAIN',
        retryCount: 0,
        maxRetries: 3,
      });
      mockPerformanceMonitor.startMonitoring.mockReturnValue('monitor-1');
      mockPerformanceMonitor.endMonitoring.mockReturnValue({
        executionId: 'exec-1',
        scriptId: 'script-1',
        tabId: 1,
        startTime: Date.now(),
        endTime: Date.now() + 100,
        executionTime: 100,
        memoryUsage: 10,
        cpuTime: 50,
        success: true,
      });

      mockChrome.scripting.executeScript.mockImplementation((options, callback) => {
        setTimeout(() => {
          callback([{ result: { success: true, timestamp: Date.now() } }]);
        }, 10);
      });

      const results = await executor.executeScriptsForTab(1, 'https://example.com/page');

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should provide execution statistics', () => {
      const stats = executor.getExecutionStatistics();
      
      expect(stats).toHaveProperty('totalExecutions');
      expect(stats).toHaveProperty('successfulExecutions');
      expect(stats).toHaveProperty('failedExecutions');
      expect(stats).toHaveProperty('averageExecutionTime');
      expect(stats).toHaveProperty('scriptsByTab');
      expect(stats).toHaveProperty('performanceWarnings');
    });
  });

  describe('Cleanup', () => {
    it('should clean up execution history', () => {
      executor.clearExecutionHistory();
      // This should not throw an error
    });

    it('should clean up timeouts', () => {
      executor.cleanup();
      // This should not throw an error
    });
  });
});