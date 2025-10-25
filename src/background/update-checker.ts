import { ScriptStorage } from '@/lib/script-storage';
import { db } from '@/lib/database';

export class UpdateChecker {
  
  // Check all scripts for updates
  static async checkAllScripts(): Promise<void> {
    console.log('[ScriptFlow] Checking for script updates...');
    
    const settings = await db.settings.get('global');
    if (!settings?.autoUpdate) {
      console.log('[ScriptFlow] Auto-update disabled');
      return;
    }
    
    const scripts = await ScriptStorage.getAllScripts();
    const scriptsWithUpdates = scripts.filter(s => s.updateUrl);
    
    console.log(`[ScriptFlow] Checking ${scriptsWithUpdates.length} scripts`);
    
    for (const script of scriptsWithUpdates) {
      try {
        await this.checkScript(script.id);
      } catch (error) {
        console.error(`[ScriptFlow] Update check failed for ${script.name}:`, error);
      }
    }
  }
  
  // Check single script for update
  static async checkScript(scriptId: string): Promise<boolean> {
    const script = await db.scripts.get(scriptId);
    if (!script || !script.updateUrl) return false;
    
    try {
      // Fetch update manifest
      const response = await fetch(script.updateUrl);
      const updateCode = await response.text();
      
      // Parse version from update
      const versionMatch = updateCode.match(/@version\s+(.+)/);
      const remoteVersion = versionMatch?.[1]?.trim();
      
      if (!remoteVersion) {
        console.warn(`[ScriptFlow] No version in update URL for ${script.name}`);
        return false;
      }
      
      // Compare versions
      if (this.isNewerVersion(remoteVersion, script.version)) {
        console.log(`[ScriptFlow] Update available for ${script.name}: ${script.version} -> ${remoteVersion}`);
        
        // Auto-update if enabled
        const settings = await db.settings.get('global');
        if (settings?.autoUpdate) {
          await ScriptStorage.updateScript(
            scriptId,
            updateCode,
            `Auto-update from ${script.version} to ${remoteVersion}`
          );
          
          // Notify user
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon-128.png',
            title: 'ScriptFlow: Script Updated',
            message: `${script.name} updated to v${remoteVersion}`,
          });
          
          return true;
        }
      }
      
      return false;
      
    } catch (error) {
      console.error(`[ScriptFlow] Update check failed for ${script.name}:`, error);
      return false;
    }
  }
  
  // Semantic version comparison
  private static isNewerVersion(remote: string, local: string): boolean {
    const remoteParts = remote.split('.').map(Number);
    const localParts = local.split('.').map(Number);
    
    for (let i = 0; i < Math.max(remoteParts.length, localParts.length); i++) {
      const r = remoteParts[i] || 0;
      const l = localParts[i] || 0;
      
      if (r > l) return true;
      if (r < l) return false;
    }
    
    return false;  // Equal versions
  }
}