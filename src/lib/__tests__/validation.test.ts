// Validation Tests
import { describe, it, expect } from 'vitest';
import { 
  validateMessage, 
  sanitizeScriptCode, 
  sanitizeScriptName, 
  sanitizeUrl,
  MessageSchema 
} from '../validation';

describe('Message Validation', () => {
  describe('validateMessage', () => {
    it('should validate valid messages', () => {
      const validMessages = [
        { type: 'GET_ALL_SCRIPTS' },
        { type: 'GET_SCRIPTS_FOR_TAB', tabId: 123 },
        { type: 'CREATE_SCRIPT', code: 'console.log("test");' },
        { type: 'PING' },
      ];

      validMessages.forEach(message => {
        const result = validateMessage(message);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(message);
      });
    });

    it('should reject invalid messages', () => {
      const invalidMessages = [
        { type: 'INVALID_TYPE' },
        { type: 'GET_SCRIPTS_FOR_TAB' }, // Missing tabId
        { type: 'CREATE_SCRIPT' }, // Missing code
        { type: 'CREATE_SCRIPT', code: '' }, // Empty code
        { type: 'CREATE_SCRIPT', code: 'a'.repeat(1000001) }, // Too long
      ];

      invalidMessages.forEach(message => {
        const result = validateMessage(message);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Validation failed');
      });
    });

    it('should validate script code length limits', () => {
      const longCode = 'a'.repeat(1000001); // 1MB + 1 byte
      const message = { type: 'CREATE_SCRIPT', code: longCode };
      
      const result = validateMessage(message);
      expect(result.success).toBe(false);
    });

    it('should validate URL format', () => {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'https://subdomain.example.com/path?query=value',
      ];

      const invalidUrls = [
        'not-a-url',
        'ftp://example.com', // Wrong protocol
        'javascript:alert(1)', // Dangerous protocol
      ];

      validUrls.forEach(url => {
        const message = { type: 'GET_SCRIPTS_FOR_URL', url };
        const result = validateMessage(message);
        expect(result.success).toBe(true);
      });

      invalidUrls.forEach(url => {
        const message = { type: 'GET_SCRIPTS_FOR_URL', url };
        const result = validateMessage(message);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('sanitizeScriptCode', () => {
    it('should remove control characters', () => {
      const codeWithControlChars = 'console.log("test");\x00\x01\x02';
      const sanitized = sanitizeScriptCode(codeWithControlChars);
      expect(sanitized).toBe('console.log("test");');
    });

    it('should preserve newlines and tabs', () => {
      const codeWithWhitespace = 'console.log("test");\n\tconst x = 1;';
      const sanitized = sanitizeScriptCode(codeWithWhitespace);
      expect(sanitized).toBe(codeWithWhitespace);
    });

    it('should handle empty code', () => {
      const sanitized = sanitizeScriptCode('');
      expect(sanitized).toBe('');
    });
  });

  describe('sanitizeScriptName', () => {
    it('should remove HTML tags', () => {
      const nameWithTags = '<script>alert(1)</script>Test Script';
      const sanitized = sanitizeScriptName(nameWithTags);
      expect(sanitized).toBe('scriptalert(1)/scriptTest Script');
    });

    it('should remove special characters', () => {
      const nameWithSpecialChars = 'Test@Script#with$special%chars';
      const sanitized = sanitizeScriptName(nameWithSpecialChars);
      expect(sanitized).toBe('TestScriptwithspecialchars');
    });

    it('should limit length', () => {
      const longName = 'a'.repeat(300);
      const sanitized = sanitizeScriptName(longName);
      expect(sanitized.length).toBe(200);
    });

    it('should trim whitespace', () => {
      const nameWithWhitespace = '  Test Script  ';
      const sanitized = sanitizeScriptName(nameWithWhitespace);
      expect(sanitized).toBe('Test Script');
    });
  });

  describe('sanitizeUrl', () => {
    it('should accept valid HTTP/HTTPS URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'https://subdomain.example.com/path?query=value',
      ];

      validUrls.forEach(url => {
        expect(() => sanitizeUrl(url)).not.toThrow();
      });
    });

    it('should reject invalid protocols', () => {
      const invalidUrls = [
        'ftp://example.com',
        'javascript:alert(1)',
        'file:///etc/passwd',
        'data:text/html,<script>alert(1)</script>',
      ];

      invalidUrls.forEach(url => {
        expect(() => sanitizeUrl(url)).toThrow('Invalid protocol');
      });
    });

    it('should reject malformed URLs', () => {
      const malformedUrls = [
        'not-a-url',
        'http://',
        'https://',
        '://example.com',
      ];

      malformedUrls.forEach(url => {
        expect(() => sanitizeUrl(url)).toThrow('Invalid URL format');
      });
    });
  });

  describe('MessageSchema', () => {
    it('should validate all message types', () => {
      const messageTypes = [
        'GET_ALL_SCRIPTS',
        'GET_SCRIPTS_FOR_TAB',
        'GET_SCRIPTS_FOR_URL',
        'CREATE_SCRIPT',
        'UPDATE_SCRIPT',
        'DELETE_SCRIPT',
        'TOGGLE_SCRIPT',
        'INJECT_SCRIPT',
        'INJECT_LIBRARY',
        'GET_EXECUTION_LOGS',
        'GM_XHR_REQUEST',
        'GM_NOTIFICATION',
        'PING',
        'SCRIPT_INJECTION_ERROR',
      ];

      messageTypes.forEach(type => {
        const message = { type };
        const result = MessageSchema.safeParse(message);
        expect(result.success).toBe(true);
      });
    });
  });
});