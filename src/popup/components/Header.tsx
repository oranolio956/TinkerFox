/**
 * ScriptFlow Popup Header Component
 * 
 * Header with title, settings, and new script button
 */

// import React from 'react'
import { Settings, Plus, Code, Clock } from 'lucide-react'

interface HeaderProps {
  onSettingsClick: () => void
  onNewScriptClick: () => void
  onSchedulingClick: () => void
}

export function Header({ onSettingsClick, onNewScriptClick, onSchedulingClick }: HeaderProps): JSX.Element {
  return (
    <header className="header">
      <div className="header-left">
        <Code className="header-icon" size={20} />
        <h1 className="header-title">ScriptFlow</h1>
      </div>
      
      <div className="header-actions">
        <button 
          className="header-button"
          onClick={onNewScriptClick}
          title="New Script"
        >
          <Plus size={16} />
        </button>
        
        <button 
          className="header-button"
          onClick={onSchedulingClick}
          title="Scheduling"
        >
          <Clock size={16} />
        </button>
        
        <button 
          className="header-button"
          onClick={onSettingsClick}
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  )
}