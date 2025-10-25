/**
 * ScriptFlow Popup Main Entry Point
 * 
 * React application for the extension popup
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles/globals.css'

// Initialize React app
const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)