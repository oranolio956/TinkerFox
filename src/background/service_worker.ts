import { ScriptManager } from './script-manager';
import { PermissionManager } from './permissions';
import { UpdateChecker } from './update-checker';
import { initializeDatabase } from '@/lib/database';
import { db } from '@/lib/database';
import { ScriptStorage } from '@/lib/script-storage';
import { Message, MessageResponse } from '@/types/messages';

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

async function handleMessage(message: Message, _sender: chrome.runtime.MessageSender): Promise<MessageResponse> {
  try {
    switch (message.type) {
      case 'GET_ALL_SCRIPTS':
        const scripts = await ScriptStorage.getAllScripts();
        return { success: true, scripts };
      
      case 'GET_SCRIPTS_FOR_TAB':
        const tabScripts = await ScriptManager.getScriptsForTab(message.tabId);
        return { success: true, scripts: tabScripts };
      
      case 'CREATE_SCRIPT':
        const newScript = await ScriptStorage.createScript(message.code);
        return { success: true, script: newScript };
      
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
        const logs = await getExecutionLogs(message.filter);
        return { success: true, ...logs };
      
      case 'GM_XHR_REQUEST':
        const xhrResponse = await handleGMXHRRequest(message.details);
        return { success: true, response: xhrResponse };
      
      case 'GM_NOTIFICATION':
        await handleGMNotification(message.options);
        return { success: true };
      
      case 'GET_SCRIPTS_FOR_URL':
        const urlScripts = await ScriptManager.getScriptsForUrl(message.url);
        return { success: true, scripts: urlScripts };
      
      default:
        return { 
          success: false, 
          error: `Unknown message type: ${message.type}` 
        };
    }
  } catch (error) {
    console.error('[ScriptFlow] Message handler error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
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
    
    // Batch fetch all unique script IDs to avoid N+1 query problem
    const scriptIds = [...new Set(executions.map(e => e.scriptId))];
    const scripts = await db.scripts.bulkGet(scriptIds);
    const scriptMap = new Map(scripts.filter(s => s).map(s => [s!.id, s!]));
    
    // Map executions to logs without additional queries
    const logs = executions.map(execution => ({
      id: execution.id,
      scriptId: execution.scriptId,
      scriptName: scriptMap.get(execution.scriptId)?.name || 'Unknown Script',
      url: execution.url,
      success: execution.success,
      error: execution.error,
      executionTime: execution.executionTime,
      timestamp: execution.timestamp,
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