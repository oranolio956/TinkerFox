/**
 * Unit Tests for Scheduler Core
 * 
 * Comprehensive test suite for the scheduling system with edge cases,
 * error scenarios, and integration testing.
 * 
 * @fileoverview Production-grade test coverage for mission-critical scheduling
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { SchedulerCore } from '../scheduler-core';
import { ScriptManager } from '../script-manager';
import { StorageManager } from '../storage-manager';
import { Logger } from '../logger';
import type { 
  ScheduleConfig, 
  OnceScheduleConfig, 
  IntervalScheduleConfig,
  CronScheduleConfig,
  ActiveSchedule,
  ScheduleExecutionResult,
  ScheduleExecutionError
} from '../../types/scheduling';

// Mock Chrome APIs
const mockChrome = {
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    getAll: vi.fn(),
    onAlarm: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
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
vi.mock('../script-manager');
vi.mock('../storage-manager');
vi.mock('../logger');

describe('SchedulerCore', () => {
  let scheduler: SchedulerCore;
  let mockScriptManager: jest.Mocked<ScriptManager>;
  let mockStorageManager: jest.Mocked<StorageManager>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup mock implementations
    mockScriptManager = {
      getScript: vi.fn(),
      executeScript: vi.fn(),
    } as any;

    mockStorageManager = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    } as any;

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    // Mock static methods
    (ScriptManager.getInstance as Mock).mockReturnValue(mockScriptManager);
    (StorageManager.getInstance as Mock).mockReturnValue(mockStorageManager);
    (Logger as any).mockImplementation(() => mockLogger);

    // Create scheduler instance
    scheduler = new SchedulerCore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      mockStorageManager.get.mockResolvedValue({});
      mockChrome.alarms.getAll.mockResolvedValue([]);

      await scheduler.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith('SchedulerCore initialized');
      expect(mockChrome.alarms.onAlarm.addListener).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      mockStorageManager.get.mockRejectedValue(new Error('Storage error'));

      await expect(scheduler.initialize()).rejects.toThrow('Storage error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize SchedulerCore',
        expect.any(Object)
      );
    });

    it('should load existing schedules from storage', async () => {
      const mockSchedules = {
        'schedule-1': {
          id: 'schedule-1',
          name: 'Test Schedule',
          scriptId: 'script-1',
          config: { mode: 'once', executeAt: Date.now() + 60000 },
          enabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };

      mockStorageManager.get.mockResolvedValue({ schedules: mockSchedules });
      mockChrome.alarms.getAll.mockResolvedValue([]);

      await scheduler.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Loaded schedules from storage',
        { count: 1 }
      );
    });
  });

  describe('Schedule Creation', () => {
    beforeEach(async () => {
      mockStorageManager.get.mockResolvedValue({});
      mockChrome.alarms.getAll.mockResolvedValue([]);
      await scheduler.initialize();
    });

    it('should create a once schedule successfully', async () => {
      const config: OnceScheduleConfig = {
        mode: 'once',
        executeAt: Date.now() + 60000,
      };

      const result = await scheduler.createSchedule({
        name: 'Test Once Schedule',
        description: 'A test schedule',
        scriptId: 'script-1',
        config,
        enabled: true,
      });

      expect(result.success).toBe(true);
      expect(result.scheduleId).toBeDefined();
      expect(mockChrome.alarms.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.stringContaining('schedule-'),
          when: config.executeAt,
        })
      );
    });

    it('should create an interval schedule successfully', async () => {
      const config: IntervalScheduleConfig = {
        mode: 'interval',
        intervalMs: 30000,
        maxExecutions: 5,
      };

      const result = await scheduler.createSchedule({
        name: 'Test Interval Schedule',
        description: 'A test interval schedule',
        scriptId: 'script-1',
        config,
        enabled: true,
      });

      expect(result.success).toBe(true);
      expect(mockChrome.alarms.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.stringContaining('schedule-'),
          delayInMinutes: 0.5, // 30 seconds
          periodInMinutes: 0.5,
        })
      );
    });

    it('should create a cron schedule successfully', async () => {
      const config: CronScheduleConfig = {
        mode: 'cron',
        cronExpression: '0 9 * * 1-5', // Weekdays at 9 AM
      };

      const result = await scheduler.createSchedule({
        name: 'Test Cron Schedule',
        description: 'A test cron schedule',
        scriptId: 'script-1',
        config,
        enabled: true,
      });

      expect(result.success).toBe(true);
      expect(mockChrome.alarms.create).toHaveBeenCalled();
    });

    it('should validate schedule configuration', async () => {
      const invalidConfig = {
        mode: 'once',
        executeAt: Date.now() - 60000, // Past time
      } as OnceScheduleConfig;

      const result = await scheduler.createSchedule({
        name: 'Invalid Schedule',
        description: 'A schedule with invalid config',
        scriptId: 'script-1',
        config: invalidConfig,
        enabled: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Execution time must be in the future');
    });

    it('should handle Chrome API errors during creation', async () => {
      mockChrome.alarms.create.mockRejectedValue(new Error('Chrome API error'));

      const config: OnceScheduleConfig = {
        mode: 'once',
        executeAt: Date.now() + 60000,
      };

      const result = await scheduler.createSchedule({
        name: 'Test Schedule',
        description: 'A test schedule',
        scriptId: 'script-1',
        config,
        enabled: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Chrome API error');
    });
  });

  describe('Schedule Execution', () => {
    let mockSchedule: ActiveSchedule;

    beforeEach(async () => {
      mockStorageManager.get.mockResolvedValue({});
      mockChrome.alarms.getAll.mockResolvedValue([]);
      await scheduler.initialize();

      mockSchedule = {
        id: 'schedule-1',
        name: 'Test Schedule',
        description: 'A test schedule',
        scriptId: 'script-1',
        config: { mode: 'once', executeAt: Date.now() + 60000 },
        enabled: true,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastExecutedAt: null,
        executionCount: 0,
        metadata: {},
      };
    });

    it('should execute schedule successfully', async () => {
      mockScriptManager.getScript.mockResolvedValue({
        id: 'script-1',
        name: 'Test Script',
        code: 'console.log("Hello World");',
        matches: ['<all_urls>'],
        enabled: true,
        runAt: 'document_end',
        world: 'MAIN',
      });

      mockScriptManager.executeScript.mockResolvedValue({
        success: true,
        result: 'Script executed successfully',
        executionTime: 100,
      });

      const result = await scheduler.executeSchedule(mockSchedule, {
        tabId: 1,
        url: 'https://example.com',
        timestamp: Date.now(),
      });

      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(mockScriptManager.executeScript).toHaveBeenCalledWith(
        'script-1',
        1,
        'MAIN'
      );
    });

    it('should handle script not found error', async () => {
      mockScriptManager.getScript.mockResolvedValue(null);

      const result = await scheduler.executeSchedule(mockSchedule, {
        tabId: 1,
        url: 'https://example.com',
        timestamp: Date.now(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Script not found');
    });

    it('should handle script execution failure', async () => {
      mockScriptManager.getScript.mockResolvedValue({
        id: 'script-1',
        name: 'Test Script',
        code: 'console.log("Hello World");',
        matches: ['<all_urls>'],
        enabled: true,
        runAt: 'document_end',
        world: 'MAIN',
      });

      mockScriptManager.executeScript.mockRejectedValue(new Error('Script execution failed'));

      const result = await scheduler.executeSchedule(mockSchedule, {
        tabId: 1,
        url: 'https://example.com',
        timestamp: Date.now(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Script execution failed');
    });

    it('should retry failed executions', async () => {
      mockScriptManager.getScript.mockResolvedValue({
        id: 'script-1',
        name: 'Test Script',
        code: 'console.log("Hello World");',
        matches: ['<all_urls>'],
        enabled: true,
        runAt: 'document_end',
        world: 'MAIN',
      });

      // First call fails, second succeeds
      mockScriptManager.executeScript
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          success: true,
          result: 'Script executed successfully',
          executionTime: 100,
        });

      const result = await scheduler.executeSchedule(mockSchedule, {
        tabId: 1,
        url: 'https://example.com',
        timestamp: Date.now(),
      });

      expect(result.success).toBe(true);
      expect(mockScriptManager.executeScript).toHaveBeenCalledTimes(2);
    });

    it('should respect retry limits', async () => {
      mockScriptManager.getScript.mockResolvedValue({
        id: 'script-1',
        name: 'Test Script',
        code: 'console.log("Hello World");',
        matches: ['<all_urls>'],
        enabled: true,
        runAt: 'document_end',
        world: 'MAIN',
      });

      // All calls fail
      mockScriptManager.executeScript.mockRejectedValue(new Error('Persistent failure'));

      const result = await scheduler.executeSchedule(mockSchedule, {
        tabId: 1,
        url: 'https://example.com',
        timestamp: Date.now(),
      });

      expect(result.success).toBe(false);
      expect(mockScriptManager.executeScript).toHaveBeenCalledTimes(3); // Max retries
    });
  });

  describe('Schedule Management', () => {
    beforeEach(async () => {
      mockStorageManager.get.mockResolvedValue({});
      mockChrome.alarms.getAll.mockResolvedValue([]);
      await scheduler.initialize();
    });

    it('should update schedule successfully', async () => {
      const config: OnceScheduleConfig = {
        mode: 'once',
        executeAt: Date.now() + 60000,
      };

      // Create initial schedule
      const createResult = await scheduler.createSchedule({
        name: 'Test Schedule',
        description: 'A test schedule',
        scriptId: 'script-1',
        config,
        enabled: true,
      });

      expect(createResult.success).toBe(true);

      // Update schedule
      const updateResult = await scheduler.updateSchedule(createResult.scheduleId!, {
        name: 'Updated Schedule',
        description: 'An updated schedule',
        scriptId: 'script-1',
        config: { ...config, executeAt: Date.now() + 120000 },
        enabled: true,
      });

      expect(updateResult.success).toBe(true);
      expect(mockChrome.alarms.clear).toHaveBeenCalled();
      expect(mockChrome.alarms.create).toHaveBeenCalledTimes(2);
    });

    it('should delete schedule successfully', async () => {
      const config: OnceScheduleConfig = {
        mode: 'once',
        executeAt: Date.now() + 60000,
      };

      // Create schedule
      const createResult = await scheduler.createSchedule({
        name: 'Test Schedule',
        description: 'A test schedule',
        scriptId: 'script-1',
        config,
        enabled: true,
      });

      expect(createResult.success).toBe(true);

      // Delete schedule
      const deleteResult = await scheduler.deleteSchedule(createResult.scheduleId!);

      expect(deleteResult.success).toBe(true);
      expect(mockChrome.alarms.clear).toHaveBeenCalled();
    });

    it('should pause and resume schedule', async () => {
      const config: OnceScheduleConfig = {
        mode: 'once',
        executeAt: Date.now() + 60000,
      };

      // Create schedule
      const createResult = await scheduler.createSchedule({
        name: 'Test Schedule',
        description: 'A test schedule',
        scriptId: 'script-1',
        config,
        enabled: true,
      });

      expect(createResult.success).toBe(true);

      // Pause schedule
      const pauseResult = await scheduler.pauseSchedule(createResult.scheduleId!);
      expect(pauseResult.success).toBe(true);

      // Resume schedule
      const resumeResult = await scheduler.resumeSchedule(createResult.scheduleId!);
      expect(resumeResult.success).toBe(true);
    });

    it('should handle non-existent schedule operations', async () => {
      const updateResult = await scheduler.updateSchedule('non-existent', {
        name: 'Updated Schedule',
        description: 'An updated schedule',
        scriptId: 'script-1',
        config: { mode: 'once', executeAt: Date.now() + 60000 },
        enabled: true,
      });

      expect(updateResult.success).toBe(false);
      expect(updateResult.error).toContain('Schedule not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      mockStorageManager.get.mockRejectedValue(new Error('Storage connection failed'));

      await expect(scheduler.initialize()).rejects.toThrow('Storage connection failed');
    });

    it('should handle Chrome API errors gracefully', async () => {
      mockStorageManager.get.mockResolvedValue({});
      mockChrome.alarms.getAll.mockRejectedValue(new Error('Chrome API unavailable'));

      await expect(scheduler.initialize()).rejects.toThrow('Chrome API unavailable');
    });

    it('should validate input parameters', async () => {
      await scheduler.initialize();

      // Test invalid schedule data
      const result = await scheduler.createSchedule({
        name: '', // Empty name
        description: 'A test schedule',
        scriptId: '', // Empty script ID
        config: { mode: 'once', executeAt: Date.now() + 60000 },
        enabled: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('validation');
    });
  });

  describe('Performance and Limits', () => {
    it('should respect maximum concurrent schedules limit', async () => {
      mockStorageManager.get.mockResolvedValue({});
      mockChrome.alarms.getAll.mockResolvedValue([]);
      await scheduler.initialize();

      // Create maximum number of schedules
      const maxSchedules = 100; // Assuming limit is 100
      const promises = [];

      for (let i = 0; i < maxSchedules + 1; i++) {
        promises.push(
          scheduler.createSchedule({
            name: `Test Schedule ${i}`,
            description: 'A test schedule',
            scriptId: 'script-1',
            config: { mode: 'once', executeAt: Date.now() + 60000 + i * 1000 },
            enabled: true,
          })
        );
      }

      const results = await Promise.all(promises);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      expect(successful.length).toBeLessThanOrEqual(maxSchedules);
      expect(failed.length).toBeGreaterThan(0);
    });

    it('should handle rapid schedule creation', async () => {
      mockStorageManager.get.mockResolvedValue({});
      mockChrome.alarms.getAll.mockResolvedValue([]);
      await scheduler.initialize();

      const promises = Array.from({ length: 10 }, (_, i) =>
        scheduler.createSchedule({
          name: `Rapid Schedule ${i}`,
          description: 'A rapidly created schedule',
          scriptId: 'script-1',
          config: { mode: 'once', executeAt: Date.now() + 60000 + i * 1000 },
          enabled: true,
        })
      );

      const results = await Promise.all(promises);
      const successful = results.filter(r => r.success);

      expect(successful.length).toBe(10);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete schedule lifecycle', async () => {
      mockStorageManager.get.mockResolvedValue({});
      mockChrome.alarms.getAll.mockResolvedValue([]);
      await scheduler.initialize();

      // Create schedule
      const createResult = await scheduler.createSchedule({
        name: 'Lifecycle Test Schedule',
        description: 'A schedule for testing complete lifecycle',
        scriptId: 'script-1',
        config: { mode: 'once', executeAt: Date.now() + 60000 },
        enabled: true,
      });

      expect(createResult.success).toBe(true);

      // Update schedule
      const updateResult = await scheduler.updateSchedule(createResult.scheduleId!, {
        name: 'Updated Lifecycle Schedule',
        description: 'An updated lifecycle schedule',
        scriptId: 'script-1',
        config: { mode: 'once', executeAt: Date.now() + 120000 },
        enabled: true,
      });

      expect(updateResult.success).toBe(true);

      // Pause schedule
      const pauseResult = await scheduler.pauseSchedule(createResult.scheduleId!);
      expect(pauseResult.success).toBe(true);

      // Resume schedule
      const resumeResult = await scheduler.resumeSchedule(createResult.scheduleId!);
      expect(resumeResult.success).toBe(true);

      // Delete schedule
      const deleteResult = await scheduler.deleteSchedule(createResult.scheduleId!);
      expect(deleteResult.success).toBe(true);
    });

    it('should handle alarm events correctly', async () => {
      mockStorageManager.get.mockResolvedValue({});
      mockChrome.alarms.getAll.mockResolvedValue([]);
      await scheduler.initialize();

      // Create schedule
      const createResult = await scheduler.createSchedule({
        name: 'Alarm Test Schedule',
        description: 'A schedule for testing alarm events',
        scriptId: 'script-1',
        config: { mode: 'once', executeAt: Date.now() + 60000 },
        enabled: true,
      });

      expect(createResult.success).toBe(true);

      // Simulate alarm event
      const alarmListener = mockChrome.alarms.onAlarm.addListener.mock.calls[0][0];
      const mockAlarm = {
        name: createResult.scheduleId!,
        scheduledTime: Date.now() + 60000,
      };

      // Mock successful execution
      mockScriptManager.getScript.mockResolvedValue({
        id: 'script-1',
        name: 'Test Script',
        code: 'console.log("Hello World");',
        matches: ['<all_urls>'],
        enabled: true,
        runAt: 'document_end',
        world: 'MAIN',
      });

      mockScriptManager.executeScript.mockResolvedValue({
        success: true,
        result: 'Script executed successfully',
        executionTime: 100,
      });

      // Trigger alarm
      await alarmListener(mockAlarm);

      expect(mockScriptManager.executeScript).toHaveBeenCalled();
    });
  });
});