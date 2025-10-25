/**
 * ScriptFlow Settings Store Hook
 * 
 * Zustand store for settings management
 */

import { create } from 'zustand'
import type { ExtensionSettings, DEFAULT_SETTINGS } from '@/types'

interface SettingsStore {
  settings: ExtensionSettings
  loading: boolean
  error: string | null
  
  // Actions
  loadSettings: () => Promise<void>
  updateSettings: (updates: Partial<ExtensionSettings>) => Promise<void>
  resetSettings: () => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loading: false,
  error: null,

  loadSettings: async () => {
    set({ loading: true, error: null })
    
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' })
      
      if (response.success) {
        set({ settings: response.data, loading: false })
      } else {
        set({ error: response.error, loading: false })
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load settings',
        loading: false 
      })
    }
  },

  updateSettings: async (updates) => {
    try {
      const currentSettings = get().settings
      const newSettings = { ...currentSettings, ...updates }
      
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: newSettings
      })
      
      if (response.success) {
        set({ settings: newSettings })
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      console.error('Failed to update settings:', error)
      throw error
    }
  },

  resetSettings: async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: DEFAULT_SETTINGS
      })
      
      if (response.success) {
        set({ settings: DEFAULT_SETTINGS })
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      console.error('Failed to reset settings:', error)
      throw error
    }
  }
}))

// Auto-load settings when store is first used
useSettingsStore.getState().loadSettings()