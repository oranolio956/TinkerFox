import { db } from './database';
import { UserScript, ScriptVersion, ScriptExecution } from '@/types';
import { nanoid } from 'nanoid';
import { parseMetadata } from './metadata-parser';

export class ScriptStorage {
  
  // Create new script
  static async createScript(code: string): Promise<UserScript> {
    const metadata = parseMetadata(code);
    
    const script: UserScript = {
      id: nanoid(),
      name: metadata.name || 'Untitled Script',
      code,
      metadata,
      enabled: false,  // Disabled by default (safety)
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastRunAt: null,
      runCount: 0,
      version: metadata.version || '1.0.0',
      updateUrl: metadata.updateURL || null,
      downloadUrl: metadata.downloadURL || null,
    };
    
    await db.scripts.add(script);
    
    // Save initial version
    await this.saveVersion(script.id, code, 'Initial version');
    
    return script;
  }
  
  // Get script by ID
  static async getScript(id: string): Promise<UserScript | null> {
    const script = await db.scripts.get(id);
    return script || null;
  }
  
  // Update existing script
  static async updateScript(id: string, code: string, changelog?: string): Promise<void> {
    const metadata = parseMetadata(code);
    
    await db.scripts.update(id, {
      code,
      metadata,
      updatedAt: Date.now(),
      version: metadata.version || '1.0.0',
    });
    
    // Save version history
    await this.saveVersion(id, code, changelog);
  }
  
  // Save version to history
  static async saveVersion(scriptId: string, code: string, changelog?: string): Promise<void> {
    const script = await db.scripts.get(scriptId);
    if (!script) throw new Error('Script not found');
    
    const version: ScriptVersion = {
      id: nanoid(),
      scriptId,
      version: script.version,
      code,
      createdAt: Date.now(),
      changeLog: changelog,
    };
    
    await db.versions.add(version);
    
    // Keep only last 50 versions (prevent bloat)
    const versions = await db.versions
      .where('scriptId').equals(scriptId)
      .reverse()
      .sortBy('createdAt');
    
    if (versions.length > 50) {
      const toDelete = versions.slice(50);
      await db.versions.bulkDelete(toDelete.map(v => v.id));
    }
  }
  
  // Get all scripts
  static async getAllScripts(): Promise<UserScript[]> {
    return db.scripts.toArray();
  }
  
  // Get enabled scripts for URL
  static async getScriptsForUrl(url: string): Promise<UserScript[]> {
    const allScripts = await db.scripts.filter(script => script.enabled).toArray();
    
    return allScripts.filter(script => {
      return this.matchesUrl(script.metadata, url);
    });
  }
  
  // Check if script matches URL pattern
  private static matchesUrl(metadata: any, url: string): boolean {
    // Check @match patterns
    for (const pattern of metadata.match) {
      if (this.matchPattern(pattern, url)) return true;
    }
    
    // Check @include patterns
    for (const pattern of metadata.include) {
      if (this.matchPattern(pattern, url)) return true;
    }
    
    // Check @exclude patterns (if matches, exclude)
    for (const pattern of metadata.exclude) {
      if (this.matchPattern(pattern, url)) return false;
    }
    
    return false;
  }
  
  // Convert userscript pattern to regex
  private static matchPattern(pattern: string, url: string): boolean {
    // Convert Greasemonkey pattern to regex
    // Example: "*://example.com/*" -> /^https?:\/\/example\.com\/.*/
    
    let regex = pattern
      .replace(/\./g, '\\.')           // Escape dots
      .replace(/\*/g, '.*')            // * = any chars
      .replace(/\?/g, '\\?');          // Escape ?
    
    regex = `^${regex}$`;
    
    try {
      return new RegExp(regex).test(url);
    } catch {
      return false;  // Invalid pattern
    }
  }
  
  // Toggle script enabled state
  static async toggleScript(id: string): Promise<boolean> {
    const script = await db.scripts.get(id);
    if (!script) throw new Error('Script not found');
    
    const newState = !script.enabled;
    await db.scripts.update(id, { enabled: newState });
    
    return newState;
  }
  
  // Delete script
  static async deleteScript(id: string): Promise<void> {
    await db.scripts.delete(id);
    
    // Delete all versions
    const versions = await db.versions.where('scriptId').equals(id).toArray();
    await db.versions.bulkDelete(versions.map(v => v.id));
    
    // Delete execution logs
    const executions = await db.executions.where('scriptId').equals(id).toArray();
    await db.executions.bulkDelete(executions.map(e => e.id));
  }
  
  // Log script execution (for debug console)
  static async logExecution(
    scriptId: string,
    url: string,
    success: boolean,
    executionTime: number,
    error?: string
  ): Promise<void> {
    const execution: ScriptExecution = {
      id: nanoid(),
      scriptId,
      url,
      success,
      error,
      executionTime,
      timestamp: Date.now(),
    };
    
    await db.executions.add(execution);
    
    // Update script stats
    await db.scripts.update(scriptId, {
      lastRunAt: Date.now(),
      runCount: (await db.scripts.get(scriptId))!.runCount + 1,
    });
    
    // Keep only last 1000 executions (prevent bloat)
    const count = await db.executions.count();
    if (count > 1000) {
      const oldest = await db.executions
        .orderBy('timestamp')
        .limit(count - 1000)
        .toArray();
      await db.executions.bulkDelete(oldest.map(e => e.id));
    }
  }
  
  // Get version history
  static async getVersionHistory(scriptId: string): Promise<ScriptVersion[]> {
    return db.versions
      .where('scriptId').equals(scriptId)
      .reverse()
      .sortBy('createdAt');
  }
  
  // Rollback to previous version
  static async rollbackToVersion(scriptId: string, versionId: string): Promise<void> {
    const version = await db.versions.get(versionId);
    if (!version) throw new Error('Version not found');
    
    await this.updateScript(scriptId, version.code, `Rolled back to v${version.version}`);
  }
}