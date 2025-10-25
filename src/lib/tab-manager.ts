/**
 * Tab Manager
 * 
 * Handles tab state management and ScriptFlow integration
 * Provides MV3-compliant tab operations
 */

import type { TabInfo } from '@/types'
import { StorageManager } from './storage-manager'

export class TabManager {
  private storageManager: StorageManager
  private tabStates: Map<number, TabInfo> = new Map()

  constructor() {
    this.storageManager = new StorageManager()
  }

  /**
   * Handle tab update
   */
  async handleTabUpdate(tabId: number, tab: chrome.tabs.Tab): Promise<void> {
    if (!tab.url || !tab.title) return

    const tabInfo: TabInfo = {
      id: tabId,
      url: tab.url,
      title: tab.title,
      active: tab.active || false,
      scriptFlowEnabled: await this.isScriptFlowEnabled(tabId),
      lastScriptExecution: undefined
    }

    this.tabStates.set(tabId, tabInfo)
    await this.storageManager.updateTabState(tabId, tabInfo)
  }

  /**
   * Handle tab activation
   */
  async handleTabActivation(tabId: number): Promise<void> {
    // Update all tabs to mark only the active one
    for (const [id, tabInfo] of this.tabStates) {
      tabInfo.active = id === tabId
      await this.storageManager.updateTabState(id, tabInfo)
    }
  }

  /**
   * Check if ScriptFlow is enabled for tab
   */
  async isScriptFlowEnabled(tabId: number): Promise<boolean> {
    const tabInfo = this.tabStates.get(tabId)
    return tabInfo?.scriptFlowEnabled || false
  }

  /**
   * Toggle ScriptFlow for tab
   */
  async toggleScriptFlow(tabId: number, enabled: boolean): Promise<void> {
    const tabInfo = this.tabStates.get(tabId)
    if (tabInfo) {
      tabInfo.scriptFlowEnabled = enabled
      this.tabStates.set(tabId, tabInfo)
      await this.storageManager.updateTabState(tabId, tabInfo)
    }
  }

  /**
   * Get tab info
   */
  async getTabInfo(tabId: number): Promise<TabInfo | undefined> {
    return this.tabStates.get(tabId)
  }

  /**
   * Get all tab states
   */
  async getAllTabStates(): Promise<TabInfo[]> {
    return Array.from(this.tabStates.values())
  }

  /**
   * Remove tab state
   */
  async removeTabState(tabId: number): Promise<void> {
    this.tabStates.delete(tabId)
    await this.storageManager.removeTabState(tabId)
  }

  /**
   * Update script execution time for tab
   */
  async updateScriptExecution(tabId: number): Promise<void> {
    const tabInfo = this.tabStates.get(tabId)
    if (tabInfo) {
      tabInfo.lastScriptExecution = Date.now()
      this.tabStates.set(tabId, tabInfo)
      await this.storageManager.updateTabState(tabId, tabInfo)
    }
  }
}