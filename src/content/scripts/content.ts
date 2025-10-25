// Content Script - The execution layer that makes userscripts actually work
// This is the missing piece that makes ScriptFlow functional

console.log('[ScriptFlow] Content script loaded');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[ScriptFlow] Received message:', message.type);
  
  switch (message.type) {
    case 'INJECT_SCRIPT':
      handleScriptInjection(message.script, message.grants);
      sendResponse({ success: true });
      break;
      
    case 'INJECT_LIBRARY':
      handleLibraryInjection(message.url, message.code);
      sendResponse({ success: true });
      break;
      
    case 'GM_XHR_REQUEST':
      handleGMXHRRequest(message.details, sendResponse);
      return true; // Keep channel open for async response
      
    case 'GM_NOTIFICATION':
      handleGMNotification(message.options);
      sendResponse({ success: true });
      break;
      
    default:
      console.warn('[ScriptFlow] Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
  
  return true; // Keep message channel open
});

// Inject a userscript into the page
function handleScriptInjection(script: { id: string; code: string; grants: string[] }, grants: string[]) {
  try {
    console.log(`[ScriptFlow] Injecting script ${script.id}`);
    
    // Build GM API code
    const gmApiCode = buildGMAPICode(grants);
    
    // Wrap script in IIFE to prevent global pollution
    const wrappedCode = `
      (function() {
        'use strict';
        
        // GM API implementation
        ${gmApiCode}
        
        // User script code
        ${script.code}
      })();
    `;
    
    // Create script element and inject
    const scriptElement = document.createElement('script');
    scriptElement.textContent = wrappedCode;
    scriptElement.setAttribute('data-scriptflow-id', script.id);
    scriptElement.setAttribute('data-scriptflow-injected', 'true');
    
    // Inject into page
    (document.head || document.documentElement).appendChild(scriptElement);
    
    // Clean up after a short delay
    setTimeout(() => {
      if (scriptElement.parentNode) {
        scriptElement.parentNode.removeChild(scriptElement);
      }
    }, 100);
    
    console.log(`[ScriptFlow] Successfully injected script ${script.id}`);
    
  } catch (error) {
    console.error(`[ScriptFlow] Failed to inject script ${script.id}:`, error);
    
    // Report error to background
    chrome.runtime.sendMessage({
      type: 'SCRIPT_INJECTION_ERROR',
      scriptId: script.id,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Build GM API code as string (not using class methods)
function buildGMAPICode(grants: string[]): string {
  const apiCode: string[] = [];
  
  // GM_getValue / GM.getValue
  if (grants.includes('GM_getValue') || grants.includes('GM.getValue')) {
    apiCode.push(`
      const GM_getValue = function(key, defaultValue) {
        const stored = localStorage.getItem('GM_' + key);
        return stored ? JSON.parse(stored) : defaultValue;
      };
      const GM = { getValue: GM_getValue };
    `);
  }
  
  // GM_setValue / GM.setValue
  if (grants.includes('GM_setValue') || grants.includes('GM.setValue')) {
    apiCode.push(`
      const GM_setValue = function(key, value) {
        localStorage.setItem('GM_' + key, JSON.stringify(value));
      };
      if (typeof GM !== 'undefined') {
        GM.setValue = GM_setValue;
      }
    `);
  }
  
  // GM_deleteValue
  if (grants.includes('GM_deleteValue')) {
    apiCode.push(`
      const GM_deleteValue = function(key) {
        localStorage.removeItem('GM_' + key);
      };
    `);
  }
  
  // GM_listValues
  if (grants.includes('GM_listValues')) {
    apiCode.push(`
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
  
  // GM_xmlhttpRequest
  if (grants.includes('GM_xmlhttpRequest')) {
    apiCode.push(`
      const GM_xmlhttpRequest = function(details) {
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({
            type: 'GM_XHR_REQUEST',
            details: details
          }, (response) => {
            if (response && response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          });
        });
      };
    `);
  }
  
  // GM_addStyle
  if (grants.includes('GM_addStyle')) {
    apiCode.push(`
      const GM_addStyle = function(css) {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
        return style;
      };
    `);
  }
  
  // GM_setClipboard
  if (grants.includes('GM_setClipboard')) {
    apiCode.push(`
      const GM_setClipboard = function(text) {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text);
        } else {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = text;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
      };
    `);
  }
  
  // GM_notification
  if (grants.includes('GM_notification')) {
    apiCode.push(`
      const GM_notification = function(text, title, image, onclick) {
        chrome.runtime.sendMessage({
          type: 'GM_NOTIFICATION',
          options: { text, title, image, onclick }
        });
      };
    `);
  }
  
  // GM_info
  apiCode.push(`
    const GM_info = {
      script: {
        name: 'ScriptFlow Script',
        version: '1.0.0',
        description: 'Injected by ScriptFlow',
        author: 'ScriptFlow'
      },
      scriptHandler: 'ScriptFlow',
      version: '1.0.0'
    };
  `);
  
  return apiCode.join('\n');
}

// Handle GM_xmlhttpRequest by forwarding to background
function handleGMXHRRequest(details: any, sendResponse: (response: any) => void) {
  // Forward to background script for actual request
  chrome.runtime.sendMessage({
    type: 'GM_XHR_REQUEST',
    details: details
  }, (response) => {
    sendResponse(response);
  });
}

// Handle GM_notification
function handleGMNotification(options: any) {
  // Create browser notification
  if (options.title && options.text) {
    chrome.runtime.sendMessage({
      type: 'GM_NOTIFICATION',
      options: options
    });
  }
}

// Inject a required library
function handleLibraryInjection(url: string, code: string) {
  try {
    console.log(`[ScriptFlow] Injecting library: ${url}`);
    
    // Create script element for library
    const scriptElement = document.createElement('script');
    scriptElement.textContent = code;
    scriptElement.setAttribute('data-scriptflow-library', url);
    scriptElement.setAttribute('data-scriptflow-injected', 'true');
    
    // Inject into page
    (document.head || document.documentElement).appendChild(scriptElement);
    
    console.log(`[ScriptFlow] Successfully injected library: ${url}`);
  } catch (error) {
    console.error(`[ScriptFlow] Failed to inject library ${url}:`, error);
  }
}

// Auto-inject scripts when page loads
function autoInjectScripts() {
  // Get current URL
  const currentUrl = window.location.href;
  
  // Request scripts for this URL from background
  chrome.runtime.sendMessage({
    type: 'GET_SCRIPTS_FOR_URL',
    url: currentUrl
  }, (response) => {
    if (response && response.scripts) {
      console.log(`[ScriptFlow] Auto-injecting ${response.scripts.length} scripts for ${currentUrl}`);
      
      response.scripts.forEach((script: any) => {
        handleScriptInjection(script, script.metadata.grant || []);
      });
    }
  });
}

// Run auto-injection when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInjectScripts);
} else {
  autoInjectScripts();
}

console.log('[ScriptFlow] Content script initialization complete');
