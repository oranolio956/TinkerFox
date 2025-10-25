/**
 * URL Matching Engine for ScriptFlow
 * 
 * Handles @match, @include, @exclude directive parsing and validation
 * with protection against ReDoS attacks and malformed patterns.
 * 
 * @fileoverview Production-grade URL matching with security hardening
 */

import { Logger } from '../lib/logger';
import type { Script } from '../types';

/**
 * URL pattern validation result
 */
export interface PatternValidationResult {
  readonly isValid: boolean;
  readonly error?: string;
  readonly warning?: string;
  readonly normalizedPattern?: string;
}

/**
 * URL match result
 */
export interface UrlMatchResult {
  readonly matches: boolean;
  readonly reason: 'match' | 'include' | 'exclude' | 'no_pattern';
  readonly pattern?: string;
  readonly executionTime: number;
}

/**
 * Compiled URL pattern for efficient matching
 */
interface CompiledPattern {
  readonly type: 'match' | 'include' | 'exclude';
  readonly pattern: string;
  readonly regex: RegExp;
  readonly isWildcard: boolean;
  readonly complexity: 'low' | 'medium' | 'high';
}

/**
 * URL Matcher class for secure and efficient URL pattern matching
 */
export class UrlMatcher {
  private static instance: UrlMatcher | null = null;
  private readonly logger: Logger;
  private readonly compiledPatterns: Map<string, CompiledPattern>;
  private readonly maxPatternComplexity: number = 1000; // Prevent ReDoS
  private readonly maxCompiledPatterns: number = 1000; // Memory limit

  private constructor() {
    this.logger = new Logger('UrlMatcher');
    this.compiledPatterns = new Map();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): UrlMatcher {
    if (!UrlMatcher.instance) {
      UrlMatcher.instance = new UrlMatcher();
    }
    return UrlMatcher.instance;
  }

  /**
   * Validate and normalize a URL pattern
   */
  public validatePattern(pattern: string, type: 'match' | 'include' | 'exclude'): PatternValidationResult {
    try {
      // Basic validation
      if (!pattern || typeof pattern !== 'string') {
        return {
          isValid: false,
          error: 'Pattern must be a non-empty string',
        };
      }

      if (pattern.length > 2000) {
        return {
          isValid: false,
          error: 'Pattern too long (max 2000 characters)',
        };
      }

      // Check for dangerous patterns that could cause ReDoS
      if (this.containsReDoSPattern(pattern)) {
        return {
          isValid: false,
          error: 'Pattern contains potentially dangerous regex that could cause ReDoS',
        };
      }

      // Normalize the pattern
      const normalizedPattern = this.normalizePattern(pattern, type);
      
      // Validate the normalized pattern
      const validationResult = this.validateNormalizedPattern(normalizedPattern);
      if (!validationResult.isValid) {
        return validationResult;
      }

      // Check pattern complexity
      const complexity = this.calculatePatternComplexity(normalizedPattern);
      if (complexity === 'high') {
        return {
          isValid: true,
          warning: 'Pattern has high complexity and may impact performance',
          normalizedPattern,
        };
      }

      return {
        isValid: true,
        normalizedPattern,
      };
    } catch (error) {
      this.logger.error('Pattern validation failed', { pattern, type, error });
      return {
        isValid: false,
        error: 'Pattern validation failed due to internal error',
      };
    }
  }

  /**
   * Check if a URL matches the script's patterns
   */
  public async matchesUrl(script: Script, url: string): Promise<UrlMatchResult> {
    const startTime = performance.now();
    
    try {
      // Validate URL
      if (!this.isValidUrl(url)) {
        return {
          matches: false,
          reason: 'no_pattern',
          executionTime: performance.now() - startTime,
        };
      }

      // Parse URL for matching
      const urlObj = new URL(url);
      const urlToMatch = urlObj.origin + urlObj.pathname + urlObj.search + urlObj.hash;

      // Check @exclude patterns first (highest priority)
      if (script.exclude && script.exclude.length > 0) {
        for (const excludePattern of script.exclude) {
          const compiledPattern = await this.compilePattern(excludePattern, 'exclude');
          if (compiledPattern && this.testPattern(compiledPattern, urlToMatch)) {
            return {
              matches: false,
              reason: 'exclude',
              pattern: excludePattern,
              executionTime: performance.now() - startTime,
            };
          }
        }
      }

      // Check @match patterns
      if (script.matches && script.matches.length > 0) {
        for (const matchPattern of script.matches) {
          const compiledPattern = await this.compilePattern(matchPattern, 'match');
          if (compiledPattern && this.testPattern(compiledPattern, urlToMatch)) {
            return {
              matches: true,
              reason: 'match',
              pattern: matchPattern,
              executionTime: performance.now() - startTime,
            };
          }
        }
      }

      // Check @include patterns
      if (script.include && script.include.length > 0) {
        for (const includePattern of script.include) {
          const compiledPattern = await this.compilePattern(includePattern, 'include');
          if (compiledPattern && this.testPattern(compiledPattern, urlToMatch)) {
            return {
              matches: true,
              reason: 'include',
              pattern: includePattern,
              executionTime: performance.now() - startTime,
            };
          }
        }
      }

      // No patterns matched
      return {
        matches: false,
        reason: 'no_pattern',
        executionTime: performance.now() - startTime,
      };
    } catch (error) {
      this.logger.error('URL matching failed', { scriptId: script.id, url, error });
      return {
        matches: false,
        reason: 'no_pattern',
        executionTime: performance.now() - startTime,
      };
    }
  }

  /**
   * Get all scripts that should run on a given URL
   */
  public async getMatchingScripts(scripts: Script[], url: string): Promise<{
    matchingScripts: Script[];
    executionTime: number;
  }> {
    const startTime = performance.now();
    const matchingScripts: Script[] = [];

    try {
      // Process scripts in parallel for better performance
      const matchPromises = scripts.map(async (script) => {
        if (!script.enabled) {
          return null;
        }

        const matchResult = await this.matchesUrl(script, url);
        return matchResult.matches ? script : null;
      });

      const results = await Promise.all(matchPromises);
      
      for (const result of results) {
        if (result) {
          matchingScripts.push(result);
        }
      }

      return {
        matchingScripts,
        executionTime: performance.now() - startTime,
      };
    } catch (error) {
      this.logger.error('Failed to get matching scripts', { url, error });
      return {
        matchingScripts: [],
        executionTime: performance.now() - startTime,
      };
    }
  }

  /**
   * Clear compiled patterns cache
   */
  public clearCache(): void {
    this.compiledPatterns.clear();
    this.logger.info('Pattern cache cleared');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.compiledPatterns.size,
      maxSize: this.maxCompiledPatterns,
      hitRate: 0, // TODO: Implement hit rate tracking
    };
  }

  /**
   * Check if pattern contains ReDoS vulnerabilities
   */
  private containsReDoSPattern(pattern: string): boolean {
    // Common ReDoS patterns
    const redosPatterns = [
      /\(.*\)\*/, // Nested quantifiers
      /\(.*\)\+.*\*/, // Nested quantifiers with different types
      /\(.*\)\{.*,.*\}.*\*/, // Complex nested quantifiers
      /\(.*\)\*.*\(.*\)\*/, // Multiple nested quantifiers
      /\(.*\+.*\)\*/, // Nested plus and star
      /\(.*\*.*\)\*/, // Nested star quantifiers
    ];

    return redosPatterns.some(redosPattern => redosPattern.test(pattern));
  }

  /**
   * Normalize URL pattern based on type
   */
  private normalizePattern(pattern: string, type: 'match' | 'include' | 'exclude'): string {
    let normalized = pattern.trim();

    // Handle @match patterns (Chrome extension match patterns)
    if (type === 'match') {
      // Convert Chrome extension match patterns to regex
      normalized = this.convertMatchPatternToRegex(normalized);
    } else {
      // Handle @include/@exclude patterns (glob patterns)
      normalized = this.convertGlobToRegex(normalized);
    }

    return normalized;
  }

  /**
   * Convert Chrome extension match pattern to regex
   */
  private convertMatchPatternToRegex(pattern: string): string {
    // Escape special regex characters except for * and ?
    let regex = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    // Ensure the pattern matches the entire URL
    if (!regex.startsWith('^')) {
      regex = '^' + regex;
    }
    if (!regex.endsWith('$')) {
      regex = regex + '$';
    }

    return regex;
  }

  /**
   * Convert glob pattern to regex
   */
  private convertGlobToRegex(pattern: string): string {
    // Escape special regex characters except for * and ?
    let regex = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    // Handle ** for recursive matching
    regex = regex.replace(/\*\*/g, '.*');

    // Ensure the pattern matches the entire URL
    if (!regex.startsWith('^')) {
      regex = '^' + regex;
    }
    if (!regex.endsWith('$')) {
      regex = regex + '$';
    }

    return regex;
  }

  /**
   * Validate normalized pattern
   */
  private validateNormalizedPattern(pattern: string): PatternValidationResult {
    try {
      // Test if the pattern compiles to a valid regex
      new RegExp(pattern);
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `Invalid regex pattern: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Calculate pattern complexity
   */
  private calculatePatternComplexity(pattern: string): 'low' | 'medium' | 'high' {
    const complexity = pattern.length + (pattern.match(/[+*?{}]/g) || []).length * 2;
    
    if (complexity < 50) return 'low';
    if (complexity < 200) return 'medium';
    return 'high';
  }

  /**
   * Compile pattern for efficient matching
   */
  private async compilePattern(pattern: string, type: 'match' | 'include' | 'exclude'): Promise<CompiledPattern | null> {
    const cacheKey = `${type}:${pattern}`;
    
    // Check cache first
    if (this.compiledPatterns.has(cacheKey)) {
      return this.compiledPatterns.get(cacheKey)!;
    }

    // Validate pattern
    const validation = this.validatePattern(pattern, type);
    if (!validation.isValid) {
      this.logger.warn('Invalid pattern skipped', { pattern, type, error: validation.error });
      return null;
    }

    try {
      // Compile regex
      const regex = new RegExp(validation.normalizedPattern!);
      const complexity = this.calculatePatternComplexity(validation.normalizedPattern!);
      
      const compiledPattern: CompiledPattern = {
        type,
        pattern,
        regex,
        isWildcard: pattern.includes('*') || pattern.includes('?'),
        complexity,
      };

      // Cache the compiled pattern
      if (this.compiledPatterns.size >= this.maxCompiledPatterns) {
        // Remove oldest patterns (simple LRU)
        const firstKey = this.compiledPatterns.keys().next().value;
        this.compiledPatterns.delete(firstKey);
      }
      
      this.compiledPatterns.set(cacheKey, compiledPattern);
      
      return compiledPattern;
    } catch (error) {
      this.logger.error('Failed to compile pattern', { pattern, type, error });
      return null;
    }
  }

  /**
   * Test pattern against URL
   */
  private testPattern(compiledPattern: CompiledPattern, url: string): boolean {
    try {
      return compiledPattern.regex.test(url);
    } catch (error) {
      this.logger.error('Pattern test failed', { pattern: compiledPattern.pattern, url, error });
      return false;
    }
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const urlMatcher = UrlMatcher.getInstance();