import { create } from 'zustand';
import { UserScript } from '@/types';

interface ScriptsState {
  scripts: UserScript[];
  loading: boolean;
  selectedScript: UserScript | null;
  
  // Actions
  loadScripts: () => Promise<void>;
  selectScript: (id: string) => void;
  createScript: (code: string) => Promise<void>;
  updateScript: (id: string, code: string) => Promise<void>;
  deleteScript: (id: string) => Promise<void>;
  toggleScript: (id: string) => Promise<void>;
}

export const useScriptsStore = create<ScriptsState>((set, get) => ({
  scripts: [],
  loading: false,
  selectedScript: null,
  
  loadScripts: async () => {
    set({ loading: true });
    
    try {
      // Communicate with background service worker
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ALL_SCRIPTS',
      });
      
      set({ scripts: response.scripts, loading: false });
      
    } catch (error) {
      console.error('Failed to load scripts:', error);
      set({ loading: false });
    }
  },
  
  selectScript: (id: string) => {
    const script = get().scripts.find(s => s.id === id);
    set({ selectedScript: script || null });
  },
  
  createScript: async (code: string) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'CREATE_SCRIPT',
        code,
      });
      
      // Reload scripts
      await get().loadScripts();
      
    } catch (error) {
      console.error('Failed to create script:', error);
      throw error;
    }
  },
  
  updateScript: async (id: string, code: string) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SCRIPT',
        id,
        code,
      });
      
      await get().loadScripts();
      
    } catch (error) {
      console.error('Failed to update script:', error);
      throw error;
    }
  },
  
  deleteScript: async (id: string) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'DELETE_SCRIPT',
        id,
      });
      
      await get().loadScripts();
      
      if (get().selectedScript?.id === id) {
        set({ selectedScript: null });
      }
      
    } catch (error) {
      console.error('Failed to delete script:', error);
      throw error;
    }
  },
  
  toggleScript: async (id: string) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'TOGGLE_SCRIPT',
        id,
      });
      
      await get().loadScripts();
      
    } catch (error) {
      console.error('Failed to toggle script:', error);
      throw error;
    }
  },
}));