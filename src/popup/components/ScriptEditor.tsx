/**
 * ScriptFlow Script Editor Component
 * 
 * Monaco editor for script editing with syntax highlighting
 */

import React, { useState, useEffect } from 'react'
import { Editor } from '@monaco-editor/react'
import { Save, X, Play, Settings } from 'lucide-react'
import { useScriptStore } from '../hooks/useScriptStore'
import type { Script } from '@/types'

interface ScriptEditorProps {
  script: Script | null
  onSave: (script: Script) => void
  onCancel: () => void
}

export function ScriptEditor({ script, onSave, onCancel }: ScriptEditorProps): JSX.Element {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    version: '1.0.0',
    author: '',
    code: '',
    language: 'javascript' as const,
    matches: ['<all_urls>'],
    enabled: true
  })
  
  const [isSaving, setIsSaving] = useState(false)
  const { createScript, updateScript } = useScriptStore()

  // Initialize form data when script changes
  useEffect(() => {
    if (script) {
      setFormData({
        name: script.name,
        description: script.description || '',
        version: script.version,
        author: script.author || '',
        code: script.code,
        language: script.language,
        matches: script.matches,
        enabled: script.enabled
      })
    } else {
      setFormData({
        name: '',
        description: '',
        version: '1.0.0',
        author: '',
        code: '// Write your script here\nconsole.log("Hello, ScriptFlow!");',
        language: 'javascript',
        matches: ['<all_urls>'],
        enabled: true
      })
    }
  }, [script])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const scriptData = {
        ...formData,
        matches: formData.matches.filter(m => m.trim() !== ''),
        updatedAt: Date.now()
      }

      if (script) {
        const updatedScript = await updateScript(script.id, scriptData)
        onSave(updatedScript)
      } else {
        const newScript = await createScript(scriptData)
        onSave(newScript)
      }
    } catch (error) {
      console.error('Failed to save script:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCodeChange = (value: string | undefined) => {
    setFormData(prev => ({ ...prev, code: value || '' }))
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleMatchesChange = (value: string) => {
    const matches = value.split('\n').filter(m => m.trim() !== '')
    setFormData(prev => ({ ...prev, matches }))
  }

  return (
    <div className="script-editor">
      <div className="script-editor-header">
        <div className="editor-title">
          {script ? 'Edit Script' : 'New Script'}
        </div>
        
        <div className="editor-actions">
          <button
            className="action-button"
            onClick={handleSave}
            disabled={isSaving}
            title="Save Script"
          >
            <Save size={16} />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          
          <button
            className="action-button"
            onClick={onCancel}
            title="Cancel"
          >
            <X size={16} />
            Cancel
          </button>
        </div>
      </div>

      <div className="script-editor-content">
        <div className="script-form">
          <div className="form-row">
            <div className="form-group">
              <label>Script Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter script name"
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label>Version</label>
              <input
                type="text"
                value={formData.version}
                onChange={(e) => handleInputChange('version', e.target.value)}
                placeholder="1.0.0"
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter script description"
              className="form-input"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Author</label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) => handleInputChange('author', e.target.value)}
                placeholder="Your name"
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label>Language</label>
              <select
                value={formData.language}
                onChange={(e) => handleInputChange('language', e.target.value)}
                className="form-select"
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>URL Matches (one per line)</label>
            <textarea
              value={formData.matches.join('\n')}
              onChange={(e) => handleMatchesChange(e.target.value)}
              placeholder="<all_urls>"
              className="form-textarea"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => handleInputChange('enabled', e.target.checked.toString())}
              />
              Enable this script
            </label>
          </div>
        </div>

        <div className="code-editor">
          <div className="editor-header">
            <span>Script Code</span>
            <div className="editor-info">
              {formData.language === 'typescript' ? 'TypeScript' : 'JavaScript'}
            </div>
          </div>
          
          <div className="monaco-container">
            <Editor
              height="300px"
              language={formData.language}
              value={formData.code}
              onChange={handleCodeChange}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                padding: { top: 16, bottom: 16 }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}