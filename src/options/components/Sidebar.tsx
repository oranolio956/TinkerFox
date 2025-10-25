/**
 * ScriptFlow Options Sidebar Component
 * 
 * Navigation sidebar for the options page
 */

import React from 'react'
import { BarChart3, Code, Settings, HelpCircle, Zap } from 'lucide-react'

interface SidebarProps {
  currentPage: string
  onPageChange: (page: 'dashboard' | 'scripts' | 'settings' | 'features' | 'help') => void
}

export function Sidebar({ currentPage, onPageChange }: SidebarProps): JSX.Element {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'scripts', label: 'Scripts', icon: Code },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'features', label: 'Features', icon: Zap },
    { id: 'help', label: 'Help', icon: HelpCircle }
  ]

  return (
    <aside className="options-sidebar">
      <nav className="sidebar-nav">
        {menuItems.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={`sidebar-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => onPageChange(item.id as any)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}