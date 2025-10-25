// This coordinator runs ONCE per page as a content script
// It manages all userscripts for that page
interface PendingScript {
  id: string;
  code: string;
  grants: string[];
  priority: number;
}

class ScriptCoordinator {
  private queue: PendingScript[] = [];
  private running = false;
  
  constructor() {
    // Listen for scripts to inject
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'INJECT_USERSCRIPT') {
        this.enqueueScript(message.script);
        sendResponse({ success: true });
      }
      return true;
    });
    
    // Start processing
    this.processQueue();
  }
  
  // Add script to execution queue
  private enqueueScript(script: PendingScript): void {
    this.queue.push(script);
    this.queue.sort((a, b) => b.priority - a.priority);  // Higher priority first
    
    if (!this.running) {
      this.processQueue();
    }
  }
  
  // Execute scripts one by one
  private async processQueue(): Promise<void> {
    this.running = true;
    
    while (this.queue.length > 0) {
      const script = this.queue.shift()!;
      
      try {
        await this.executeScript(script);
      } catch (error) {
        console.error(`[ScriptFlow] Script ${script.id} failed:`, error);
        
        // Report error to background
        chrome.runtime.sendMessage({
          type: 'SCRIPT_ERROR',
          scriptId: script.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      
      // Small delay between scripts (prevent race conditions)
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    this.running = false;
  }
  
  // Execute single script in isolated context
  private executeScript(script: PendingScript): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create sandbox
        const sandbox = this.createSandbox(script.grants);
        
        // Wrap in try-catch
        const wrappedCode = `
          try {
            ${script.code}
          } catch (error) {
            console.error('[ScriptFlow] Userscript error:', error);
            throw error;
          }
        `;
        
        // Execute
        const scriptElement = document.createElement('script');
        scriptElement.textContent = `
          (function() {
            ${this.generateGMAPI(sandbox, script.grants)}
            ${wrappedCode}
          })();
        `;
        scriptElement.setAttribute('data-scriptflow-id', script.id);
        
        // Inject into page
        (document.head || document.documentElement).appendChild(scriptElement);
        
        // Clean up
        setTimeout(() => scriptElement.remove(), 100);
        
        resolve();
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Create isolated storage sandbox for script
  private createSandbox(_grants: string[]): Map<string, any> {
    const sandbox = new Map<string, any>();
    
    // Each script gets its own storage namespace
    const storagePrefix = `GM_${Date.now()}_`;
    
    sandbox.set('getValue', (key: string, defaultValue?: any) => {
      const stored = localStorage.getItem(storagePrefix + key);
      return stored ? JSON.parse(stored) : defaultValue;
    });
    
    sandbox.set('setValue', (key: string, value: any) => {
      localStorage.setItem(storagePrefix + key, JSON.stringify(value));
    });
    
    sandbox.set('deleteValue', (key: string) => {
      localStorage.removeItem(storagePrefix + key);
    });
    
    sandbox.set('listValues', () => {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(storagePrefix)) {
          keys.push(key.replace(storagePrefix, ''));
        }
      }
      return keys;
    });
    
    return sandbox;
  }
  
  // Generate GM API code
  private generateGMAPI(sandbox: Map<string, any>, _grants: string[]): string {
    const api: string[] = [];
    
    if (_grants.includes('GM_getValue') || _grants.includes('GM.getValue')) {
      api.push(`const GM_getValue = ${sandbox.get('getValue').toString()};`);
      api.push(`const GM = { getValue: GM_getValue };`);
    }
    
    if (_grants.includes('GM_setValue') || _grants.includes('GM.setValue')) {
      api.push(`const GM_setValue = ${sandbox.get('setValue').toString()};`);
      api.push(`GM.setValue = GM_setValue;`);
    }
    
    if (_grants.includes('GM_deleteValue')) {
      api.push(`const GM_deleteValue = ${sandbox.get('deleteValue').toString()};`);
    }
    
    if (_grants.includes('GM_listValues')) {
      api.push(`const GM_listValues = ${sandbox.get('listValues').toString()};`);
    }
    
    if (_grants.includes('GM_xmlhttpRequest')) {
      api.push(`
        const GM_xmlhttpRequest = function(details) {
          return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
              type: 'GM_XHR',
              details: details
            }, (response) => {
              if (response.error) reject(response.error);
              else resolve(response);
            });
          });
        };
      `);
    }
    
    return api.join('\n');
  }
}

// Initialize coordinator when page loads
if (typeof window !== 'undefined') {
  new ScriptCoordinator();
}