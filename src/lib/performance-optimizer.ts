// Performance optimization utilities for handling large numbers of scripts
import { UserScript } from '@/types';

export class PerformanceOptimizer {
  private static scriptCache = new Map<string, UserScript>();
  private static urlCache = new Map<string, UserScript[]>();
  private static cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private static lastCleanup = Date.now();

  // Cache management
  static getCachedScript(id: string): UserScript | null {
    return this.scriptCache.get(id) || null;
  }

  static setCachedScript(id: string, script: UserScript): void {
    this.scriptCache.set(id, script);
    this.scheduleCleanup();
  }

  static getCachedScriptsForUrl(url: string): UserScript[] | null {
    return this.urlCache.get(url) || null;
  }

  static setCachedScriptsForUrl(url: string, scripts: UserScript[]): void {
    this.urlCache.set(url, scripts);
    this.scheduleCleanup();
  }

  static clearCache(): void {
    this.scriptCache.clear();
    this.urlCache.clear();
    this.lastCleanup = Date.now();
  }

  private static scheduleCleanup(): void {
    // Clean cache every 5 minutes
    if (Date.now() - this.lastCleanup > this.cacheExpiry) {
      this.cleanupExpiredCache();
      this.lastCleanup = Date.now();
    }
  }

  private static cleanupExpiredCache(): void {
    // Remove old entries (simplified - in production you'd track timestamps)
    if (this.scriptCache.size > 1000) {
      const entries = Array.from(this.scriptCache.entries());
      this.scriptCache.clear();
      // Keep only the most recent 500 entries
      entries.slice(-500).forEach(([key, value]) => {
        this.scriptCache.set(key, value);
      });
    }

    if (this.urlCache.size > 100) {
      const entries = Array.from(this.urlCache.entries());
      this.urlCache.clear();
      // Keep only the most recent 50 entries
      entries.slice(-50).forEach(([key, value]) => {
        this.urlCache.set(key, value);
      });
    }
  }

  // Batch operations for better performance
  static async batchProcessScripts<T>(
    scripts: UserScript[],
    processor: (script: UserScript) => Promise<T>,
    batchSize: number = 10
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < scripts.length; i += batchSize) {
      const batch = scripts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(script => processor(script))
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  // Optimized script matching with caching
  static matchesUrl(metadata: any, url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname;
      const protocol = urlObj.protocol;

      // Check match patterns
      for (const pattern of metadata.match || []) {
        if (this.patternMatches(pattern, protocol, hostname, pathname)) {
          return true;
        }
      }

      // Check include patterns
      for (const pattern of metadata.include || []) {
        if (this.patternMatches(pattern, protocol, hostname, pathname)) {
          return true;
        }
      }

      // Check exclude patterns
      for (const pattern of metadata.exclude || []) {
        if (this.patternMatches(pattern, protocol, hostname, pathname)) {
          return false;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  private static patternMatches(pattern: string, protocol: string, hostname: string, pathname: string): boolean {
    try {
      // Convert userscript pattern to regex
      let regex = pattern
        .replace(/\./g, '\\.') // Escape dots
        .replace(/\*/g, '.*') // * = any chars
        .replace(/\?/g, '\\?'); // Escape ?

      // Handle protocol matching
      if (pattern.startsWith('*://')) {
        regex = regex.replace('\\*://', '(https?|ftp)://');
      } else if (pattern.startsWith('http://')) {
        regex = regex.replace('http://', 'http://');
      } else if (pattern.startsWith('https://')) {
        regex = regex.replace('https://', 'https://');
      }

      const fullRegex = `^${regex}$`;
      const fullUrl = `${protocol}//${hostname}${pathname}`;
      
      return new RegExp(fullRegex).test(fullUrl);
    } catch {
      return false;
    }
  }

  // Memory usage monitoring
  static getMemoryUsage(): {
    scriptCache: number;
    urlCache: number;
    total: number;
  } {
    const scriptCacheSize = this.scriptCache.size;
    const urlCacheSize = this.urlCache.size;
    
    return {
      scriptCache: scriptCacheSize,
      urlCache: urlCacheSize,
      total: scriptCacheSize + urlCacheSize,
    };
  }

  // Performance metrics
  static measureExecutionTime<T>(fn: () => T | Promise<T>): Promise<{ result: T; executionTime: number }> {
    const start = performance.now();
    
    return Promise.resolve(fn()).then(result => {
      const executionTime = performance.now() - start;
      return { result, executionTime };
    });
  }

  // Debounced operations
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  // Throttled operations
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
}