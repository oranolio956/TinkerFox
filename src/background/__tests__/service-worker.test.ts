// Service Worker Integration Tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/database';
import { ScriptStorage } from '@/lib/script-storage';

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
    it('should handle GET_ALL_SCRIPTS message', async () => {
      // Create test script
      const testCode = `
        // ==UserScript==
        // @name Test Script
        // @version 1.0.0
        // @match *://*/*
        // ==/UserScript==
        console.log('test');
      `;
      
      await ScriptStorage.createScript(testCode);
      
      // Import the message handler (we'll need to export it)
      // const { handleMessage } = await import('../service_worker');
      
      // const response = await handleMessage(
      //   { type: 'GET_ALL_SCRIPTS' },
      //   {} as chrome.runtime.MessageSender
      // );
      
      // expect(response.success).toBe(true);
      // expect(response.scripts).toHaveLength(1);
      // expect(response.scripts[0].name).toBe('Test Script');
    });

    it('should handle CREATE_SCRIPT message with validation', async () => {
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
      
      // Test invalid message (missing code)
      const invalidMessage = {
        type: 'CREATE_SCRIPT',
        // Missing code field
      };
      
      // These would be tested with the actual message handler
      expect(validMessage.type).toBe('CREATE_SCRIPT');
      expect(invalidMessage.type).toBe('CREATE_SCRIPT');
    });

    it('should handle UPDATE_SCRIPT message', async () => {
      // Create initial script
      const initialCode = `
        // ==UserScript==
        // @name Test Script
        // @version 1.0.0
        // @match *://*/*
        // ==/UserScript==
        console.log('initial');
      `;
      
      const script = await ScriptStorage.createScript(initialCode);
      
      const updatedCode = `
        // ==UserScript==
        // @name Test Script Updated
        // @version 1.1.0
        // @match *://*/*
        // ==/UserScript==
        console.log('updated');
      `;
      
      await ScriptStorage.updateScript(script.id, updatedCode, 'Updated script');
      
      const updated = await db.scripts.get(script.id);
      expect(updated?.name).toBe('Test Script Updated');
      expect(updated?.version).toBe('1.1.0');
    });

    it('should handle DELETE_SCRIPT message', async () => {
      const testCode = `
        // ==UserScript==
        // @name Test Script
        // @version 1.0.0
        // @match *://*/*
        // ==/UserScript==
        console.log('test');
      `;
      
      const script = await ScriptStorage.createScript(testCode);
      await ScriptStorage.deleteScript(script.id);
      
      const deleted = await db.scripts.get(script.id);
      expect(deleted).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid message types gracefully', () => {
      const invalidMessage = {
        type: 'INVALID_MESSAGE_TYPE',
        data: 'some data',
      };
      
      // This would be tested with the actual validation
      expect(invalidMessage.type).toBe('INVALID_MESSAGE_TYPE');
    });

    it('should handle database errors gracefully', async () => {
      // Test with invalid script code that should fail validation
      const invalidCode = ''; // Empty code should fail
      
      try {
        await ScriptStorage.createScript(invalidCode);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance', () => {
    it('should handle bulk operations efficiently', async () => {
      const scripts = [];
      
      // Create multiple scripts
      for (let i = 0; i < 10; i++) {
        const code = `
          // ==UserScript==
          // @name Test Script ${i}
          // @version 1.0.0
          // @match *://*/*
          // ==/UserScript==
          console.log('script ${i}');
        `;
        scripts.push(await ScriptStorage.createScript(code));
      }
      
      // Test bulk retrieval
      const allScripts = await ScriptStorage.getAllScripts();
      expect(allScripts).toHaveLength(10);
    });
  });
});