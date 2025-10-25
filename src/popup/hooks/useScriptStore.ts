/**
 * ScriptFlow Script Store Hook
 * 
 * Zustand store for script management
 */

import { create } from 'zustand'
import type { Script } from '@/types'

interface ScriptStore {
  scripts: Script[]
  loading: boolean
  error: string | null
  
  // Actions
  loadScripts: () => Promise<void>
  createScript: (scriptData: Partial<Script>) => Promise<Script>
  updateScript: (id: string, updates: Partial<Script>) => Promise<Script>
  deleteScript: (id: string) => Promise<void>
  toggleScript: (id: string, enabled: boolean) => Promise<void>
  executeScript: (id: string, tabId?: number) => Promise<void>
}

export const useScriptStore = create<ScriptStore>((set, get) => ({
  scripts: [],
  loading: false,
  error: null,

  loadScripts: async () => {
    set({ loading: true, error: null })
    
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SCRIPTS' })
      
      if (response.success) {
        set({ scripts: response.data, loading: false })
      } else {
        set({ error: response.error, loading: false })
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load scripts',
        loading: false 
      })
    }
  },

  createScript: async (scriptData) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_SCRIPT',
        payload: scriptData
      })
      
      if (response.success) {
        const newScript = response.data
        set(state => ({ scripts: [...state.scripts, newScript] }))
        return newScript
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      console.error('Failed to create script:', error)
      throw error
    }
  },

  updateScript: async (id, updates) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_SCRIPT',
        payload: { id, data: updates }
      })
      
      if (response.success) {
        const updatedScript = response.data
        set(state => ({
          scripts: state.scripts.map(script => 
            script.id === id ? updatedScript : script
          )
        }))
        return updatedScript
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      console.error('Failed to update script:', error)
      throw error
    }
  },

  deleteScript: async (id) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DELETE_SCRIPT',
        payload: { id }
      })
      
      if (response.success) {
        set(state => ({
          scripts: state.scripts.filter(script => script.id !== id)
        }))
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      console.error('Failed to delete script:', error)
      throw error
    }
  },

  toggleScript: async (id, enabled) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TOGGLE_SCRIPT',
        payload: { id, enabled }
      })
      
      if (response.success) {
        const updatedScript = response.data
        set(state => ({
          scripts: state.scripts.map(script => 
            script.id === id ? updatedScript : script
          )
        }))
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      console.error('Failed to toggle script:', error)
      throw error
    }
  },

  executeScript: async (id, tabId) => {
    try {
      const currentTab = tabId || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id
      
      if (!currentTab) {
        throw new Error('No active tab found')
      }

      const response = await chrome.runtime.sendMessage({
        type: 'EXECUTE_SCRIPT',
        payload: { scriptId: id, tabId: currentTab }
      })
      
      if (!response.success) {
        throw new Error(response.error)
      }
    } catch (error) {
      console.error('Failed to execute script:', error)
      throw error
    }
  }
}))

// Auto-load scripts when store is first used
useScriptStore.getState().loadScripts()