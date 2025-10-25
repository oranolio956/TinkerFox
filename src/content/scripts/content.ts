// Content script coordinator for ScriptFlow
// This script runs in the page context and coordinates userscript execution

console.log('[ScriptFlow] Content script loaded');

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INJECT_USERSCRIPT') {
    try {
      // Execute the userscript in the page context
      const script = document.createElement('script');
      script.textContent = message.code;
      script.setAttribute('data-scriptflow', 'userscript');
      (document.head || document.documentElement).appendChild(script);
      script.remove();
      
      sendResponse({ success: true });
    } catch (error) {
      console.error('[ScriptFlow] Content script execution error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  
  return true; // Keep message channel open for async response
});