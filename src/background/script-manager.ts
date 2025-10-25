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
      // Create GM API polyfills based on @grant
      const GM: any = {};
      
      if (grants.includes('GM_getValue')) {
        GM.getValue = (key: string, defaultValue?: any) => {
          const stored = localStorage.getItem(`GM_${key}`);
          return stored ? JSON.parse(stored) : defaultValue;
        };
      }
      
      if (grants.includes('GM_setValue')) {
        GM.setValue = (key: string, value: any) => {
          localStorage.setItem(`GM_${key}`, JSON.stringify(value));
        };
      }
      
      if (grants.includes('GM_xmlhttpRequest')) {
        GM.xmlHttpRequest = (details: any) => {
          // Send message to background to make request (bypasses CORS)
          chrome.runtime.sendMessage({
            type: 'GM_XHR',
            details,
          });
        };
      }
      
      // Inject code
      const script = document.createElement('script');
      script.textContent = code;
      script.setAttribute('data-scriptflow', 'userscript');
      (document.head || document.documentElement).appendChild(script);
      script.remove();
      
    } catch (error) {
      console.error('[ScriptFlow] Userscript execution error:', error);
    }
  }
  
  // Get scripts that match current tab
  static async getScriptsForTab(tabId: number): Promise<UserScript[]> {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) return [];
    
    return ScriptStorage.getScriptsForUrl(tab.url);
  }
}