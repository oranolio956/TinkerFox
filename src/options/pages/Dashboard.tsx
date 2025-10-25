/**
 * ScriptFlow Dashboard Page
 * 
 * Main dashboard with statistics and overview
 */

import React, { useState, useEffect } from 'react'
import { Activity, Code, Play, Clock, Zap } from 'lucide-react'
import { useScriptStore } from '../../popup/hooks/useScriptStore'
import { useSettingsStore } from '../../popup/hooks/useSettingsStore'

export function Dashboard(): JSX.Element {
  const { scripts, loading } = useScriptStore()
  const { settings } = useSettingsStore()
  const [stats, setStats] = useState({
    totalScripts: 0,
    activeScripts: 0,
    totalExecutions: 0,
    lastExecution: null as Date | null
  })

  useEffect(() => {
    if (scripts.length > 0) {
      const totalExecutions = scripts.reduce((sum, script) => sum + script.executionCount, 0)
      const lastExecution = scripts
        .filter(s => s.lastExecuted)
        .sort((a, b) => (b.lastExecuted || 0) - (a.lastExecuted || 0))[0]
      
      setStats({
        totalScripts: scripts.length,
        activeScripts: scripts.filter(s => s.enabled).length,
        totalExecutions,
        lastExecution: lastExecution?.lastExecuted ? new Date(lastExecution.lastExecuted) : null
      })
    }
  }, [scripts])

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">
          <div className="spinner" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        <p>Overview of your ScriptFlow activity</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <Code size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.totalScripts}</h3>
            <p>Total Scripts</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon active">
            <Play size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.activeScripts}</h3>
            <p>Active Scripts</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Activity size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.totalExecutions}</h3>
            <p>Total Executions</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <h3>
              {stats.lastExecution 
                ? stats.lastExecution.toLocaleDateString()
                : 'Never'
              }
            </h3>
            <p>Last Execution</p>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="dashboard-section">
          <h3>Recent Activity</h3>
          <div className="activity-placeholder">
            <Activity size={48} />
            <p>Recent activity will appear here</p>
          </div>
        </div>

        <div className="dashboard-section">
          <h3>Quick Actions</h3>
          <div className="quick-actions">
            <button className="action-button primary">
              <Code size={16} />
              Create New Script
            </button>
            <button className="action-button">
              <Zap size={16} />
              Import Scripts
            </button>
            <button className="action-button">
              <Settings size={16} />
              Configure Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}