/**
 * ScriptFlow Content Script
 * 
 * Main content script that runs in the MAIN world
 * Handles communication with background script and script execution
 */

import type { ScriptMessage } from '@/types'

// Content script initialization
console.log('ScriptFlow content script loaded')

// Message handling from background script
chrome.runtime.onMessage.addListener((message: ScriptMessage, sender, sendResponse) => {
  handleContentMessage(message, sender, sendResponse)
  return true // Keep message channel open
})

// Handle messages from background script
function handleContentMessage(
  message: ScriptMessage, 
  sender: chrome.runtime.MessageSender, 
  sendResponse: (response?: any) => void
): void {
  switch (message.type) {
    case 'SCRIPT_EXECUTE':
      handleScriptExecution(message)
      break
    case 'SCRIPT_RESULT':
      handleScriptResult(message)
      break
    case 'SCRIPT_ERROR':
      handleScriptError(message)
      break
    default:
      console.log('Unknown message type:', message.type)
  }
}

// Handle script execution request
function handleScriptExecution(message: ScriptMessage): void {
  console.log('Script execution requested:', message.scriptId)
  
  // This would execute the actual script
  // For now, just acknowledge the request
  chrome.runtime.sendMessage({
    type: 'SCRIPT_EXECUTED',
    scriptId: message.scriptId,
    tabId: message.tabId,
    success: true
  })
}

// Handle script result
function handleScriptResult(message: ScriptMessage): void {
  console.log('Script result received:', message.scriptId, message.payload)
}

// Handle script error
function handleScriptError(message: ScriptMessage): void {
  console.error('Script error:', message.scriptId, message.payload)
}

// Utility functions for script execution
export const ScriptFlowContent = {
  // Execute script in main world
  executeScript: (code: string): any => {
    try {
      return eval(code)
    } catch (error) {
      console.error('Script execution error:', error)
      throw error
    }
  },

  // Send message to background
  sendMessage: (message: any): void => {
    chrome.runtime.sendMessage(message)
  },

  // Get current tab info
  getCurrentTab: (): Promise<chrome.tabs.Tab> => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB' }, (response) => {
        resolve(response.data)
      })
    })
  }
}

// Make ScriptFlowContent available globally
if (typeof window !== 'undefined') {
  (window as any).ScriptFlowContent = ScriptFlowContent
}