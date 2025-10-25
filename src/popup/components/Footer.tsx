/**
 * ScriptFlow Popup Footer Component
 * 
 * Footer with status and quick actions
 */

import React from 'react'
import { Activity, Settings } from 'lucide-react'

export function Footer(): JSX.Element {
  return (
    <footer className="footer">
      <div className="footer-left">
        <Activity size={14} />
        <span className="footer-text">ScriptFlow Active</span>
      </div>
      
      <div className="footer-right">
        <button 
          className="footer-button"
          onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('dist/options/index.html') })}
          title="Open Dashboard"
        >
          <Settings size={14} />
        </button>
      </div>
    </footer>
  )
}