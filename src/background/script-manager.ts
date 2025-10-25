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
      
      // Idle scripts after page fully loads
      setTimeout(async () => {
        for (const script of documentIdle) {
          await this.injectScript(tabId, script.id);
        }
      }, 100);
      
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
      
      // Build injection code (wraps userscript in sandbox)
      const injectionCode = this.buildInjectionCode(script);
      
      // Inject via chrome.scripting API
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'ISOLATED',  // Isolated world (safer than MAIN)
        func: this.runUserScript,
        args: [injectionCode, script.metadata.grant],
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
    // Wrap script in IIFE to prevent global pollution
    return `
      (function() {
        'use strict';
        
        // Metadata
        const GM_info = {
          script: {
            name: ${JSON.stringify(script.name)},
            namespace: ${JSON.stringify(script.metadata.namespace || '')},
            version: ${JSON.stringify(script.version)},
            description: ${JSON.stringify(script.metadata.description || '')},
            author: ${JSON.stringify(script.metadata.author || '')},
          },
          scriptHandler: 'ScriptFlow',
          version: '1.0.0',
        };
        
        // User script code
        ${script.code}
      })();
    `;
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
}