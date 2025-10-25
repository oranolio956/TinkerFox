export class PermissionManager {
  
  // Request permission with user-friendly prompt
  static async requestPermission(permission: string): Promise<boolean> {
    try {
      // Check if already granted
      const hasPermission = await chrome.permissions.contains({
        permissions: [permission],
      });
      
      if (hasPermission) return true;
      
      // Request from user
      const granted = await chrome.permissions.request({
        permissions: [permission],
      });
      
      if (granted) {
        console.log(`[ScriptFlow] Permission granted: ${permission}`);
      } else {
        console.warn(`[ScriptFlow] Permission denied: ${permission}`);
      }
      
      return granted;
      
    } catch (error) {
      console.error('[ScriptFlow] Permission error:', error);
      return false;
    }
  }
  
  // Request host permission for specific domain
  static async requestHostPermission(domain: string): Promise<boolean> {
    try {
      const pattern = this.domainToPattern(domain);
      
      const granted = await chrome.permissions.request({
        origins: [pattern],
      });
      
      return granted;
      
    } catch (error) {
      console.error('[ScriptFlow] Host permission error:', error);
      return false;
    }
  }
  
  // Convert domain to match pattern
  private static domainToPattern(domain: string): string {
    // "example.com" -> "*://*.example.com/*"
    return `*://*.${domain}/*`;
  }
  
  // Check if we have permission for URL
  static async hasPermissionForUrl(url: string): Promise<boolean> {
    try {
      const urlObj = new URL(url);
      const pattern = `*://${urlObj.hostname}/*`;
      
      return chrome.permissions.contains({
        origins: [pattern],
      });
    } catch {
      return false;
    }
  }
}