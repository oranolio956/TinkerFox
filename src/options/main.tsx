/**
 * ScriptFlow Options Main Entry Point
 * 
 * React application for the extension options/dashboard page
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { OptionsApp } from './OptionsApp'
import './styles/globals.css'

// Initialize React app
const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>
)