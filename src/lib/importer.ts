import { ScriptStorage } from './script-storage';
import JSZip from 'jszip';

export class TampermonkeyImporter {
  
  // Import from Tampermonkey backup file (.zip)
  static async importFromZip(file: File): Promise<{ success: number; failed: number }> {
    try {
      const zip = await JSZip.loadAsync(file);
      const scriptFiles = Object.keys(zip.files).filter(name => name.endsWith('.user.js'));
      
      let success = 0;
      let failed = 0;
      
      for (const filename of scriptFiles) {
        try {
          const content = await zip.files[filename].async('string');
          await ScriptStorage.createScript(content);
          success++;
        } catch (error) {
          console.error(`Failed to import ${filename}:`, error);
          failed++;
        }
      }
      
      return { success, failed };
      
    } catch (error) {
      console.error('Import failed:', error);
      throw new Error('Failed to read ZIP file');
    }
  }
  
  // Import from JSON format
  static async importFromJSON(json: string): Promise<{ success: number; failed: number }> {
    try {
      const data = JSON.parse(json);
      
      let success = 0;
      let failed = 0;
      
      // Tampermonkey JSON format: array of script objects
      for (const item of data) {
        try {
          const code = item.code || item.source || '';
          if (code) {
            await ScriptStorage.createScript(code);
            success++;
          }
        } catch (error) {
          console.error('Failed to import script:', error);
          failed++;
        }
      }
      
      return { success, failed };
      
    } catch (error) {
      console.error('Import failed:', error);
      throw new Error('Invalid JSON format');
    }
  }
  
  // Export all scripts to ZIP
  static async exportToZip(): Promise<Blob> {
    const zip = new JSZip();
    const scripts = await ScriptStorage.getAllScripts();
    
    for (const script of scripts) {
      const filename = `${script.name.replace(/[^a-z0-9]/gi, '_')}.user.js`;
      zip.file(filename, script.code);
    }
    
    return zip.generateAsync({ type: 'blob' });
  }
  
  // Export to JSON
  static async exportToJSON(): Promise<string> {
    const scripts = await ScriptStorage.getAllScripts();
    
    const data = scripts.map(script => ({
      name: script.name,
      code: script.code,
      enabled: script.enabled,
      version: script.version,
      metadata: script.metadata,
    }));
    
    return JSON.stringify(data, null, 2);
  }
}