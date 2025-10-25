import { describe, it, expect } from 'vitest';
import { parseMetadata } from '../metadata-parser';

describe('Metadata Parser', () => {
  it('parses valid userscript metadata', () => {
    const code = `// ==UserScript==
// @name         Test Script
// @namespace    https://example.com
// @version      1.0.0
// @description  A test script
// @author       Test Author
// @match        *://example.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-end
// ==/UserScript==

console.log('Hello World');`;

    const metadata = parseMetadata(code);

    expect(metadata.name).toBe('Test Script');
    expect(metadata.namespace).toBe('https://example.com');
    expect(metadata.version).toBe('1.0.0');
    expect(metadata.description).toBe('A test script');
    expect(metadata.author).toBe('Test Author');
    expect(metadata.match).toContain('*://example.com/*');
    expect(metadata.grant).toContain('GM_getValue');
    expect(metadata.grant).toContain('GM_setValue');
    expect(metadata.runAt).toBe('document-end');
  });

  it('handles missing required fields', () => {
    const code = `// ==UserScript==
// @version      1.0.0
// ==/UserScript==`;

    expect(() => parseMetadata(code)).toThrow('Script must have @name');
  });

  it('handles updateURL and downloadURL', () => {
    const code = `// ==UserScript==
// @name         Test Script
// @match        *://example.com/*
// @updateURL    https://example.com/script.user.js
// @downloadURL  https://example.com/script.user.js
// @icon         https://example.com/icon.png
// @homepageURL  https://example.com
// @supportURL   https://example.com/support
// ==/UserScript==`;

    const metadata = parseMetadata(code);

    expect(metadata.updateURL).toBe('https://example.com/script.user.js');
    expect(metadata.downloadURL).toBe('https://example.com/script.user.js');
    expect(metadata.icon).toBe('https://example.com/icon.png');
    expect(metadata.homepageURL).toBe('https://example.com');
    expect(metadata.supportURL).toBe('https://example.com/support');
  });

  it('sanitizes dangerous input', () => {
    const code = `// ==UserScript==
// @name         <script>alert('xss')</script>
// @match        *://example.com/*
// ==/UserScript==`;

    const metadata = parseMetadata(code);

    expect(metadata.name).not.toContain('<script>');
    expect(metadata.name).not.toContain('alert');
  });
});