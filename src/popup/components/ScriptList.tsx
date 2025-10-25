/**
 * ScriptFlow Script List Component
 * 
 * Displays list of scripts with management options
 */

import React, { useState } from 'react'
import { Play, Pause, Edit, Trash2, MoreVertical } from 'lucide-react'
import { useScriptStore } from '../hooks/useScriptStore'
import type { Script } from '@/types'

interface ScriptListProps {
  scripts: Script[]
  onScriptSelect: (script: Script) => void
  onScriptCreate: () => void
}

export function ScriptList({ scripts, onScriptSelect, onScriptCreate }: ScriptListProps): JSX.Element {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterEnabled, setFilterEnabled] = useState<'all' | 'enabled' | 'disabled'>('all')
  
  const { toggleScript, deleteScript } = useScriptStore()

  const filteredScripts = scripts.filter(script => {
    const matchesSearch = script.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         script.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesFilter = filterEnabled === 'all' || 
                         (filterEnabled === 'enabled' && script.enabled) ||
                         (filterEnabled === 'disabled' && !script.enabled)
    
    return matchesSearch && matchesFilter
  })

  const handleToggleScript = async (script: Script) => {
    try {
      await toggleScript(script.id, !script.enabled)
    } catch (error) {
      console.error('Failed to toggle script:', error)
    }
  }

  const handleDeleteScript = async (script: Script) => {
    if (confirm(`Are you sure you want to delete "${script.name}"?`)) {
      try {
        await deleteScript(script.id)
      } catch (error) {
        console.error('Failed to delete script:', error)
      }
    }
  }

  return (
    <div className="script-list">
      <div className="script-list-header">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search scripts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-tabs">
          <button
            className={`filter-tab ${filterEnabled === 'all' ? 'active' : ''}`}
            onClick={() => setFilterEnabled('all')}
          >
            All ({scripts.length})
          </button>
          <button
            className={`filter-tab ${filterEnabled === 'enabled' ? 'active' : ''}`}
            onClick={() => setFilterEnabled('enabled')}
          >
            Enabled ({scripts.filter(s => s.enabled).length})
          </button>
          <button
            className={`filter-tab ${filterEnabled === 'disabled' ? 'active' : ''}`}
            onClick={() => setFilterEnabled('disabled')}
          >
            Disabled ({scripts.filter(s => !s.enabled).length})
          </button>
        </div>
      </div>

      <div className="script-list-content">
        {filteredScripts.length === 0 ? (
          <div className="empty-state">
            <p>No scripts found</p>
            <button className="create-button" onClick={onScriptCreate}>
              Create your first script
            </button>
          </div>
        ) : (
          <div className="script-items">
            {filteredScripts.map(script => (
              <div key={script.id} className="script-item">
                <div className="script-item-main" onClick={() => onScriptSelect(script)}>
                  <div className="script-item-header">
                    <h3 className="script-name">{script.name}</h3>
                    <div className="script-actions">
                      <button
                        className={`toggle-button ${script.enabled ? 'enabled' : 'disabled'}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleScript(script)
                        }}
                        title={script.enabled ? 'Disable' : 'Enable'}
                      >
                        {script.enabled ? <Play size={14} /> : <Pause size={14} />}
                      </button>
                      
                      <button
                        className="action-button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onScriptSelect(script)
                        }}
                        title="Edit"
                      >
                        <Edit size={14} />
                      </button>
                      
                      <button
                        className="action-button danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteScript(script)
                        }}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  {script.description && (
                    <p className="script-description">{script.description}</p>
                  )}
                  
                  <div className="script-meta">
                    <span className="script-version">v{script.version}</span>
                    {script.author && (
                      <span className="script-author">by {script.author}</span>
                    )}
                    <span className="script-executions">
                      {script.executionCount} executions
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}