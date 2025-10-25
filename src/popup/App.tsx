/**
 * ScriptFlow Popup Main App Component
 * 
 * Main application component for the popup interface
 */

import React, { useState, useEffect } from 'react'
import { ScriptList } from './components/ScriptList'
import { ScriptEditor } from './components/ScriptEditor'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { useScriptStore } from './hooks/useScriptStore'
import { useSettingsStore } from './hooks/useSettingsStore'
import type { Script } from '@/types'

export function App(): JSX.Element {
  const [activeView, setActiveView] = useState<'list' | 'editor' | 'settings'>('list')
  const [selectedScript, setSelectedScript] = useState<Script | null>(null)
  
  const { scripts, loading, error } = useScriptStore()
  const { settings } = useSettingsStore()

  // Load initial data
  useEffect(() => {
    // Scripts and settings are loaded by their respective stores
  }, [])

  const handleScriptSelect = (script: Script) => {
    setSelectedScript(script)
    setActiveView('editor')
  }

  const handleScriptCreate = () => {
    setSelectedScript(null)
    setActiveView('editor')
  }

  const handleBackToList = () => {
    setSelectedScript(null)
    setActiveView('list')
  }

  const handleScriptSave = (script: Script) => {
    // Script saving is handled by the store
    setActiveView('list')
  }

  if (loading) {
    return (
      <div className="app">
        <Header />
        <div className="loading">
          <div className="spinner" />
          <p>Loading ScriptFlow...</p>
        </div>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className="app">
        <Header />
        <div className="error">
          <p>Error loading ScriptFlow: {error}</p>
          <button onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="app">
      <Header 
        onSettingsClick={() => setActiveView('settings')}
        onNewScriptClick={handleScriptCreate}
      />
      
      <main className="main-content">
        {activeView === 'list' && (
          <ScriptList
            scripts={scripts}
            onScriptSelect={handleScriptSelect}
            onScriptCreate={handleScriptCreate}
          />
        )}
        
        {activeView === 'editor' && (
          <ScriptEditor
            script={selectedScript}
            onSave={handleScriptSave}
            onCancel={handleBackToList}
          />
        )}
        
        {activeView === 'settings' && (
          <div className="settings-placeholder">
            <h2>Settings</h2>
            <p>Settings panel coming soon...</p>
            <button onClick={() => setActiveView('list')}>
              Back to Scripts
            </button>
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  )
}