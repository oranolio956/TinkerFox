/**
 * Script Validator for ScriptFlow
 * 
 * Validates and sanitizes user scripts for security and CSP compliance.
 * Prevents dangerous patterns and ensures scripts are safe to execute.
 * 
 * @fileoverview Production-grade script validation with security hardening
 */

import { Logger } from '../lib/logger';
import type { Script } from '../types';

/**
 * Script validation result
 */
export interface ScriptValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly sanitizedCode?: string;
  readonly securityLevel: 'safe' | 'warning' | 'dangerous';
  readonly cspCompliant: boolean;
}

/**
 * Security analysis result
 */
export interface SecurityAnalysis {
  readonly hasEval: boolean;
  readonly hasInlineCode: boolean;
  readonly hasRemoteScripts: boolean;
  readonly hasUnsafePatterns: boolean;
  readonly hasMemoryLeaks: boolean;
  readonly hasCSPViolations: boolean;
  readonly riskScore: number; // 0-100
}

/**
 * Script Validator class for secure script validation
 */
export class ScriptValidator {
  private static instance: ScriptValidator | null = null;
  private readonly logger: Logger;
  private readonly dangerousPatterns: readonly RegExp[];
  private readonly cspViolationPatterns: readonly RegExp[];
  private readonly memoryLeakPatterns: readonly RegExp[];

  private constructor() {
    this.logger = new Logger('ScriptValidator');
    
    // Dangerous patterns that should be blocked
    this.dangerousPatterns = [
      /\beval\s*\(/gi,                    // eval() calls
      /\bFunction\s*\(/gi,                // Function constructor
      /\bsetTimeout\s*\(\s*["'`][^"'`]*["'`]/gi, // setTimeout with string
      /\bsetInterval\s*\(\s*["'`][^"'`]*["'`]/gi, // setInterval with string
      /\bnew\s+Function\s*\(/gi,          // new Function()
      /\bimport\s*\(/gi,                  // dynamic import()
      /\brequire\s*\(/gi,                 // require() calls
      /\bdocument\.write\s*\(/gi,         // document.write()
      /\bdocument\.writeln\s*\(/gi,       // document.writeln()
      /\bwindow\.location\s*=/gi,         // Direct location assignment
      /\btop\.location\s*=/gi,            // Direct top location assignment
      /\bparent\.location\s*=/gi,         // Direct parent location assignment
      /\bself\.location\s*=/gi,           // Direct self location assignment
      /\bchrome\.runtime\.getURL\s*\(/gi, // Chrome runtime URL access
      /\bchrome\.extension\.getURL\s*\(/gi, // Chrome extension URL access
    ];

    // CSP violation patterns
    this.cspViolationPatterns = [
      /<script[^>]*>/gi,                  // Inline script tags
      /javascript:/gi,                    // JavaScript URLs
      /on\w+\s*=/gi,                      // Inline event handlers
      /style\s*=/gi,                      // Inline styles
      /\bdata:\s*text\/javascript/gi,     // Data URLs with JavaScript
      /\bblob:\s*text\/javascript/gi,     // Blob URLs with JavaScript
    ];

    // Memory leak patterns
    this.memoryLeakPatterns = [
      /setInterval\s*\(/gi,               // setInterval without cleanup
      /setTimeout\s*\(/gi,                // setTimeout without cleanup
      /addEventListener\s*\(/gi,          // Event listeners without cleanup
      /attachEvent\s*\(/gi,               // Legacy event attachment
      /setAttribute\s*\(/gi,              // Attribute setting
      /createElement\s*\(/gi,             // DOM element creation
    ];
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ScriptValidator {
    if (!ScriptValidator.instance) {
      ScriptValidator.instance = new ScriptValidator();
    }
    return ScriptValidator.instance;
  }

  /**
   * Validate a script for security and compliance
   */
  public async validateScript(script: Script): Promise<ScriptValidationResult> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];
      
      // Basic validation
      if (!script.code || typeof script.code !== 'string') {
        return {
          isValid: false,
          errors: ['Script code is required and must be a string'],
          warnings: [],
          securityLevel: 'dangerous',
          cspCompliant: false,
        };
      }

      if (script.code.length === 0) {
        return {
          isValid: false,
          errors: ['Script code cannot be empty'],
          warnings: [],
          securityLevel: 'safe',
          cspCompliant: true,
        };
      }

      if (script.code.length > 1000000) { // 1MB limit
        return {
          isValid: false,
          errors: ['Script code is too large (max 1MB)'],
          warnings: [],
          securityLevel: 'dangerous',
          cspCompliant: false,
        };
      }

      // Security analysis
      const securityAnalysis = this.analyzeSecurity(script.code);
      
      // Check for dangerous patterns
      if (securityAnalysis.hasEval || securityAnalysis.hasUnsafePatterns) {
        errors.push('Script contains dangerous patterns that are not allowed');
      }

      // Check for CSP violations
      if (securityAnalysis.hasCSPViolations) {
        errors.push('Script contains CSP violations (inline scripts, eval, etc.)');
      }

      // Check for memory leaks
      if (securityAnalysis.hasMemoryLeaks) {
        warnings.push('Script may cause memory leaks (missing cleanup for intervals, listeners, etc.)');
      }

      // Check for remote scripts
      if (securityAnalysis.hasRemoteScripts) {
        errors.push('Script attempts to load remote scripts, which is not allowed');
      }

      // Determine security level
      let securityLevel: 'safe' | 'warning' | 'dangerous' = 'safe';
      if (errors.length > 0) {
        securityLevel = 'dangerous';
      } else if (warnings.length > 0 || securityAnalysis.riskScore > 30) {
        securityLevel = 'warning';
      }

      // Determine CSP compliance
      const cspCompliant = !securityAnalysis.hasCSPViolations && 
                          !securityAnalysis.hasEval && 
                          !securityAnalysis.hasUnsafePatterns;

      // Sanitize code if needed
      let sanitizedCode: string | undefined;
      if (errors.length === 0 && warnings.length > 0) {
        sanitizedCode = this.sanitizeCode(script.code);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        sanitizedCode,
        securityLevel,
        cspCompliant,
      };
    } catch (error) {
      this.logger.error('Script validation failed', { scriptId: script.id, error });
      return {
        isValid: false,
        errors: ['Script validation failed due to internal error'],
        warnings: [],
        securityLevel: 'dangerous',
        cspCompliant: false,
      };
    }
  }

  /**
   * Analyze script security
   */
  public analyzeSecurity(code: string): SecurityAnalysis {
    const hasEval = this.dangerousPatterns.some(pattern => pattern.test(code));
    const hasInlineCode = this.cspViolationPatterns.some(pattern => pattern.test(code));
    const hasRemoteScripts = this.hasRemoteScriptReferences(code);
    const hasUnsafePatterns = this.hasUnsafePatterns(code);
    const hasMemoryLeaks = this.memoryLeakPatterns.some(pattern => pattern.test(code));
    const hasCSPViolations = hasEval || hasInlineCode;

    // Calculate risk score
    let riskScore = 0;
    if (hasEval) riskScore += 40;
    if (hasInlineCode) riskScore += 30;
    if (hasRemoteScripts) riskScore += 35;
    if (hasUnsafePatterns) riskScore += 25;
    if (hasMemoryLeaks) riskScore += 15;
    if (hasCSPViolations) riskScore += 20;

    return {
      hasEval,
      hasInlineCode,
      hasRemoteScripts,
      hasUnsafePatterns,
      hasMemoryLeaks,
      hasCSPViolations,
      riskScore: Math.min(riskScore, 100),
    };
  }

  /**
   * Sanitize script code to remove dangerous patterns
   */
  public sanitizeCode(code: string): string {
    let sanitized = code;

    // Remove dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      sanitized = sanitized.replace(pattern, '/* BLOCKED: Dangerous pattern removed */');
    }

    // Remove CSP violation patterns
    for (const pattern of this.cspViolationPatterns) {
      sanitized = sanitized.replace(pattern, '/* BLOCKED: CSP violation removed */');
    }

    // Add cleanup suggestions for memory leaks
    if (this.memoryLeakPatterns.some(pattern => pattern.test(code))) {
      sanitized = this.addCleanupSuggestions(sanitized);
    }

    return sanitized;
  }

  /**
   * Check if script has remote script references
   */
  private hasRemoteScriptReferences(code: string): boolean {
    const remotePatterns = [
      /createElement\s*\(\s*['"]script['"]\s*\)/gi,
      /\.src\s*=\s*['"][^'"]*http/gi,
      /fetch\s*\(\s*['"][^'"]*\.js['"]/gi,
      /import\s*\(\s*['"][^'"]*\.js['"]/gi,
      /require\s*\(\s*['"][^'"]*\.js['"]/gi,
      /XMLHttpRequest/gi,
      /fetch\s*\(\s*['"][^'"]*http/gi,
    ];

    return remotePatterns.some(pattern => pattern.test(code));
  }

  /**
   * Check if script has unsafe patterns
   */
  private hasUnsafePatterns(code: string): boolean {
    const unsafePatterns = [
      /\bwith\s*\(/gi,                    // with statement
      /\bdelete\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*\[/gi, // delete with bracket notation
      /\barguments\s*\[/gi,               // arguments array access
      /\bcallee\s*\[/gi,                  // callee access
      /\bcaller\s*\[/gi,                  // caller access
      /\b__proto__/gi,                    // __proto__ access
      /\bprototype\s*\[/gi,               // prototype array access
      /\bconstructor\s*\[/gi,             // constructor array access
    ];

    return unsafePatterns.some(pattern => pattern.test(code));
  }

  /**
   * Add cleanup suggestions for memory leaks
   */
  private addCleanupSuggestions(code: string): string {
    const suggestions = `
// SCRIPTFLOW CLEANUP SUGGESTIONS:
// - Store interval IDs and clear them: clearInterval(intervalId)
// - Store timeout IDs and clear them: clearTimeout(timeoutId)
// - Remove event listeners: element.removeEventListener(type, handler)
// - Clean up DOM references: element = null
// - Use WeakMap/WeakSet for object references when possible

`;

    return suggestions + code;
  }

  /**
   * Validate script metadata
   */
  public validateScriptMetadata(script: Script): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate name
    if (!script.name || typeof script.name !== 'string' || script.name.trim().length === 0) {
      errors.push('Script name is required');
    } else if (script.name.length > 100) {
      errors.push('Script name must be less than 100 characters');
    }

    // Validate description
    if (script.description && script.description.length > 500) {
      warnings.push('Script description is quite long');
    }

    // Validate matches
    if (!script.matches || script.matches.length === 0) {
      if (!script.include || script.include.length === 0) {
        errors.push('Script must have at least one @match or @include pattern');
      }
    }

    // Validate runAt
    if (script.runAt && !['document_start', 'document_end', 'document_idle'].includes(script.runAt)) {
      errors.push('Invalid @run-at value. Must be document_start, document_end, or document_idle');
    }

    // Validate world
    if (script.world && !['MAIN', 'ISOLATED'].includes(script.world)) {
      errors.push('Invalid world value. Must be MAIN or ISOLATED');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get validation statistics
   */
  public getValidationStats(): {
    totalValidations: number;
    validScripts: number;
    invalidScripts: number;
    dangerousScripts: number;
    cspViolations: number;
  } {
    // TODO: Implement validation statistics tracking
    return {
      totalValidations: 0,
      validScripts: 0,
      invalidScripts: 0,
      dangerousScripts: 0,
      cspViolations: 0,
    };
  }
}

// Export singleton instance
export const scriptValidator = ScriptValidator.getInstance();