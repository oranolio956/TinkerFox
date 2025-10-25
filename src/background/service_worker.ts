import { ScriptManager } from './script-manager';
import { PermissionManager } from './permissions';
import { UpdateChecker } from './update-checker';
import { initializeDatabase } from '@/lib/database';
import { db } from '@/lib/database';
import { ScriptStorage } from '@/lib/script-storage';

// Initialize on install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[ScriptFlow] Extension installed/updated');
  
  // Initialize database
  await initializeDatabase();
  
  // Set up periodic update checks (every 6 hours)
  chrome.alarms.create('checkUpdates', {
    periodInMinutes: 360,  // 6 hours
  });
  
  // Open onboarding on first install
  if (details.reason === 'install') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('options/index.html?onboarding=true'),
    });
  }
});

// Listen for page navigations
chrome.webNavigation.onCompleted.addListener(async (details) => {
  // Only main frame (not iframes)
  if (details.frameId !== 0) return;
  
  // Inject scripts for this URL
  await ScriptManager.injectScriptsForUrl(details.tabId, details.url);
});

// Listen for alarms (update checks)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkUpdates') {
    await UpdateChecker.checkAllScripts();
  }
});

// Listen for messages from UI
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message, _sender).then(sendResponse);
  return true;  // Keep channel open for async response
});

async function handleMessage(message: any, _sender: chrome.runtime.MessageSender) {
  switch (message.type) {
    case 'GET_ALL_SCRIPTS':
      const scripts = await ScriptStorage.getAllScripts();
      return { scripts };
    
    case 'GET_SCRIPTS_FOR_TAB':
      return ScriptManager.getScriptsForTab(message.tabId);
    
    case 'CREATE_SCRIPT':
      const newScript = await ScriptStorage.createScript(message.code);
      return { script: newScript };
    
    case 'UPDATE_SCRIPT':
      await ScriptStorage.updateScript(message.id, message.code, message.changelog);
      return { success: true };
    
    case 'DELETE_SCRIPT':
      await ScriptStorage.deleteScript(message.id);
      return { success: true };
    
    case 'TOGGLE_SCRIPT':
      const enabled = await ScriptStorage.toggleScript(message.id);
      return { enabled };
    
    case 'INJECT_SCRIPT':
      return ScriptManager.injectScript(message.tabId, message.scriptId);
    
    case 'REQUEST_PERMISSION':
      return PermissionManager.requestPermission(message.permission);
    
    case 'CHECK_UPDATES':
      return UpdateChecker.checkScript(message.scriptId);
    
    case 'GET_EXECUTION_LOGS':
      return getExecutionLogs(message.filter);
    
    case 'GM_XHR_REQUEST':
      return handleGMXHRRequest(message.details);
    
    case 'GM_NOTIFICATION':
      return handleGMNotification(message.options);
    
    case 'GET_SCRIPTS_FOR_URL':
      return ScriptManager.getScriptsForUrl(message.url);
    
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

// Get execution logs for debug console
async function getExecutionLogs(filter?: string) {
  try {
    let executions = await db.executions
      .orderBy('timestamp')
      .reverse()
      .limit(100)
      .toArray();
    
    if (filter) {
      executions = executions.filter(e => e.scriptId === filter);
    }
    
    // Get script names for each execution
    const logs = await Promise.all(executions.map(async (execution) => {
      const script = await db.scripts.get(execution.scriptId);
      return {
        id: execution.id,
        scriptId: execution.scriptId,
        scriptName: script?.name || 'Unknown Script',
        url: execution.url,
        success: execution.success,
        error: execution.error,
        executionTime: execution.executionTime,
        timestamp: execution.timestamp,
      };
    }));
    
    return { logs };
  } catch (error) {
    console.error('Failed to get execution logs:', error);
    return { logs: [] };
  }
}

// Handle GM_xmlhttpRequest from userscripts
async function handleGMXHRRequest(details: any) {
  try {
    const response = await fetch(details.url, {
      method: details.method || 'GET',
      headers: details.headers || {},
      body: details.data || undefined,
    });
    
    const responseText = await response.text();
    
    return {
      status: response.status,
      statusText: response.statusText,
      responseText: responseText,
      responseHeaders: Object.fromEntries(response.headers.entries()),
    };
  } catch (error) {
    console.error('GM_xmlhttpRequest failed:', error);
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Handle GM_notification from userscripts
async function handleGMNotification(options: any) {
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: options.title || 'ScriptFlow Notification',
      message: options.text || 'Notification from userscript',
    });
    
    return { success: true };
  } catch (error) {
    console.error('GM_notification failed:', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

// Keep service worker alive during critical operations
let keepAlivePort: chrome.runtime.Port | null = null;
export function keepServiceWorkerAlive() {
  if (keepAlivePort) return;
  
  keepAlivePort = chrome.runtime.connect({ name: 'keepalive' });
  
  keepAlivePort.onDisconnect.addListener(() => {
    keepAlivePort = null;
  });
  
  // Auto-disconnect after 25 seconds (Chrome kills at 30s)
  setTimeout(() => {
    keepAlivePort?.disconnect();
    keepAlivePort = null;
  }, 25000);
}