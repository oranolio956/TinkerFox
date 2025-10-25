/**
 * ScriptFlow Options Header Component
 * 
 * Header for the options page with title and actions
 */

import React from 'react'
import { Code, Settings, ExternalLink } from 'lucide-react'

export function Header(): JSX.Element {
  return (
    <header className="options-header">
      <div className="header-content">
        <div className="header-left">
          <Code className="header-icon" size={24} />
          <div className="header-text">
            <h1 className="header-title">ScriptFlow Dashboard</h1>
            <p className="header-subtitle">Advanced userscript management with AI features</p>
          </div>
        </div>
        
        <div className="header-actions">
          <button 
            className="header-button"
            onClick={() => chrome.tabs.create({ url: 'https://github.com/scriptflow' })}
            title="View on GitHub"
          >
            <ExternalLink size={16} />
            GitHub
          </button>
          
          <button 
            className="header-button"
            onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('dist/popup/index.html') })}
            title="Open Popup"
          >
            <Settings size={16} />
            Popup
          </button>
        </div>
      </div>
    </header>
  )
}