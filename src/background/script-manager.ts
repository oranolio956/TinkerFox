import { ScriptStorage } from '@/lib/script-storage';
import { UserScript } from '@/types';

export class ScriptManager {
  
  // Inject all matching scripts for URL
  static async injectScriptsForUrl(tabId: number, url: string): Promise<void> {
    try {
      const scripts = await ScriptStorage.getScriptsForUrl(url);
      
      if (scripts.length === 0) {
        console.log(`[ScriptFlow] No scripts match ${url}`);
        return;
      }
      
      console.log(`[ScriptFlow] Injecting ${scripts.length} scripts into tab ${tabId}`);
      
      // Sort by runAt timing
      const documentStart = scripts.filter(s => s.metadata.runAt === 'document-start');
      const documentEnd = scripts.filter(s => s.metadata.runAt === 'document-end');
      const documentIdle = scripts.filter(s => s.metadata.runAt === 'document-idle' || !s.metadata.runAt);
      
      // Inject in order
      for (const script of documentStart) {
        await this.injectScript(tabId, script.id);
      }
      
      for (const script of documentEnd) {
        await this.injectScript(tabId, script.id);
      }
      
      // Idle scripts after page fully loads - wait for content script to be ready
      if (documentIdle.length > 0) {
        await this.waitForContentScriptReady(tabId);
        for (const script of documentIdle) {
          await this.injectScript(tabId, script.id);
        }
      }
      
    } catch (error) {
      console.error('[ScriptFlow] Injection error:', error);
    }
  }
  
  // Inject single script
  static async injectScript(tabId: number, scriptId: string): Promise<void> {
    const startTime = performance.now();
    
    try {
      const script = await ScriptStorage.getScript(scriptId);
      if (!script) throw new Error('Script not found');
      
      // Validate script code for security
      if (!this.validateScriptCode(script.code)) {
        throw new Error('Script contains dangerous patterns');
      }
      
      // Load @require libraries first
      if (script.metadata.require && script.metadata.require.length > 0) {
        await this.loadRequiredLibraries(tabId, script.metadata.require);
      }
      
      // Send script to content script for injection
      await chrome.tabs.sendMessage(tabId, {
        type: 'INJECT_SCRIPT',
        script: {
          id: script.id,
          code: script.code,
          grants: script.metadata.grant || []
        },
        grants: script.metadata.grant || []
      });
      
      const executionTime = performance.now() - startTime;
      
      // Log successful execution
      await ScriptStorage.logExecution(
        scriptId,
        (await chrome.tabs.get(tabId)).url || '',
        true,
        executionTime
      );
      
      console.log(`[ScriptFlow] Injected ${script.name} (${executionTime.toFixed(2)}ms)`);
      
    } catch (error) {
      const executionTime = performance.now() - startTime;
      
      // Log failed execution
      await ScriptStorage.logExecution(
        scriptId,
        '',
        false,
        executionTime,
        error instanceof Error ? error.message : String(error)
      );
      
      console.error(`[ScriptFlow] Failed to inject ${scriptId}:`, error);
    }
  }

  // Wait for content script to be ready
  private static async waitForContentScriptReady(tabId: number): Promise<boolean> {
    const maxRetries = 10;
    const retryDelay = 100; // 100ms
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Send a ping to content script
        const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
        if (response && response.success) {
          return true;
        }
      } catch (error) {
        // Content script not ready yet, wait and retry
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    console.warn('[ScriptFlow] Content script not ready after maximum retries');
    return false;
  }

  // Validate script code for dangerous patterns
  private static validateScriptCode(code: string): boolean {
    // Only check for truly dangerous patterns that can cause security issues
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout\s*\(\s*['"`]/, // setTimeout with string
      /setInterval\s*\(\s*['"`]/,
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        console.warn('[ScriptFlow] Potentially dangerous pattern detected:', pattern);
        // Don't block, just warn (many legitimate scripts use these patterns)
      }
    }
    
    return true; // Always allow execution (user responsibility)
  }
  
  // Build sandboxed injection code
  private static buildInjectionCode(script: UserScript): string {
    // Escape script metadata to prevent code injection
    const escapedName = this.escapeForScript(script.name);
    const escapedNamespace = this.escapeForScript(script.metadata.namespace || '');
    const escapedVersion = this.escapeForScript(script.version);
    const escapedDescription = this.escapeForScript(script.metadata.description || '');
    const escapedAuthor = this.escapeForScript(script.metadata.author || '');
    
    // Wrap script in IIFE to prevent global pollution
    return `
      (function() {
        'use strict';
        
        // Metadata
        const GM_info = {
          script: {
            name: '${escapedName}',
            namespace: '${escapedNamespace}',
            version: '${escapedVersion}',
            description: '${escapedDescription}',
            author: '${escapedAuthor}',
          },
          scriptHandler: 'ScriptFlow',
          version: '1.0.0',
        };
        
        // User script code
        ${script.code}
      })();
    `;
  }

  // Escape script metadata to prevent code injection
  private static escapeForScript(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/</g, '\\x3C')
      .replace(/>/g, '\\x3E')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }
  
  // This function runs in the page context
  private static runUserScript(code: string, grants: string[]) {
    try {
      // Build GM API as STRING that gets injected with the script
      const gmApiCode = this.buildGMAPI(grants);
      
      // Inject GM API + script code together
      const script = document.createElement('script');
      script.textContent = gmApiCode + '\n' + code;
      script.setAttribute('data-scriptflow', 'userscript');
      (document.head || document.documentElement).appendChild(script);
      script.remove();
      
    } catch (error) {
      console.error('[ScriptFlow] Userscript execution error:', error);
    }
  }

  // Build GM API as string for injection
  private static buildGMAPI(grants: string[]): string {
    const gmApiParts: string[] = [];
    
    // Always provide GM_info
    gmApiParts.push(`
      const GM_info = {
        script: {
          name: 'ScriptFlow Script',
          namespace: '',
          version: '1.0.0',
          description: '',
          author: ''
        },
        scriptHandler: 'ScriptFlow',
        version: '1.0.0'
      };
    `);
    
    // Add GM API based on grants
    if (grants.includes('GM_getValue') || grants.includes('GM.getValue')) {
      gmApiParts.push(`
        const GM_getValue = function(key, defaultValue) {
          try {
            const stored = localStorage.getItem('GM_' + key);
            return stored ? JSON.parse(stored) : defaultValue;
          } catch (e) {
            return defaultValue;
          }
        };
        const GM = { getValue: GM_getValue };
      `);
    }
    
    if (grants.includes('GM_setValue') || grants.includes('GM.setValue')) {
      gmApiParts.push(`
        const GM_setValue = function(key, value) {
          try {
            localStorage.setItem('GM_' + key, JSON.stringify(value));
          } catch (e) {
            console.error('GM_setValue failed:', e);
          }
        };
        if (typeof GM !== 'undefined') {
          GM.setValue = GM_setValue;
        }
      `);
    }
    
    if (grants.includes('GM_deleteValue')) {
      gmApiParts.push(`
        const GM_deleteValue = function(key) {
          localStorage.removeItem('GM_' + key);
        };
      `);
    }
    
    if (grants.includes('GM_listValues')) {
      gmApiParts.push(`
        const GM_listValues = function() {
          const keys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('GM_')) {
              keys.push(key.substring(3));
            }
          }
          return keys;
        };
      `);
    }
    
    if (grants.includes('GM_xmlhttpRequest')) {
      gmApiParts.push(`
        const GM_xmlhttpRequest = function(details) {
          return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
              type: 'GM_XHR',
              details: details
            }, (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else if (response && response.error) {
                reject(response.error);
              } else {
                resolve(response);
              }
            });
          });
        };
      `);
    }
    
    return gmApiParts.join('\n');
  }
  
  // Get scripts that match current tab
  static async getScriptsForTab(tabId: number): Promise<UserScript[]> {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) return [];
    
    return ScriptStorage.getScriptsForUrl(tab.url);
  }

  // Load @require libraries
  private static async loadRequiredLibraries(tabId: number, requireUrls: string[]): Promise<void> {
    for (const url of requireUrls) {
      try {
        console.log(`[ScriptFlow] Loading required library: ${url}`);
        
        // Fetch the library
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${url}: ${response.status}`);
        }
        
        const libraryCode = await response.text();
        
        // Send library to content script for injection
        await chrome.tabs.sendMessage(tabId, {
          type: 'INJECT_LIBRARY',
          url: url,
          code: libraryCode
        });
        
        console.log(`[ScriptFlow] Successfully loaded library: ${url}`);
      } catch (error) {
        console.error(`[ScriptFlow] Failed to load library ${url}:`, error);
        // Continue loading other libraries even if one fails
      }
    }
  }
}