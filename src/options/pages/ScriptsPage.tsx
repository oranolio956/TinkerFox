/**
 * ScriptFlow Scripts Page
 * 
 * Advanced script management interface
 */

import React, { useState } from 'react'
import { Plus, Search, Filter, MoreVertical, Play, Pause, Edit, Trash2 } from 'lucide-react'
import { useScriptStore } from '../../popup/hooks/useScriptStore'
import type { Script } from '@/types'

export function ScriptsPage(): JSX.Element {
  const { scripts, loading, createScript, updateScript, deleteScript, toggleScript } = useScriptStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'updated' | 'executions'>('name')

  const filteredScripts = scripts
    .filter(script => {
      const matchesSearch = script.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           script.description?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesFilter = filterStatus === 'all' || 
                           (filterStatus === 'enabled' && script.enabled) ||
                           (filterStatus === 'disabled' && !script.enabled)
      
      return matchesSearch && matchesFilter
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'created':
          return b.createdAt - a.createdAt
        case 'updated':
          return b.updatedAt - a.updatedAt
        case 'executions':
          return b.executionCount - a.executionCount
        default:
          return 0
      }
    })

  const handleCreateScript = async () => {
    try {
      await createScript({
        name: 'New Script',
        description: 'A new script created from the dashboard',
        code: '// Write your script here\nconsole.log("Hello, ScriptFlow!");',
        matches: ['<all_urls>']
      })
    } catch (error) {
      console.error('Failed to create script:', error)
    }
  }

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

  if (loading) {
    return (
      <div className="scripts-page">
        <div className="loading">
          <div className="spinner" />
          <p>Loading scripts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="scripts-page">
      <div className="scripts-header">
        <div className="scripts-title">
          <h2>Scripts</h2>
          <p>Manage your userscripts</p>
        </div>
        
        <button className="create-button" onClick={handleCreateScript}>
          <Plus size={16} />
          New Script
        </button>
      </div>

      <div className="scripts-controls">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search scripts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-controls">
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">All Scripts</option>
            <option value="enabled">Enabled Only</option>
            <option value="disabled">Disabled Only</option>
          </select>

          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as any)}
            className="sort-select"
          >
            <option value="name">Sort by Name</option>
            <option value="created">Sort by Created</option>
            <option value="updated">Sort by Updated</option>
            <option value="executions">Sort by Executions</option>
          </select>
        </div>
      </div>

      <div className="scripts-content">
        {filteredScripts.length === 0 ? (
          <div className="empty-state">
            <Code size={48} />
            <h3>No scripts found</h3>
            <p>Create your first script to get started</p>
            <button className="create-button" onClick={handleCreateScript}>
              <Plus size={16} />
              Create Script
            </button>
          </div>
        ) : (
          <div className="scripts-grid">
            {filteredScripts.map(script => (
              <div key={script.id} className="script-card">
                <div className="script-card-header">
                  <div className="script-info">
                    <h3 className="script-name">{script.name}</h3>
                    <p className="script-description">{script.description || 'No description'}</p>
                  </div>
                  
                  <div className="script-actions">
                    <button
                      className={`action-button ${script.enabled ? 'enabled' : 'disabled'}`}
                      onClick={() => handleToggleScript(script)}
                      title={script.enabled ? 'Disable' : 'Enable'}
                    >
                      {script.enabled ? <Play size={14} /> : <Pause size={14} />}
                    </button>
                    
                    <button
                      className="action-button"
                      onClick={() => {/* TODO: Open editor */}}
                      title="Edit"
                    >
                      <Edit size={14} />
                    </button>
                    
                    <button
                      className="action-button danger"
                      onClick={() => handleDeleteScript(script)}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="script-card-content">
                  <div className="script-meta">
                    <span className="script-version">v{script.version}</span>
                    {script.author && <span className="script-author">by {script.author}</span>}
                    <span className="script-executions">{script.executionCount} executions</span>
                  </div>
                  
                  <div className="script-matches">
                    <strong>Matches:</strong> {script.matches.join(', ')}
                  </div>
                  
                  <div className="script-dates">
                    <span>Created: {new Date(script.createdAt).toLocaleDateString()}</span>
                    <span>Updated: {new Date(script.updatedAt).toLocaleDateString()}</span>
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