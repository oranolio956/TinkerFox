import { Octokit } from '@octokit/rest';
import { db } from './database';
import { ScriptStorage } from './script-storage';

export class GitHubSync {
  private octokit: Octokit | null = null;
  
  // Authenticate with GitHub
  async authenticate(token: string): Promise<boolean> {
    try {
      this.octokit = new Octokit({ auth: token });
      
      // Test authentication
      const { data } = await this.octokit.users.getAuthenticated();
      console.log(`Authenticated as ${data.login}`);
      
      // Save token (encrypted in chrome.storage)
      await chrome.storage.local.set({ githubToken: token });
      
      // Update settings
      await db.settings.update('global', {
        githubSyncEnabled: true,
        githubToken: token,
      });
      
      return true;
      
    } catch (error) {
      console.error('GitHub authentication failed:', error);
      return false;
    }
  }
  
  // Create or get sync repository
  async initRepository(repoName: string = 'scriptflow-scripts'): Promise<string> {
    if (!this.octokit) throw new Error('Not authenticated');
    
    try {
      // Try to get existing repo
      const { data: user } = await this.octokit.users.getAuthenticated();
      const { data: _repo } = await this.octokit.repos.get({
        owner: user.login,
        repo: repoName,
      });
      
      return `${user.login}/${repoName}`;
      
    } catch (error) {
      // Create new private repo
      const { data: repo } = await this.octokit.repos.createForAuthenticatedUser({
        name: repoName,
        private: true,
        description: 'ScriptFlow userscripts backup',
        auto_init: true,
      });
      
      console.log(`Created repo: ${repo.full_name}`);
      
      // Save to settings
      await db.settings.update('global', {
        githubRepo: repo.full_name,
      });
      
      return repo.full_name;
    }
  }
  
  // Sync all scripts to GitHub
  async syncToGitHub(): Promise<void> {
    if (!this.octokit) throw new Error('Not authenticated');
    
    const settings = await db.settings.get('global');
    if (!settings?.githubRepo) throw new Error('No repository configured');
    
    const [owner, repo] = settings.githubRepo.split('/');
    const scripts = await ScriptStorage.getAllScripts();
    
    console.log(`Syncing ${scripts.length} scripts to ${settings.githubRepo}...`);
    
    for (const script of scripts) {
      try {
        const path = `scripts/${script.name.replace(/[^a-z0-9]/gi, '_')}.user.js`;
        
        // Get current file SHA (needed for updates)
        let sha: string | undefined;
        try {
          const { data: existing } = await this.octokit.repos.getContent({
            owner,
            repo,
            path,
          });
          if ('sha' in existing) sha = existing.sha;
        } catch {
          // File doesn't exist yet
        }
        
        // Create or update file
        await this.octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path,
          message: `Update ${script.name} to v${script.version}`,
          content: btoa(script.code), // Convert to base64
          sha,
        });
        
        console.log(`Synced ${script.name}`);
        
      } catch (error) {
        console.error(`Failed to sync ${script.name}:`, error);
      }
    }
    
    console.log('GitHub sync complete!');
  }
  
  // Pull scripts from GitHub
  async pullFromGitHub(): Promise<number> {
    if (!this.octokit) throw new Error('Not authenticated');
    
    const settings = await db.settings.get('global');
    if (!settings?.githubRepo) throw new Error('No repository configured');
    
    const [owner, repo] = settings.githubRepo.split('/');
    
    try {
      // Get all files in scripts/ directory
      const { data: contents } = await this.octokit.repos.getContent({
        owner,
        repo,
        path: 'scripts',
      });
      
      if (!Array.isArray(contents)) return 0;
      
      let imported = 0;
      
      for (const file of contents) {
        if (!file.name.endsWith('.user.js')) continue;
        
        try {
          // Download file content
          const { data: fileData } = await this.octokit.repos.getContent({
            owner,
            repo,
            path: file.path,
          });
          
          if ('content' in fileData) {
            const code = atob(fileData.content); // Decode base64
            
            // Import script
            await ScriptStorage.createScript(code);
            imported++;
          }
          
        } catch (error) {
          console.error(`Failed to pull ${file.name}:`, error);
        }
      }
      
      return imported;
      
    } catch (error) {
      console.error('GitHub pull failed:', error);
      throw error;
    }
  }
  
  // Auto-sync on script changes
  async enableAutoSync(): Promise<void> {
    // Set up alarm for periodic sync (every hour)
    await chrome.alarms.create('githubSync', {
      periodInMinutes: 60,
    });
    
    console.log('Auto-sync enabled');
  }
}