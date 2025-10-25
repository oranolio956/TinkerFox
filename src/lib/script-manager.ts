/**
 * Script Manager
 * 
 * Handles script creation, execution, and management for ScriptFlow
 * Provides MV3-compliant script injection and execution
 */

import type { Script, ScriptExecutionResult, TabInfo } from '@/types'
import { StorageManager } from './storage-manager'
import { ScriptFlowError } from '@/types'

export class ScriptManager {
  private storageManager: StorageManager
  private executionQueue: Map<string, Promise<ScriptExecutionResult>> = new Map()

  constructor() {
    this.storageManager = new StorageManager()
  }

  /**
   * Load all scripts from storage
   */
  async loadScripts(): Promise<Script[]> {
    return await this.storageManager.getScripts()
  }

  /**
   * Get all scripts
   */
  async getAllScripts(): Promise<Script[]> {
    return await this.loadScripts()
  }

  /**
   * Get active (enabled) scripts
   */
  async getActiveScripts(): Promise<Script[]> {
    const scripts = await this.loadScripts()
    return scripts.filter(script => script.enabled)
  }

  /**
   * Get script by ID
   */
  async getScript(id: string): Promise<Script | undefined> {
    const scripts = await this.loadScripts()
    return scripts.find(script => script.id === id)
  }

  /**
   * Create new script
   */
  async createScript(scriptData: Partial<Script>): Promise<Script> {
    const id = this.generateScriptId()
    const now = Date.now()
    
    const script: Script = {
      id,
      name: scriptData.name || 'Untitled Script',
      description: scriptData.description || '',
      version: scriptData.version || '1.0.0',
      author: scriptData.author || '',
      homepage: scriptData.homepage || '',
      license: scriptData.license || '',
      enabled: scriptData.enabled ?? true,
      runAt: scriptData.runAt || 'document_end',
      world: scriptData.world || 'ISOLATED',
      matches: scriptData.matches || ['<all_urls>'],
      excludeMatches: scriptData.excludeMatches || [],
      code: scriptData.code || '',
      language: scriptData.language || 'javascript',
      createdAt: now,
      updatedAt: now,
      executionCount: 0,
      aiGenerated: scriptData.aiGenerated || false,
      aiPrompt: scriptData.aiPrompt || '',
      aiConfidence: scriptData.aiConfidence || 0,
      requires: scriptData.requires || [],
      grants: scriptData.grants || [],
      storage: scriptData.storage || {}
    }

    const scripts = await this.loadScripts()
    scripts.push(script)
    await this.storageManager.saveScripts(scripts)

    return script
  }

  /**
   * Update existing script
   */
  async updateScript(id: string, updates: Partial<Script>): Promise<Script> {
    const scripts = await this.loadScripts()
    const index = scripts.findIndex(script => script.id === id)
    
    if (index === -1) {
      throw new ScriptFlowError(`Script with ID ${id} not found`, 'SCRIPT_NOT_FOUND', id)
    }

    scripts[index] = {
      ...scripts[index],
      ...updates,
      id, // Ensure ID cannot be changed
      updatedAt: Date.now()
    }

    await this.storageManager.saveScripts(scripts)
    return scripts[index]
  }

  /**
   * Delete script
   */
  async deleteScript(id: string): Promise<void> {
    const scripts = await this.loadScripts()
    const filteredScripts = scripts.filter(script => script.id !== id)
    
    if (filteredScripts.length === scripts.length) {
      throw new ScriptFlowError(`Script with ID ${id} not found`, 'SCRIPT_NOT_FOUND', id)
    }

    await this.storageManager.saveScripts(filteredScripts)
  }

  /**
   * Execute script on specific tab
   */
  async executeScript(scriptId: string, tabId: number): Promise<ScriptExecutionResult> {
    const script = await this.getScript(scriptId)
    if (!script) {
      throw new ScriptFlowError(`Script with ID ${scriptId} not found`, 'SCRIPT_NOT_FOUND', scriptId, tabId)
    }

    if (!script.enabled) {
      throw new ScriptFlowError(`Script ${scriptId} is disabled`, 'SCRIPT_DISABLED', scriptId, tabId)
    }

    // Check if script is already executing
    const executionKey = `${scriptId}-${tabId}`
    if (this.executionQueue.has(executionKey)) {
      return await this.executionQueue.get(executionKey)!
    }

    const executionPromise = this.performScriptExecution(script, tabId)
    this.executionQueue.set(executionKey, executionPromise)

    try {
      const result = await executionPromise
      return result
    } finally {
      this.executionQueue.delete(executionKey)
    }
  }

  /**
   * Execute all active scripts for a tab
   */
  async executeScriptsForTab(tabId: number, tab: chrome.tabs.Tab): Promise<ScriptExecutionResult[]> {
    const activeScripts = await this.getActiveScripts()
    const results: ScriptExecutionResult[] = []

    for (const script of activeScripts) {
      if (this.shouldExecuteScript(script, tab)) {
        try {
          const result = await this.executeScript(script.id, tabId)
          results.push(result)
        } catch (error) {
          console.error(`Failed to execute script ${script.id}:`, error)
          results.push({
            scriptId: script.id,
            tabId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            executionTime: 0,
            timestamp: Date.now()
          })
        }
      }
    }

    return results
  }

  /**
   * Execute scripts for navigation
   */
  async executeScriptsForNavigation(tabId: number, url: string): Promise<ScriptExecutionResult[]> {
    const activeScripts = await this.getActiveScripts()
    const results: ScriptExecutionResult[] = []

    for (const script of activeScripts) {
      if (this.matchesUrl(script, url)) {
        try {
          const result = await this.executeScript(script.id, tabId)
          results.push(result)
        } catch (error) {
          console.error(`Failed to execute script ${script.id} on navigation:`, error)
        }
      }
    }

    return results
  }

  /**
   * Execute scheduled script
   */
  async executeScheduledScript(scriptId: string): Promise<void> {
    const script = await this.getScript(scriptId)
    if (!script || !script.enabled) return

    // Get all tabs that match this script
    const tabs = await chrome.tabs.query({})
    const matchingTabs = tabs.filter(tab => 
      tab.url && this.shouldExecuteScript(script, tab)
    )

    for (const tab of matchingTabs) {
      if (tab.id) {
        try {
          await this.executeScript(scriptId, tab.id)
        } catch (error) {
          console.error(`Failed to execute scheduled script ${scriptId}:`, error)
        }
      }
    }
  }

  /**
   * Create welcome script for new users
   */
  async createWelcomeScript(): Promise<Script> {
    const welcomeCode = `
// Welcome to ScriptFlow!
// This is a sample script to get you started

console.log('ScriptFlow is working! 🎉');

// You can modify this script or create new ones
// Click the ScriptFlow icon to manage your scripts

// Example: Change page background color
document.body.style.backgroundColor = '#f0f8ff';
`

    return await this.createScript({
      name: 'Welcome to ScriptFlow',
      description: 'A sample script to demonstrate ScriptFlow functionality',
      code: welcomeCode,
      matches: ['<all_urls>'],
      enabled: true
    })
  }

  /**
   * Update scripts (for extension updates)
   */
  async updateScripts(): Promise<void> {
    // This method can be used to update scripts when the extension is updated
    // For example, adding new default scripts or updating existing ones
    console.log('Scripts updated')
  }

  /**
   * Perform actual script execution
   */
  private async performScriptExecution(script: Script, tabId: number): Promise<ScriptExecutionResult> {
    const startTime = Date.now()
    
    try {
      // Prepare script for injection
      const injectionScript = this.prepareScriptForInjection(script)
      
      // Execute script based on world setting
      if (script.world === 'MAIN') {
        await this.executeInMainWorld(tabId, injectionScript, script.runAt)
      } else {
        await this.executeInIsolatedWorld(tabId, injectionScript, script.runAt)
      }

      const executionTime = Date.now() - startTime
      
      // Update script execution count
      await this.updateScript(script.id, {
        executionCount: script.executionCount + 1,
        lastExecuted: Date.now()
      })

      const result: ScriptExecutionResult = {
        scriptId: script.id,
        tabId,
        success: true,
        executionTime,
        timestamp: Date.now()
      }

      // Save execution result
      await this.storageManager.addExecutionResult(result)
      
      return result
    } catch (error) {
      const executionTime = Date.now() - startTime
      
      const result: ScriptExecutionResult = {
        scriptId: script.id,
        tabId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
        timestamp: Date.now()
      }

      // Save execution result
      await this.storageManager.addExecutionResult(result)
      
      return result
    }
  }

  /**
   * Prepare script for injection
   */
  private prepareScriptForInjection(script: Script): string {
    // Add script metadata and error handling
    return `
// ScriptFlow Script: ${script.name}
// ID: ${script.id}
// Version: ${script.version}

(function() {
  'use strict';
  
  try {
    ${script.code}
  } catch (error) {
    console.error('ScriptFlow Script Error:', error);
    // Send error to background script
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'SCRIPT_ERROR',
        scriptId: '${script.id}',
        error: error.message,
        stack: error.stack
      });
    }
  }
})();
`
  }

  /**
   * Execute script in main world
   */
  private async executeInMainWorld(tabId: number, script: string, runAt: string): Promise<void> {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: new Function(script),
      world: 'MAIN'
    })
  }

  /**
   * Execute script in isolated world
   */
  private async executeInIsolatedWorld(tabId: number, script: string, runAt: string): Promise<void> {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: new Function(script),
      world: 'ISOLATED'
    })
  }

  /**
   * Check if script should execute on tab
   */
  private shouldExecuteScript(script: Script, tab: chrome.tabs.Tab): boolean {
    if (!tab.url) return false
    return this.matchesUrl(script, tab.url)
  }

  /**
   * Check if URL matches script patterns
   */
  private matchesUrl(script: Script, url: string): boolean {
    // Check exclude matches first
    if (script.excludeMatches) {
      for (const pattern of script.excludeMatches) {
        if (this.matchesPattern(url, pattern)) {
          return false
        }
      }
    }

    // Check include matches
    for (const pattern of script.matches) {
      if (this.matchesPattern(url, pattern)) {
        return true
      }
    }

    return false
  }

  /**
   * Check if URL matches pattern
   */
  private matchesPattern(url: string, pattern: string): boolean {
    if (pattern === '<all_urls>') return true
    
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    
    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(url)
  }

  /**
   * Generate unique script ID
   */
  private generateScriptId(): string {
    return `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}