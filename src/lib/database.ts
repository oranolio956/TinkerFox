import Dexie, { Table } from 'dexie';
import { UserScript, ScriptVersion, ScriptExecution, Settings } from '@/types';

class ScriptFlowDatabase extends Dexie {
  scripts!: Table<UserScript, string>;
  versions!: Table<ScriptVersion, string>;
  executions!: Table<ScriptExecution, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('ScriptFlowDB');
    
    this.version(1).stores({
      scripts: 'id, name, enabled, updatedAt, lastRunAt',
      versions: 'id, scriptId, createdAt',
      executions: 'id, scriptId, timestamp, url',
      settings: 'id',
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