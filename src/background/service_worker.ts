/**
 * ScriptFlow Background Service Worker
 * 
 * This service worker handles:
 * - Extension lifecycle events
 * - Tab management and script injection
 * - Storage operations
 * - Communication between popup/options and content scripts
 * - Context menu management
 * - Alarm scheduling for script execution
 */

import { ScriptManager } from '@/lib/script-manager'
import { StorageManager } from '@/lib/storage-manager'
import { TabManager } from '@/lib/tab-manager'
import { MessageHandler } from '@/lib/message-handler'
import { scriptExecutor, executionContextManager, performanceMonitor } from '@/engine'
import type { Script, ScriptExecutionResult, TabInfo } from '@/types'

// Initialize managers
const scriptManager = new ScriptManager()
const storageManager = new StorageManager()
const tabManager = new TabManager()
const messageHandler = new MessageHandler()

// Extension installation/startup
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('ScriptFlow installed/updated:', details.reason)
  
  if (details.reason === 'install') {
    // First time installation
    await initializeExtension()
  } else if (details.reason === 'update') {
    // Extension update
    await handleUpdate(details.previousVersion)
  }
  
  // Set up context menus
  await setupContextMenus()
  
  // Initialize storage
  await storageManager.initialize()
})

// Extension startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('ScriptFlow started')
  await storageManager.initialize()
  await scriptManager.loadScripts()
})

// Tab management
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    await tabManager.handleTabUpdate(tabId, tab)
    await scriptManager.executeScriptsForTab(tabId, tab)
  }
})

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await tabManager.handleTabActivation(activeInfo.tabId)
})

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  messageHandler.handleMessage(message, sender, sendResponse)
  return true // Keep message channel open for async responses
})

// Command handling
chrome.commands.onCommand.addListener(async (command) => {
  switch (command) {
    case 'toggle-scriptflow':
      await handleToggleScriptFlow()
      break
    case 'open-dashboard':
      await openDashboard()
      break
  }
})

// Context menu handling
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return
  
  switch (info.menuItemId) {
    case 'inject-script':
      await handleContextMenuScriptInjection(info, tab)
      break
    case 'open-scriptflow':
      await openScriptFlowForTab(tab.id)
      break
  }
})

// Alarm handling for scheduled scripts
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('script-')) {
    const scriptId = alarm.name.replace('script-', '')
    await scriptManager.executeScheduledScript(scriptId)
  }
})

// Web navigation handling
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId === 0) { // Main frame only
    await scriptManager.executeScriptsForNavigation(details.tabId, details.url)
  }
})

/**
 * Initialize extension on first install
 */
async function initializeExtension(): Promise<void> {
  try {
    // Set default settings
    await storageManager.setDefaultSettings()
    
    // Create welcome script
    await scriptManager.createWelcomeScript()
    
    // Show welcome notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'public/icons/icon-48.png',
      title: 'ScriptFlow Installed',
      message: 'Welcome to ScriptFlow! Click the extension icon to get started.'
    })
    
    console.log('ScriptFlow initialized successfully')
  } catch (error) {
    console.error('Failed to initialize ScriptFlow:', error)
  }
}

/**
 * Handle extension updates
 */
async function handleUpdate(previousVersion: string | undefined): Promise<void> {
  console.log(`ScriptFlow updated from ${previousVersion} to ${chrome.runtime.getManifest().version}`)
  
  // Migrate data if needed
  await storageManager.migrateData(previousVersion)
  
  // Update scripts if needed
  await scriptManager.updateScripts()
}

/**
 * Set up context menus
 */
async function setupContextMenus(): Promise<void> {
  // Clear existing menus
  await chrome.contextMenus.removeAll()
  
  // Main ScriptFlow menu
  chrome.contextMenus.create({
    id: 'scriptflow-main',
    title: 'ScriptFlow',
    contexts: ['page', 'selection', 'link', 'image']
  })
  
  // Inject script option
  chrome.contextMenus.create({
    id: 'inject-script',
    parentId: 'scriptflow-main',
    title: 'Inject Script',
    contexts: ['page']
  })
  
  // Open ScriptFlow for this tab
  chrome.contextMenus.create({
    id: 'open-scriptflow',
    parentId: 'scriptflow-main',
    title: 'Open ScriptFlow',
    contexts: ['page']
  })
}

/**
 * Handle toggle ScriptFlow command
 */
async function handleToggleScriptFlow(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return
    
    const isEnabled = await tabManager.isScriptFlowEnabled(tab.id)
    await tabManager.toggleScriptFlow(tab.id, !isEnabled)
    
    // Show feedback
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'public/icons/icon-48.png',
      title: 'ScriptFlow',
      message: isEnabled ? 'Disabled for this tab' : 'Enabled for this tab'
    })
  } catch (error) {
    console.error('Failed to toggle ScriptFlow:', error)
  }
}

/**
 * Open dashboard
 */
async function openDashboard(): Promise<void> {
  await chrome.tabs.create({ url: chrome.runtime.getURL('dist/options/index.html') })
}

/**
 * Handle context menu script injection
 */
async function handleContextMenuScriptInjection(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id) return
  
  try {
    // Get user's active scripts
    const activeScripts = await scriptManager.getActiveScripts()
    
    if (activeScripts.length === 0) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'public/icons/icon-48.png',
        title: 'No Active Scripts',
        message: 'No scripts are currently active. Open ScriptFlow to manage your scripts.'
      })
      return
    }
    
    // Execute all active scripts for this tab
    for (const script of activeScripts) {
      await scriptManager.executeScript(script.id, tab.id)
    }
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'public/icons/icon-48.png',
      title: 'Scripts Injected',
      message: `${activeScripts.length} script(s) executed on this page`
    })
  } catch (error) {
    console.error('Failed to inject scripts:', error)
  }
}

/**
 * Open ScriptFlow for specific tab
 */
async function openScriptFlowForTab(tabId: number): Promise<void> {
  // Store the tab ID for the popup to use
  await storageManager.set('currentTabId', tabId)
  
  // Open popup (this will be handled by the popup component)
  await chrome.action.openPopup()
}

// Export for testing
export { scriptManager, storageManager, tabManager, messageHandler }