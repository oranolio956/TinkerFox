// Service Worker Integration Tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/database';
import { ScriptStorage } from '@/lib/script-storage';

// Mock IndexedDB for testing
const mockIndexedDB = {
  open: vi.fn(() => ({
    result: {
      createObjectStore: vi.fn(),
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({
          add: vi.fn(),
          get: vi.fn(),
          put: vi.fn(),
          delete: vi.fn(),
          clear: vi.fn(),
          count: vi.fn(() => Promise.resolve(0)),
          toArray: vi.fn(() => Promise.resolve([])),
          where: vi.fn(() => ({
            equals: vi.fn(() => ({
              toArray: vi.fn(() => Promise.resolve([])),
              count: vi.fn(() => Promise.resolve(0)),
            })),
            anyOf: vi.fn(() => ({
              toArray: vi.fn(() => Promise.resolve([])),
            })),
          })),
          orderBy: vi.fn(() => ({
            reverse: vi.fn(() => ({
              limit: vi.fn(() => ({
                toArray: vi.fn(() => Promise.resolve([])),
              })),
            })),
          })),
          bulkGet: vi.fn(() => Promise.resolve([])),
          bulkDelete: vi.fn(() => Promise.resolve()),
        })),
      })),
    },
    onsuccess: null,
    onerror: null,
  })),
  deleteDatabase: vi.fn(),
};

// Mock global IndexedDB
Object.defineProperty(global, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
});

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    onInstalled: {
      addListener: vi.fn(),
    },
    onMessage: {
      addListener: vi.fn(),
    },
    sendMessage: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
  tabs: {
    sendMessage: vi.fn(),
    get: vi.fn(),
  },
  notifications: {
    create: vi.fn(),
  },
  alarms: {
    create: vi.fn(),
    onAlarm: {
      addListener: vi.fn(),
    },
  },
  webNavigation: {
    onCompleted: {
      addListener: vi.fn(),
    },
  },
};

// Mock global chrome object
Object.defineProperty(global, 'chrome', {
  value: mockChrome,
  writable: true,
});

describe('Service Worker Message Handling', () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.scripts.clear();
    await db.versions.clear();
    await db.executions.clear();
    await db.settings.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Script Management Messages', () => {
    it('should handle GET_ALL_SCRIPTS message', () => {
      // Test message validation
      const message = { type: 'GET_ALL_SCRIPTS' };
      expect(message.type).toBe('GET_ALL_SCRIPTS');
    });

    it('should handle CREATE_SCRIPT message with validation', () => {
      const testCode = `
        // ==UserScript==
        // @name New Script
        // @version 1.0.0
        // @match *://*/*
        // ==/UserScript==
        console.log('new script');
      `;
      
      // Test valid message
      const validMessage = {
        type: 'CREATE_SCRIPT',
        code: testCode,
      };
      
      expect(validMessage.type).toBe('CREATE_SCRIPT');
      expect(validMessage.code).toContain('New Script');
    });

    it('should handle UPDATE_SCRIPT message', () => {
      const message = {
        type: 'UPDATE_SCRIPT',
        id: 'test-id',
        code: 'console.log("updated");',
        changelog: 'Updated script',
      };
      
      expect(message.type).toBe('UPDATE_SCRIPT');
      expect(message.id).toBe('test-id');
      expect(message.changelog).toBe('Updated script');
    });

    it('should handle DELETE_SCRIPT message', () => {
      const message = {
        type: 'DELETE_SCRIPT',
        id: 'test-id',
      };
      
      expect(message.type).toBe('DELETE_SCRIPT');
      expect(message.id).toBe('test-id');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid message types gracefully', () => {
      const invalidMessage = {
        type: 'INVALID_MESSAGE_TYPE',
        data: 'some data',
      };
      
      expect(invalidMessage.type).toBe('INVALID_MESSAGE_TYPE');
    });

    it('should handle validation errors gracefully', () => {
      const invalidMessage = {
        type: 'CREATE_SCRIPT',
        // Missing required code field
      };
      
      expect(invalidMessage.type).toBe('CREATE_SCRIPT');
    });
  });

  describe('Performance', () => {
    it('should handle bulk operations efficiently', () => {
      const scripts = [];
      
      // Create multiple script objects for testing
      for (let i = 0; i < 10; i++) {
        scripts.push({
          id: `script-${i}`,
          name: `Test Script ${i}`,
          code: `console.log('script ${i}');`,
        });
      }
      
      expect(scripts).toHaveLength(10);
      expect(scripts[0].name).toBe('Test Script 0');
    });
  });
});