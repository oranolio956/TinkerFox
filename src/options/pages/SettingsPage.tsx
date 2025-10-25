/**
 * ScriptFlow Settings Page
 * 
 * Settings and configuration interface
 */

import React, { useState, useEffect } from 'react'
import { Save, RotateCcw, AlertCircle } from 'lucide-react'
import { useSettingsStore } from '../../popup/hooks/useSettingsStore'
import type { ExtensionSettings } from '@/types'

export function SettingsPage(): JSX.Element {
  const { settings, loading, updateSettings, resetSettings } = useSettingsStore()
  const [formData, setFormData] = useState<ExtensionSettings>(settings)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setFormData(settings)
  }, [settings])

  useEffect(() => {
    setHasChanges(JSON.stringify(formData) !== JSON.stringify(settings))
  }, [formData, settings])

  const handleInputChange = (field: keyof ExtensionSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateSettings(formData)
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      try {
        await resetSettings()
        setHasChanges(false)
      } catch (error) {
        console.error('Failed to reset settings:', error)
      }
    }
  }

  if (loading) {
    return (
      <div className="settings-page">
        <div className="loading">
          <div className="spinner" />
          <p>Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div className="settings-title">
          <h2>Settings</h2>
          <p>Configure ScriptFlow behavior and preferences</p>
        </div>
        
        <div className="settings-actions">
          <button 
            className="action-button secondary"
            onClick={handleReset}
            disabled={isSaving}
          >
            <RotateCcw size={16} />
            Reset
          </button>
          
          <button 
            className="action-button primary"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            <Save size={16} />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <h3>General</h3>
          <div className="settings-grid">
            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={formData.autoInject}
                  onChange={(e) => handleInputChange('autoInject', e.target.checked)}
                />
                <span>Auto-inject scripts on page load</span>
              </label>
              <p className="setting-description">
                Automatically execute enabled scripts when pages load
              </p>
            </div>

            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={formData.showNotifications}
                  onChange={(e) => handleInputChange('showNotifications', e.target.checked)}
                />
                <span>Show notifications</span>
              </label>
              <p className="setting-description">
                Display notifications for script execution results
              </p>
            </div>

            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={formData.enableLogging}
                  onChange={(e) => handleInputChange('enableLogging', e.target.checked)}
                />
                <span>Enable logging</span>
              </label>
              <p className="setting-description">
                Log script execution and errors to console
              </p>
            </div>

            <div className="setting-item">
              <label className="setting-label">
                <span>Log Level</span>
              </label>
              <select
                value={formData.logLevel}
                onChange={(e) => handleInputChange('logLevel', e.target.value)}
                className="setting-select"
              >
                <option value="error">Error</option>
                <option value="warn">Warning</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>Script Execution</h3>
          <div className="settings-grid">
            <div className="setting-item">
              <label className="setting-label">
                <span>Max Concurrent Scripts</span>
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={formData.maxConcurrentScripts}
                onChange={(e) => handleInputChange('maxConcurrentScripts', parseInt(e.target.value))}
                className="setting-input"
              />
              <p className="setting-description">
                Maximum number of scripts that can run simultaneously
              </p>
            </div>

            <div className="setting-item">
              <label className="setting-label">
                <span>Script Timeout (ms)</span>
              </label>
              <input
                type="number"
                min="1000"
                max="300000"
                value={formData.scriptTimeout}
                onChange={(e) => handleInputChange('scriptTimeout', parseInt(e.target.value))}
                className="setting-input"
              />
              <p className="setting-description">
                Maximum time a script can run before being terminated
              </p>
            </div>

            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={formData.enableCSP}
                  onChange={(e) => handleInputChange('enableCSP', e.target.checked)}
                />
                <span>Enable Content Security Policy</span>
              </label>
              <p className="setting-description">
                Apply CSP restrictions to script execution
              </p>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>User Interface</h3>
          <div className="settings-grid">
            <div className="setting-item">
              <label className="setting-label">
                <span>Theme</span>
              </label>
              <select
                value={formData.theme}
                onChange={(e) => handleInputChange('theme', e.target.value)}
                className="setting-select"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto</option>
              </select>
            </div>

            <div className="setting-item">
              <label className="setting-label">
                <span>Popup Size</span>
              </label>
              <select
                value={formData.popupSize}
                onChange={(e) => handleInputChange('popupSize', e.target.value)}
                className="setting-select"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>

            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={formData.showExecutionTime}
                  onChange={(e) => handleInputChange('showExecutionTime', e.target.checked)}
                />
                <span>Show execution time</span>
              </label>
              <p className="setting-description">
                Display script execution time in the UI
              </p>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>Security</h3>
          <div className="settings-grid">
            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={formData.allowEval}
                  onChange={(e) => handleInputChange('allowEval', e.target.checked)}
                />
                <span>Allow eval() in scripts</span>
              </label>
              <p className="setting-description">
                <AlertCircle size={14} />
                Warning: This can be a security risk
              </p>
            </div>

            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={formData.allowInlineScripts}
                  onChange={(e) => handleInputChange('allowInlineScripts', e.target.checked)}
                />
                <span>Allow inline scripts</span>
              </label>
              <p className="setting-description">
                Allow scripts to execute inline code
              </p>
            </div>

            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={formData.sandboxMode}
                  onChange={(e) => handleInputChange('sandboxMode', e.target.checked)}
                />
                <span>Sandbox mode</span>
              </label>
              <p className="setting-description">
                Run scripts in a sandboxed environment
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}