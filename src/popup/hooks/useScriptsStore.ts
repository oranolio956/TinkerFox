import { create } from 'zustand';
import { UserScript } from '../../types';

interface ScriptsState {
  scripts: UserScript[];
  selectedScript: UserScript | null;
  loading: boolean;
  
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
  selectedScript: null,
  loading: false,

  loadScripts: async () => {
    set({ loading: true });
    try {
      // In a real implementation, this would communicate with the background script
      // For now, we'll use mock data
      const mockScripts: UserScript[] = [
        {
          id: '1',
          name: 'Example Script',
          code: `// ==UserScript==
// @name         Example Script
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  An example userscript
// @author       You
// @match        *://example.com/*
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';
    console.log('Hello from Example Script!');
})();`,
          metadata: {
            name: 'Example Script',
            namespace: 'http://tampermonkey.net/',
            version: '1.0.0',
            description: 'An example userscript',
            author: 'You',
            match: ['*://example.com/*'],
            include: [],
            exclude: [],
            require: [],
            grant: ['GM_getValue'],
            runAt: 'document-idle',
            noframes: false,
          },
          enabled: true,
          createdAt: Date.now() - 86400000, // 1 day ago
          updatedAt: Date.now() - 86400000,
          lastRunAt: Date.now() - 3600000, // 1 hour ago
          runCount: 5,
          version: '1.0.0',
          updateUrl: null,
          downloadUrl: null,
        },
      ];

      set({ scripts: mockScripts, loading: false });
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
      // In a real implementation, this would send a message to the background script
      const newScript: UserScript = {
        id: Date.now().toString(),
        name: 'New Script',
        code,
        metadata: {
          name: 'New Script',
          namespace: '',
          version: '1.0.0',
          description: '',
          author: '',
          match: ['*://*/*'],
          include: [],
          exclude: [],
          require: [],
          grant: [],
          runAt: 'document-idle',
          noframes: false,
        },
        enabled: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastRunAt: null,
        runCount: 0,
        version: '1.0.0',
        updateUrl: null,
        downloadUrl: null,
      };

      set(state => ({
        scripts: [...state.scripts, newScript],
        selectedScript: newScript,
      }));
    } catch (error) {
      console.error('Failed to create script:', error);
      throw error;
    }
  },

  updateScript: async (id: string, code: string) => {
    try {
      // In a real implementation, this would send a message to the background script
      set(state => ({
        scripts: state.scripts.map(script =>
          script.id === id
            ? { ...script, code, updatedAt: Date.now() }
            : script
        ),
        selectedScript: state.selectedScript?.id === id
          ? { ...state.selectedScript, code, updatedAt: Date.now() }
          : state.selectedScript,
      }));
    } catch (error) {
      console.error('Failed to update script:', error);
      throw error;
    }
  },

  deleteScript: async (id: string) => {
    try {
      // In a real implementation, this would send a message to the background script
      set(state => ({
        scripts: state.scripts.filter(script => script.id !== id),
        selectedScript: state.selectedScript?.id === id ? null : state.selectedScript,
      }));
    } catch (error) {
      console.error('Failed to delete script:', error);
      throw error;
    }
  },

  toggleScript: async (id: string) => {
    try {
      // In a real implementation, this would send a message to the background script
      set(state => ({
        scripts: state.scripts.map(script =>
          script.id === id
            ? { ...script, enabled: !script.enabled, updatedAt: Date.now() }
            : script
        ),
      }));
    } catch (error) {
      console.error('Failed to toggle script:', error);
      throw error;
    }
  },
}));