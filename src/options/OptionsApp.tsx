import { useState, useEffect } from 'react';
import { useScriptsStore } from '@/lib/scripts-store';

export function OptionsApp() {
  const [settings, setSettings] = useState({
    autoUpdate: true,
    updateInterval: 6,
    theme: 'dark',
    editorFontSize: 13,
    githubSyncEnabled: false,
    githubToken: '',
    githubRepo: '',
  });

  const { scripts, loadScripts } = useScriptsStore();

  useEffect(() => {
    loadScripts();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const result = await chrome.storage.local.get(['scriptflow_settings']);
      if (result.scriptflow_settings) {
        setSettings({ ...settings, ...result.scriptflow_settings });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async (newSettings: typeof settings) => {
    try {
      await chrome.storage.local.set({ scriptflow_settings: newSettings });
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleSettingChange = (key: keyof typeof settings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-blue-400">ScriptFlow</h1>
            <p className="text-gray-400">Settings & Configuration</p>
          </div>
          <div className="text-sm text-gray-500">
            {scripts.length} scripts installed
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* General Settings */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">General Settings</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Auto-update scripts</label>
                <p className="text-xs text-gray-400">Automatically check for script updates</p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoUpdate}
                onChange={(e) => handleSettingChange('autoUpdate', e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Update interval (hours)</label>
                <p className="text-xs text-gray-400">How often to check for updates</p>
              </div>
              <select
                value={settings.updateInterval}
                onChange={(e) => handleSettingChange('updateInterval', parseInt(e.target.value))}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
              >
                <option value={1}>1 hour</option>
                <option value={6}>6 hours</option>
                <option value={12}>12 hours</option>
                <option value={24}>24 hours</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Theme</label>
                <p className="text-xs text-gray-400">Interface appearance</p>
              </div>
              <select
                value={settings.theme}
                onChange={(e) => handleSettingChange('theme', e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="auto">Auto</option>
              </select>
            </div>
          </div>
        </div>

        {/* Editor Settings */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Editor Settings</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Font size</label>
                <p className="text-xs text-gray-400">Editor font size in pixels</p>
              </div>
              <input
                type="number"
                min="10"
                max="24"
                value={settings.editorFontSize}
                onChange={(e) => handleSettingChange('editorFontSize', parseInt(e.target.value))}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm w-20"
              />
            </div>
          </div>
        </div>

        {/* GitHub Sync */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">GitHub Sync</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Enable GitHub sync</label>
                <p className="text-xs text-gray-400">Backup scripts to GitHub repository</p>
              </div>
              <input
                type="checkbox"
                checked={settings.githubSyncEnabled}
                onChange={(e) => handleSettingChange('githubSyncEnabled', e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
            </div>

            {settings.githubSyncEnabled && (
              <>
                <div>
                  <label className="text-sm font-medium">GitHub Token</label>
                  <p className="text-xs text-gray-400 mb-2">Personal access token for GitHub API</p>
                  <input
                    type="password"
                    value={settings.githubToken}
                    onChange={(e) => handleSettingChange('githubToken', e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Repository</label>
                  <p className="text-xs text-gray-400 mb-2">GitHub repository for script backup</p>
                  <input
                    type="text"
                    value={settings.githubRepo}
                    onChange={(e) => handleSettingChange('githubRepo', e.target.value)}
                    placeholder="username/scriptflow-scripts"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Script Statistics */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Script Statistics</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{scripts.length}</div>
              <div className="text-sm text-gray-400">Total Scripts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                {scripts.filter(s => s.enabled).length}
              </div>
              <div className="text-sm text-gray-400">Enabled</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">
                {scripts.filter(s => !s.enabled).length}
              </div>
              <div className="text-sm text-gray-400">Disabled</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">
                {scripts.reduce((sum, s) => sum + s.runCount, 0)}
              </div>
              <div className="text-sm text-gray-400">Total Runs</div>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">About ScriptFlow</h2>
          
          <div className="space-y-2 text-sm text-gray-400">
            <p>Version: 1.0.0</p>
            <p>Built with React, TypeScript, and Vite</p>
            <p>Chrome Extension Manifest V3</p>
            <p>Open source and privacy-focused</p>
          </div>
        </div>
      </div>
    </div>
  );
}