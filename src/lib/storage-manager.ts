/**
 * Storage Manager
 * 
 * Handles all Chrome extension storage operations with proper error handling
 * and data migration support for MV3 compatibility
 */

import type { 
  StorageData, 
  ExtensionSettings, 
  Script, 
  ScriptExecutionResult, 
  TabInfo,
  AIConfig,
  DEFAULT_SETTINGS 
} from '@/types'

export class StorageManager {
  private static instance: StorageManager
  private isInitialized = false

  constructor() {
    if (StorageManager.instance) {
      return StorageManager.instance
    }
    StorageManager.instance = this
  }

  /**
   * Initialize storage manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Check if storage is available
      await chrome.storage.local.get(null)
      this.isInitialized = true
      console.log('Storage manager initialized')
    } catch (error) {
      console.error('Failed to initialize storage manager:', error)
      throw error
    }
  }

  /**
   * Get all storage data
   */
  async getAll(): Promise<StorageData> {
    await this.ensureInitialized()
    
    const data = await chrome.storage.local.get([
      'scripts',
      'settings',
      'executionHistory',
      'tabStates',
      'aiConfig'
    ])

    return {
      scripts: data.scripts || [],
      settings: data.settings || DEFAULT_SETTINGS,
      executionHistory: data.executionHistory || [],
      tabStates: data.tabStates || {},
      aiConfig: data.aiConfig
    }
  }

  /**
   * Get specific storage key
   */
  async get<T = any>(key: string): Promise<T | undefined> {
    await this.ensureInitialized()
    
    try {
      const result = await chrome.storage.local.get(key)
      return result[key]
    } catch (error) {
      console.error(`Failed to get storage key ${key}:`, error)
      return undefined
    }
  }

  /**
   * Set specific storage key
   */
  async set<T = any>(key: string, value: T): Promise<void> {
    await this.ensureInitialized()
    
    try {
      await chrome.storage.local.set({ [key]: value })
    } catch (error) {
      console.error(`Failed to set storage key ${key}:`, error)
      throw error
    }
  }

  /**
   * Delete specific storage key
   */
  async delete(key: string): Promise<void> {
    await this.ensureInitialized()
    
    try {
      await chrome.storage.local.remove(key)
    } catch (error) {
      console.error(`Failed to delete storage key ${key}:`, error)
      throw error
    }
  }

  /**
   * Clear all storage
   */
  async clear(): Promise<void> {
    await this.ensureInitialized()
    
    try {
      await chrome.storage.local.clear()
    } catch (error) {
      console.error('Failed to clear storage:', error)
      throw error
    }
  }

  /**
   * Get scripts
   */
  async getScripts(): Promise<Script[]> {
    const scripts = await this.get<Script[]>('scripts')
    return scripts || []
  }

  /**
   * Save scripts
   */
  async saveScripts(scripts: Script[]): Promise<void> {
    await this.set('scripts', scripts)
  }

  /**
   * Get settings
   */
  async getSettings(): Promise<ExtensionSettings> {
    const settings = await this.get<ExtensionSettings>('settings')
    return settings || DEFAULT_SETTINGS
  }

  /**
   * Save settings
   */
  async saveSettings(settings: ExtensionSettings): Promise<void> {
    await this.set('settings', settings)
  }

  /**
   * Get execution history
   */
  async getExecutionHistory(): Promise<ScriptExecutionResult[]> {
    const history = await this.get<ScriptExecutionResult[]>('executionHistory')
    return history || []
  }

  /**
   * Add execution result to history
   */
  async addExecutionResult(result: ScriptExecutionResult): Promise<void> {
    const history = await this.getExecutionHistory()
    history.push(result)
    
    // Keep only last 1000 executions
    if (history.length > 1000) {
      history.splice(0, history.length - 1000)
    }
    
    await this.set('executionHistory', history)
  }

  /**
   * Get tab states
   */
  async getTabStates(): Promise<Record<number, TabInfo>> {
    const states = await this.get<Record<number, TabInfo>>('tabStates')
    return states || {}
  }

  /**
   * Update tab state
   */
  async updateTabState(tabId: number, tabInfo: TabInfo): Promise<void> {
    const states = await this.getTabStates()
    states[tabId] = tabInfo
    await this.set('tabStates', states)
  }

  /**
   * Remove tab state
   */
  async removeTabState(tabId: number): Promise<void> {
    const states = await this.getTabStates()
    delete states[tabId]
    await this.set('tabStates', states)
  }

  /**
   * Get AI configuration
   */
  async getAIConfig(): Promise<AIConfig | undefined> {
    return await this.get<AIConfig>('aiConfig')
  }

  /**
   * Save AI configuration
   */
  async saveAIConfig(config: AIConfig): Promise<void> {
    await this.set('aiConfig', config)
  }

  /**
   * Set default settings on first install
   */
  async setDefaultSettings(): Promise<void> {
    const existingSettings = await this.get<ExtensionSettings>('settings')
    if (!existingSettings) {
      await this.set('settings', DEFAULT_SETTINGS)
    }
  }

  /**
   * Migrate data between versions
   */
  async migrateData(previousVersion: string | undefined): Promise<void> {
    if (!previousVersion) return

    console.log(`Migrating data from version ${previousVersion}`)

    try {
      // Example migration logic
      if (this.isVersionLessThan(previousVersion, '1.1.0')) {
        await this.migrateToV1_1_0()
      }

      if (this.isVersionLessThan(previousVersion, '1.2.0')) {
        await this.migrateToV1_2_0()
      }
    } catch (error) {
      console.error('Data migration failed:', error)
    }
  }

  /**
   * Check if version is less than target
   */
  private isVersionLessThan(version: string, target: string): boolean {
    const v1 = version.split('.').map(Number)
    const v2 = target.split('.').map(Number)
    
    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
      const n1 = v1[i] || 0
      const n2 = v2[i] || 0
      
      if (n1 < n2) return true
      if (n1 > n2) return false
    }
    
    return false
  }

  /**
   * Migration to version 1.1.0
   */
  private async migrateToV1_1_0(): Promise<void> {
    // Add new fields to existing scripts
    const scripts = await this.getScripts()
    const updatedScripts = scripts.map(script => ({
      ...script,
      aiGenerated: script.aiGenerated || false,
      aiPrompt: script.aiPrompt || undefined,
      aiConfidence: script.aiConfidence || undefined
    }))
    
    await this.saveScripts(updatedScripts)
  }

  /**
   * Migration to version 1.2.0
   */
  private async migrateToV1_2_0(): Promise<void> {
    // Add new settings
    const settings = await this.getSettings()
    const updatedSettings = {
      ...settings,
      enableAI: settings.enableAI || false,
      aiProvider: settings.aiProvider || 'openai'
    }
    
    await this.saveSettings(updatedSettings)
  }

  /**
   * Ensure storage manager is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }
  }

  /**
   * Get storage usage information
   */
  async getStorageUsage(): Promise<{ used: number; available: number }> {
    try {
      const usage = await chrome.storage.local.getBytesInUse()
      return {
        used: usage,
        available: chrome.storage.local.QUOTA_BYTES - usage
      }
    } catch (error) {
      console.error('Failed to get storage usage:', error)
      return { used: 0, available: 0 }
    }
  }

  /**
   * Export all data
   */
  async exportData(): Promise<StorageData> {
    return await this.getAll()
  }

  /**
   * Import data
   */
  async importData(data: StorageData): Promise<void> {
    await this.ensureInitialized()
    
    try {
      await chrome.storage.local.set({
        scripts: data.scripts || [],
        settings: data.settings || DEFAULT_SETTINGS,
        executionHistory: data.executionHistory || [],
        tabStates: data.tabStates || {},
        aiConfig: data.aiConfig
      })
    } catch (error) {
      console.error('Failed to import data:', error)
      throw error
    }
  }
}