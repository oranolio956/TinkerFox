import Dexie, { Table } from 'dexie';
import { UserScript, ScriptVersion, ScriptExecution, Settings } from '@/types';

class ScriptFlowDatabase extends Dexie {
  scripts!: Table<UserScript, string>;
  versions!: Table<ScriptVersion, string>;
  executions!: Table<ScriptExecution, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('ScriptFlowDB');
    
    // Version 1: Initial schema
    this.version(1).stores({
      scripts: 'id, name, enabled, updatedAt, lastRunAt',
      versions: 'id, scriptId, createdAt',
      executions: 'id, scriptId, timestamp, url',
      settings: 'id',
    });
    
    // Version 2: Add tags and improve indexes
    this.version(2).stores({
      scripts: 'id, name, enabled, updatedAt, lastRunAt, tags, [enabled+updatedAt]',
      versions: 'id, scriptId, createdAt, [scriptId+createdAt]',
      executions: 'id, scriptId, timestamp, url, [scriptId+timestamp]',
      settings: 'id',
    }).upgrade(async tx => {
      // Add tags field to existing scripts
      await tx.table('scripts').toCollection().modify(script => {
        script.tags = [];
      });
    });
    
    // Version 3: Add analytics table
    this.version(3).stores({
      scripts: 'id, name, enabled, updatedAt, lastRunAt, tags, [enabled+updatedAt]',
      versions: 'id, scriptId, createdAt, [scriptId+createdAt]',
      executions: 'id, scriptId, timestamp, url, [scriptId+timestamp]',
      settings: 'id',
      analytics: '++id, scriptId, metric, timestamp, [scriptId+timestamp]',
    });
    
    // Version 4: Add script categories and improve performance
    this.version(4).stores({
      scripts: 'id, name, enabled, updatedAt, lastRunAt, tags, category, [enabled+updatedAt], [category+enabled]',
      versions: 'id, scriptId, createdAt, [scriptId+createdAt]',
      executions: 'id, scriptId, timestamp, url, [scriptId+timestamp]',
      settings: 'id',
      analytics: '++id, scriptId, metric, timestamp, [scriptId+timestamp]',
    }).upgrade(async tx => {
      // Add category field to existing scripts
      await tx.table('scripts').toCollection().modify(script => {
        script.category = 'uncategorized';
      });
    });
  }
}

export const db = new ScriptFlowDatabase();

// Initialize default settings
export async function initializeDatabase() {
  const existingSettings = await db.settings.get('global');
  
  if (!existingSettings) {
    await db.settings.add({
      id: 'global',
      autoUpdate: true,
      updateInterval: 6,  // 6 hours
      theme: 'dark',
      editorFontSize: 13,
      githubSyncEnabled: false,
    });
  }
}