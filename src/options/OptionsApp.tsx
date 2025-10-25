/**
 * ScriptFlow Options App Component
 * 
 * Main dashboard application for the options page
 */

import React, { useState } from 'react'
import { Dashboard } from './pages/Dashboard'
import { ScriptsPage } from './pages/ScriptsPage'
import { SettingsPage } from './pages/SettingsPage'
import { FeatureSettingsPage } from './pages/FeatureSettingsPage'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'

type Page = 'dashboard' | 'scripts' | 'settings' | 'features' | 'help'

export function OptionsApp(): JSX.Element {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />
      case 'scripts':
        return <ScriptsPage />
      case 'settings':
        return <SettingsPage />
      case 'features':
        return <FeatureSettingsPage />
      case 'help':
        return <div className="help-placeholder">Help page coming soon...</div>
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="options-app">
      <Header />
      
      <div className="options-layout">
        <Sidebar 
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
        
        <main className="options-main">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}