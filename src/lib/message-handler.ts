/**
 * Message Handler
 * 
 * Handles communication between different parts of the extension
 * Provides MV3-compliant message passing
 */

import type { Message, ScriptMessage, StorageMessage, TabMessage, APIResponse } from '@/types'
import { ScriptManager } from './script-manager'
import { StorageManager } from './storage-manager'
import { TabManager } from './tab-manager'

export class MessageHandler {
  private scriptManager: ScriptManager
  private storageManager: StorageManager
  private tabManager: TabManager

  constructor() {
    this.scriptManager = new ScriptManager()
    this.storageManager = new StorageManager()
    this.tabManager = new TabManager()
  }

  /**
   * Handle incoming messages
   */
  async handleMessage(
    message: Message, 
    sender: chrome.runtime.MessageSender, 
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      const response = await this.processMessage(message, sender)
      sendResponse(response)
    } catch (error) {
      console.error('Message handling error:', error)
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Process message based on type
   */
  private async processMessage(message: Message, sender: chrome.runtime.MessageSender): Promise<APIResponse> {
    switch (message.type) {
      // Script operations
      case 'GET_SCRIPTS':
        return await this.handleGetScripts()
      case 'GET_SCRIPT':
        return await this.handleGetScript(message.payload?.id)
      case 'CREATE_SCRIPT':
        return await this.handleCreateScript(message.payload)
      case 'UPDATE_SCRIPT':
        return await this.handleUpdateScript(message.payload?.id, message.payload?.data)
      case 'DELETE_SCRIPT':
        return await this.handleDeleteScript(message.payload?.id)
      case 'EXECUTE_SCRIPT':
        return await this.handleExecuteScript(message.payload?.scriptId, message.payload?.tabId)
      case 'TOGGLE_SCRIPT':
        return await this.handleToggleScript(message.payload?.id, message.payload?.enabled)

      // Storage operations
      case 'GET_STORAGE':
        return await this.handleGetStorage(message.payload?.key)
      case 'SET_STORAGE':
        return await this.handleSetStorage(message.payload?.key, message.payload?.value)
      case 'DELETE_STORAGE':
        return await this.handleDeleteStorage(message.payload?.key)

      // Tab operations
      case 'GET_TAB_INFO':
        return await this.handleGetTabInfo(message.payload?.tabId)
      case 'TOGGLE_TAB_SCRIPTFLOW':
        return await this.handleToggleTabScriptFlow(message.payload?.tabId, message.payload?.enabled)

      // Settings operations
      case 'GET_SETTINGS':
        return await this.handleGetSettings()
      case 'UPDATE_SETTINGS':
        return await this.handleUpdateSettings(message.payload)

      // AI operations
      case 'GENERATE_SCRIPT':
        return await this.handleGenerateScript(message.payload)

      default:
        return {
          success: false,
          error: `Unknown message type: ${message.type}`,
          timestamp: Date.now()
        }
    }
  }

  // Script handlers
  private async handleGetScripts(): Promise<APIResponse> {
    const scripts = await this.scriptManager.getAllScripts()
    return {
      success: true,
      data: scripts,
      timestamp: Date.now()
    }
  }

  private async handleGetScript(id: string): Promise<APIResponse> {
    if (!id) {
      return {
        success: false,
        error: 'Script ID is required',
        timestamp: Date.now()
      }
    }

    const script = await this.scriptManager.getScript(id)
    if (!script) {
      return {
        success: false,
        error: 'Script not found',
        timestamp: Date.now()
      }
    }

    return {
      success: true,
      data: script,
      timestamp: Date.now()
    }
  }

  private async handleCreateScript(scriptData: any): Promise<APIResponse> {
    if (!scriptData) {
      return {
        success: false,
        error: 'Script data is required',
        timestamp: Date.now()
      }
    }

    const script = await this.scriptManager.createScript(scriptData)
    return {
      success: true,
      data: script,
      timestamp: Date.now()
    }
  }

  private async handleUpdateScript(id: string, data: any): Promise<APIResponse> {
    if (!id || !data) {
      return {
        success: false,
        error: 'Script ID and data are required',
        timestamp: Date.now()
      }
    }

    const script = await this.scriptManager.updateScript(id, data)
    return {
      success: true,
      data: script,
      timestamp: Date.now()
    }
  }

  private async handleDeleteScript(id: string): Promise<APIResponse> {
    if (!id) {
      return {
        success: false,
        error: 'Script ID is required',
        timestamp: Date.now()
      }
    }

    await this.scriptManager.deleteScript(id)
    return {
      success: true,
      timestamp: Date.now()
    }
  }

  private async handleExecuteScript(scriptId: string, tabId: number): Promise<APIResponse> {
    if (!scriptId || !tabId) {
      return {
        success: false,
        error: 'Script ID and Tab ID are required',
        timestamp: Date.now()
      }
    }

    const result = await this.scriptManager.executeScript(scriptId, tabId)
    return {
      success: true,
      data: result,
      timestamp: Date.now()
    }
  }

  private async handleToggleScript(id: string, enabled: boolean): Promise<APIResponse> {
    if (!id || typeof enabled !== 'boolean') {
      return {
        success: false,
        error: 'Script ID and enabled state are required',
        timestamp: Date.now()
      }
    }

    const script = await this.scriptManager.updateScript(id, { enabled })
    return {
      success: true,
      data: script,
      timestamp: Date.now()
    }
  }

  // Storage handlers
  private async handleGetStorage(key: string): Promise<APIResponse> {
    const value = await this.storageManager.get(key)
    return {
      success: true,
      data: value,
      timestamp: Date.now()
    }
  }

  private async handleSetStorage(key: string, value: any): Promise<APIResponse> {
    await this.storageManager.set(key, value)
    return {
      success: true,
      timestamp: Date.now()
    }
  }

  private async handleDeleteStorage(key: string): Promise<APIResponse> {
    await this.storageManager.delete(key)
    return {
      success: true,
      timestamp: Date.now()
    }
  }

  // Tab handlers
  private async handleGetTabInfo(tabId: number): Promise<APIResponse> {
    if (!tabId) {
      return {
        success: false,
        error: 'Tab ID is required',
        timestamp: Date.now()
      }
    }

    const tabInfo = await this.tabManager.getTabInfo(tabId)
    return {
      success: true,
      data: tabInfo,
      timestamp: Date.now()
    }
  }

  private async handleToggleTabScriptFlow(tabId: number, enabled: boolean): Promise<APIResponse> {
    if (!tabId || typeof enabled !== 'boolean') {
      return {
        success: false,
        error: 'Tab ID and enabled state are required',
        timestamp: Date.now()
      }
    }

    await this.tabManager.toggleScriptFlow(tabId, enabled)
    return {
      success: true,
      timestamp: Date.now()
    }
  }

  // Settings handlers
  private async handleGetSettings(): Promise<APIResponse> {
    const settings = await this.storageManager.getSettings()
    return {
      success: true,
      data: settings,
      timestamp: Date.now()
    }
  }

  private async handleUpdateSettings(settings: any): Promise<APIResponse> {
    if (!settings) {
      return {
        success: false,
        error: 'Settings data is required',
        timestamp: Date.now()
      }
    }

    await this.storageManager.saveSettings(settings)
    return {
      success: true,
      timestamp: Date.now()
    }
  }

  // AI handlers
  private async handleGenerateScript(prompt: string): Promise<APIResponse> {
    // Placeholder for AI script generation
    // This would integrate with AI services in the future
    return {
      success: false,
      error: 'AI script generation not yet implemented',
      timestamp: Date.now()
    }
  }
}