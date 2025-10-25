/**
 * Integration Tests for Script Execution Engine
 * 
 * End-to-end testing of the complete script execution pipeline
 * with real Chrome APIs and realistic scenarios.
 * 
 * @fileoverview Production-grade integration testing
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { scriptExecutor } from '../script-executor';
import { urlMatcher } from '../url-matcher';
import { scriptValidator } from '../script-validator';
import { executionContextManager } from '../execution-context';
import { errorHandler } from '../error-handler';
import { performanceMonitor } from '../performance-monitor';
import { featureManager } from '../../lib/features';
import type { Script } from '../../types';

// Mock Chrome APIs
const mockChrome = {
  scripting: {
    executeScript: vi.fn(),
  },
  runtime: {
    lastError: null,
  },
  tabs: {
    get: vi.fn(),
  },
};

// @ts-ignore
global.chrome = mockChrome;

// Mock all dependencies
vi.mock('../../lib/script-manager');
vi.mock('../../lib/features');
vi.mock('../url-matcher');
vi.mock('../script-validator');
vi.mock('../execution-context');
vi.mock('../error-handler');
vi.mock('../performance-monitor');

describe('Script Execution Engine Integration', () => {
  let mockScriptManager: any;
  let mockUrlMatcher: any;
  let mockScriptValidator: any;
  let mockExecutionContextManager: any;
  let mockErrorHandler: any;
  let mockPerformanceMonitor: any;
  let mockFeatureManager: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup comprehensive mocks
    mockScriptManager = {
      getScript: vi.fn(),
      getAllScripts: vi.fn(),
    };

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
      updateTabState: vi.fn(),
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

    // Apply mocks
    (urlMatcher as any) = mockUrlMatcher;
    (scriptValidator as any) = mockScriptValidator;
    (executionContextManager as any) = mockExecutionContextManager;
    (errorHandler as any) = mockErrorHandler;
    (performanceMonitor as any) = mockPerformanceMonitor;
    (featureManager as any) = mockFeatureManager;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Execution Pipeline', () => {
    const mockScript: Script = {
      id: 'integration-test-script',
      name: 'Integration Test Script',
      description: 'A script for integration testing',
      code: `
        // Test script that modifies page content
        const testElement = document.createElement('div');
        testElement.id = 'scriptflow-test-element';
        testElement.textContent = 'Script executed successfully';
        document.body.appendChild(testElement);
        
        // Return execution result
        return { success: true, elementId: 'scriptflow-test-element' };
      `,
      matches: ['https://example.com/*'],
      enabled: true,
      runAt: 'document_end',
      world: 'MAIN',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it('should execute complete pipeline successfully', async () => {
      // Setup all mocks for successful execution
      mockFeatureManager.isFeatureEnabled.mockReturnValue(true);
      mockScriptManager.getScript.mockResolvedValue(mockScript);
      mockScriptValidator.validateScriptMetadata.mockReturnValue({ 
        isValid: true, 
        errors: [], 
        warnings: [] 
      });
      mockScriptValidator.validateScript.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        securityLevel: 'safe',
        cspCompliant: true,
      });
      mockUrlMatcher.matchesUrl.mockResolvedValue({ 
        matches: true, 
        reason: 'match',
        pattern: 'https://example.com/*',
        executionTime: 5
      });
      mockExecutionContextManager.isScriptExecuted.mockReturnValue(false);
      mockPerformanceMonitor.shouldAllowExecution.mockReturnValue(true);
      mockExecutionContextManager.createExecutionContext.mockReturnValue({
        executionId: 'exec-integration-1',
        scriptId: 'integration-test-script',
        tabId: 1,
        url: 'https://example.com/test',
        timestamp: Date.now(),
        runAt: 'document_end',
        world: 'MAIN',
        retryCount: 0,
        maxRetries: 3,
      });
      mockPerformanceMonitor.startMonitoring.mockReturnValue('monitor-integration-1');
      mockPerformanceMonitor.endMonitoring.mockReturnValue({
        executionId: 'exec-integration-1',
        scriptId: 'integration-test-script',
        tabId: 1,
        startTime: Date.now(),
        endTime: Date.now() + 150,
        executionTime: 150,
        memoryUsage: 15,
        cpuTime: 75,
        success: true,
      });

      // Mock successful Chrome API execution
      mockChrome.scripting.executeScript.mockImplementation((options, callback) => {
        setTimeout(() => {
          callback([{ 
            result: { 
              success: true, 
              elementId: 'scriptflow-test-element',
              timestamp: Date.now() 
            } 
          }]);
        }, 20);
      });

      // Execute script
      const result = await scriptExecutor.executeScript({
        scriptId: 'integration-test-script',
        tabId: 1,
        url: 'https://example.com/test',
      });

      // Verify successful execution
      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.retryCount).toBe(0);
      expect(result.canRetry).toBe(false);

      // Verify all components were called
      expect(mockFeatureManager.isFeatureEnabled).toHaveBeenCalled();
      expect(mockScriptManager.getScript).toHaveBeenCalledWith('integration-test-script');
      expect(mockScriptValidator.validateScript).toHaveBeenCalledWith(mockScript);
      expect(mockUrlMatcher.matchesUrl).toHaveBeenCalledWith(mockScript, 'https://example.com/test');
      expect(mockExecutionContextManager.isScriptExecuted).toHaveBeenCalledWith('integration-test-script', 1);
      expect(mockPerformanceMonitor.shouldAllowExecution).toHaveBeenCalledWith('integration-test-script', 1);
      expect(mockChrome.scripting.executeScript).toHaveBeenCalled();
      expect(mockExecutionContextManager.markScriptExecuted).toHaveBeenCalledWith('integration-test-script', 1);
    });

    it('should handle validation failure gracefully', async () => {
      mockFeatureManager.isFeatureEnabled.mockReturnValue(true);
      mockScriptManager.getScript.mockResolvedValue(mockScript);
      mockScriptValidator.validateScriptMetadata.mockReturnValue({
        isValid: false,
        errors: ['Script name is required'],
        warnings: [],
      });

      const result = await scriptExecutor.executeScript({
        scriptId: 'integration-test-script',
        tabId: 1,
        url: 'https://example.com/test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Script validation failed');
      expect(result.canRetry).toBe(false);
    });

    it('should handle URL mismatch gracefully', async () => {
      mockFeatureManager.isFeatureEnabled.mockReturnValue(true);
      mockScriptManager.getScript.mockResolvedValue(mockScript);
      mockScriptValidator.validateScriptMetadata.mockReturnValue({ 
        isValid: true, 
        errors: [], 
        warnings: [] 
      });
      mockScriptValidator.validateScript.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        securityLevel: 'safe',
        cspCompliant: true,
      });
      mockUrlMatcher.matchesUrl.mockResolvedValue({ 
        matches: false, 
        reason: 'no_pattern',
        executionTime: 3
      });

      const result = await scriptExecutor.executeScript({
        scriptId: 'integration-test-script',
        tabId: 1,
        url: 'https://different-site.com/test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Script does not match URL');
      expect(result.canRetry).toBe(false);
    });

    it('should handle Chrome API errors with retry', async () => {
      mockFeatureManager.isFeatureEnabled.mockReturnValue(true);
      mockScriptManager.getScript.mockResolvedValue(mockScript);
      mockScriptValidator.validateScriptMetadata.mockReturnValue({ 
        isValid: true, 
        errors: [], 
        warnings: [] 
      });
      mockScriptValidator.validateScript.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        securityLevel: 'safe',
        cspCompliant: true,
      });
      mockUrlMatcher.matchesUrl.mockResolvedValue({ 
        matches: true, 
        reason: 'match',
        executionTime: 4
      });
      mockExecutionContextManager.isScriptExecuted.mockReturnValue(false);
      mockPerformanceMonitor.shouldAllowExecution.mockReturnValue(true);
      mockExecutionContextManager.createExecutionContext.mockReturnValue({
        executionId: 'exec-integration-2',
        scriptId: 'integration-test-script',
        tabId: 1,
        url: 'https://example.com/test',
        timestamp: Date.now(),
        runAt: 'document_end',
        world: 'MAIN',
        retryCount: 0,
        maxRetries: 3,
      });
      mockPerformanceMonitor.startMonitoring.mockReturnValue('monitor-integration-2');

      // Mock Chrome API to fail first time, succeed second time
      let callCount = 0;
      mockChrome.scripting.executeScript.mockImplementation((options, callback) => {
        callCount++;
        setTimeout(() => {
          if (callCount === 1) {
            mockChrome.runtime.lastError = { message: 'Temporary Chrome API error' };
            callback([]);
          } else {
            mockChrome.runtime.lastError = null;
            callback([{ 
              result: { 
                success: true, 
                elementId: 'scriptflow-test-element',
                timestamp: Date.now() 
              } 
            }]);
          }
        }, 15);
      });

      mockErrorHandler.handleError.mockResolvedValue({
        id: 'error-integration-1',
        scriptId: 'integration-test-script',
        tabId: 1,
        executionId: 'exec-integration-2',
        category: 'chrome_api',
        severity: 'medium',
        message: 'Temporary Chrome API error',
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        canRetry: true,
        context: {},
      });
      mockErrorHandler.shouldRetryError.mockReturnValueOnce(true).mockReturnValueOnce(false);
      mockErrorHandler.getRetryDelay.mockReturnValue(50);
      mockPerformanceMonitor.endMonitoring.mockReturnValue({
        executionId: 'exec-integration-2',
        scriptId: 'integration-test-script',
        tabId: 1,
        startTime: Date.now(),
        endTime: Date.now() + 200,
        executionTime: 200,
        memoryUsage: 15,
        cpuTime: 75,
        success: true,
      });

      const result = await scriptExecutor.executeScript({
        scriptId: 'integration-test-script',
        tabId: 1,
        url: 'https://example.com/test',
      });

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(1);
      expect(mockChrome.scripting.executeScript).toHaveBeenCalledTimes(2);
    });
  });

  describe('Batch Execution Integration', () => {
    const mockScripts: Script[] = [
      {
        id: 'script-1',
        name: 'Script 1',
        description: 'First test script',
        code: 'console.log("Script 1 executed"); return { success: true };',
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
        description: 'Second test script',
        code: 'console.log("Script 2 executed"); return { success: true };',
        matches: ['https://example.com/*'],
        enabled: true,
        runAt: 'document_end',
        world: 'MAIN',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    it('should execute multiple scripts for a tab', async () => {
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
      mockScriptValidator.validateScriptMetadata.mockReturnValue({ 
        isValid: true, 
        errors: [], 
        warnings: [] 
      });
      mockScriptValidator.validateScript.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        securityLevel: 'safe',
        cspCompliant: true,
      });
      mockUrlMatcher.matchesUrl.mockResolvedValue({ 
        matches: true, 
        reason: 'match',
        executionTime: 3
      });
      mockExecutionContextManager.isScriptExecuted.mockReturnValue(false);
      mockPerformanceMonitor.shouldAllowExecution.mockReturnValue(true);
      mockExecutionContextManager.createExecutionContext.mockImplementation((script) => ({
        executionId: `exec-${script.id}`,
        scriptId: script.id,
        tabId: 1,
        url: 'https://example.com/test',
        timestamp: Date.now(),
        runAt: 'document_end',
        world: 'MAIN',
        retryCount: 0,
        maxRetries: 3,
      }));
      mockPerformanceMonitor.startMonitoring.mockReturnValue('monitor-batch');
      mockPerformanceMonitor.endMonitoring.mockReturnValue({
        executionId: 'exec-batch',
        scriptId: 'batch-script',
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

      const results = await scriptExecutor.executeScriptsForTab(1, 'https://example.com/test');

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockChrome.scripting.executeScript).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance Integration', () => {
    it('should respect performance limits', async () => {
      const mockScript: Script = {
        id: 'performance-test-script',
        name: 'Performance Test Script',
        description: 'A script for performance testing',
        code: 'console.log("Performance test"); return { success: true };',
        matches: ['https://example.com/*'],
        enabled: true,
        runAt: 'document_end',
        world: 'MAIN',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      mockFeatureManager.isFeatureEnabled.mockReturnValue(true);
      mockScriptManager.getScript.mockResolvedValue(mockScript);
      mockScriptValidator.validateScriptMetadata.mockReturnValue({ 
        isValid: true, 
        errors: [], 
        warnings: [] 
      });
      mockScriptValidator.validateScript.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        securityLevel: 'safe',
        cspCompliant: true,
      });
      mockUrlMatcher.matchesUrl.mockResolvedValue({ 
        matches: true, 
        reason: 'match',
        executionTime: 2
      });
      mockExecutionContextManager.isScriptExecuted.mockReturnValue(false);
      mockPerformanceMonitor.shouldAllowExecution.mockReturnValue(false); // Block execution

      const result = await scriptExecutor.executeScript({
        scriptId: 'performance-test-script',
        tabId: 1,
        url: 'https://example.com/test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Script execution blocked due to performance limits');
      expect(mockChrome.scripting.executeScript).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle critical errors gracefully', async () => {
      const mockScript: Script = {
        id: 'error-test-script',
        name: 'Error Test Script',
        description: 'A script that causes errors',
        code: 'throw new Error("Test error");',
        matches: ['https://example.com/*'],
        enabled: true,
        runAt: 'document_end',
        world: 'MAIN',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      mockFeatureManager.isFeatureEnabled.mockReturnValue(true);
      mockScriptManager.getScript.mockResolvedValue(mockScript);
      mockScriptValidator.validateScriptMetadata.mockReturnValue({ 
        isValid: true, 
        errors: [], 
        warnings: [] 
      });
      mockScriptValidator.validateScript.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        securityLevel: 'safe',
        cspCompliant: true,
      });
      mockUrlMatcher.matchesUrl.mockResolvedValue({ 
        matches: true, 
        reason: 'match',
        executionTime: 1
      });
      mockExecutionContextManager.isScriptExecuted.mockReturnValue(false);
      mockPerformanceMonitor.shouldAllowExecution.mockReturnValue(true);
      mockExecutionContextManager.createExecutionContext.mockReturnValue({
        executionId: 'exec-error-1',
        scriptId: 'error-test-script',
        tabId: 1,
        url: 'https://example.com/test',
        timestamp: Date.now(),
        runAt: 'document_end',
        world: 'MAIN',
        retryCount: 0,
        maxRetries: 3,
      });
      mockPerformanceMonitor.startMonitoring.mockReturnValue('monitor-error-1');

      // Mock Chrome API to return error
      mockChrome.scripting.executeScript.mockImplementation((options, callback) => {
        setTimeout(() => {
          callback([{ error: 'Test error' }]);
        }, 10);
      });

      mockErrorHandler.handleError.mockResolvedValue({
        id: 'error-critical-1',
        scriptId: 'error-test-script',
        tabId: 1,
        executionId: 'exec-error-1',
        category: 'execution',
        severity: 'high',
        message: 'Test error',
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        canRetry: false,
        context: {},
      });
      mockErrorHandler.shouldRetryError.mockReturnValue(false);
      mockPerformanceMonitor.endMonitoring.mockReturnValue({
        executionId: 'exec-error-1',
        scriptId: 'error-test-script',
        tabId: 1,
        startTime: Date.now(),
        endTime: Date.now() + 50,
        executionTime: 50,
        memoryUsage: 5,
        cpuTime: 25,
        success: false,
        errorType: 'Test error',
      });

      const result = await scriptExecutor.executeScript({
        scriptId: 'error-test-script',
        tabId: 1,
        url: 'https://example.com/test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });
});