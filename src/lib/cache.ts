// Performance caching layer for ScriptFlow
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class ScriptCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 60000; // 1 minute

  // Get cached data
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  // Set cached data
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  // Clear specific cache entry
  delete(key: string): void {
    this.cache.delete(key);
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }

    return {
      total: this.cache.size,
      valid: validEntries,
      expired: expiredEntries,
    };
  }
}

export const scriptCache = new ScriptCache();

// Cache keys
export const CACHE_KEYS = {
  SCRIPTS_FOR_URL: (url: string) => `scripts_for_url:${url}`,
  SCRIPT_BY_ID: (id: string) => `script:${id}`,
  ALL_SCRIPTS: 'all_scripts',
  SETTINGS: 'settings',
} as const;