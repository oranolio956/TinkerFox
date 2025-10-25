import { describe, it, expect, beforeEach } from 'vitest';
import { scriptCache, CACHE_KEYS } from '../cache';

describe('Script Cache', () => {
  beforeEach(() => {
    scriptCache.clear();
  });

  it('stores and retrieves data', () => {
    const testData = { scripts: ['script1', 'script2'] };
    scriptCache.set('test-key', testData);

    const retrieved = scriptCache.get('test-key');
    expect(retrieved).toEqual(testData);
  });

  it('returns null for non-existent keys', () => {
    const retrieved = scriptCache.get('non-existent');
    expect(retrieved).toBeNull();
  });

  it('expires data after TTL', async () => {
    const testData = { scripts: ['script1'] };
    scriptCache.set('test-key', testData, 100); // 100ms TTL

    // Should exist immediately
    expect(scriptCache.get('test-key')).toEqual(testData);

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should be expired
    expect(scriptCache.get('test-key')).toBeNull();
  });

  it('provides cache statistics', () => {
    scriptCache.set('key1', 'data1');
    scriptCache.set('key2', 'data2');

    const stats = scriptCache.getStats();
    expect(stats.total).toBe(2);
    expect(stats.valid).toBe(2);
    expect(stats.expired).toBe(0);
  });

  it('clears specific entries', () => {
    scriptCache.set('key1', 'data1');
    scriptCache.set('key2', 'data2');

    scriptCache.delete('key1');

    expect(scriptCache.get('key1')).toBeNull();
    expect(scriptCache.get('key2')).toBe('data2');
  });
});