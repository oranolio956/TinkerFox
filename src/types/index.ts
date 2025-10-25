/**
 * ScriptFlow Type Definitions
 * 
 * Central type definitions for the entire extension
 */

// Core Script Types
export interface Script {
  id: string
  name: string
  description?: string
  version: string
  author?: string
  homepage?: string
  license?: string
  
  // Execution settings
  enabled: boolean
  runAt: 'document_start' | 'document_end' | 'document_idle'
  world: 'MAIN' | 'ISOLATED'
  
  // Matching rules
  matches: string[]
  excludeMatches?: string[]
  
  // Script content
  code: string
  language: 'javascript' | 'typescript'
  
  // Metadata
  createdAt: number
  updatedAt: number
  lastExecuted?: number
  executionCount: number
  
  // AI features
  aiGenerated?: boolean
  aiPrompt?: string
  aiConfidence?: number
  
  // Dependencies
  requires?: string[]
  grants?: string[]
  
  // Storage
  storage?: Record<string, any>
}

// Script Execution
export interface ScriptExecutionResult {
  scriptId: string
  tabId: number
  success: boolean
  error?: string
  executionTime: number
  timestamp: number
  output?: any
}

// Tab Management
export interface TabInfo {
  id: number
  url: string
  title: string
  active: boolean
  scriptFlowEnabled: boolean
  lastScriptExecution?: number
}

// Storage Types
export interface StorageData {
  scripts: Script[]
  settings: ExtensionSettings
  executionHistory: ScriptExecutionResult[]
  tabStates: Record<number, TabInfo>
  aiConfig?: AIConfig
}

export interface ExtensionSettings {
  // General
  autoInject: boolean
  showNotifications: boolean
  enableLogging: boolean
  logLevel: 'error' | 'warn' | 'info' | 'debug'
  
  // Script execution
  maxConcurrentScripts: number
  scriptTimeout: number
  enableCSP: boolean
  
  // UI
  theme: 'light' | 'dark' | 'auto'
  popupSize: 'small' | 'medium' | 'large'
  showExecutionTime: boolean
  
  // AI features
  enableAI: boolean
  aiProvider: 'openai' | 'anthropic' | 'local'
  aiApiKey?: string
  aiModel?: string
  
  // Security
  allowEval: boolean
  allowInlineScripts: boolean
  sandboxMode: boolean
}

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'local'
  apiKey?: string
  model: string
  temperature: number
  maxTokens: number
  systemPrompt: string
}

// Message Types
export interface Message {
  type: string
  payload?: any
  requestId?: string
}

export interface ScriptMessage extends Message {
  type: 'SCRIPT_EXECUTE' | 'SCRIPT_RESULT' | 'SCRIPT_ERROR'
  scriptId: string
  tabId: number
}

export interface StorageMessage extends Message {
  type: 'STORAGE_GET' | 'STORAGE_SET' | 'STORAGE_DELETE' | 'STORAGE_CLEAR'
  key?: string
  value?: any
}

export interface TabMessage extends Message {
  type: 'TAB_GET' | 'TAB_UPDATE' | 'TAB_SCRIPT_INJECT'
  tabId?: number
  data?: any
}

// Monaco Editor Types
export interface EditorConfig {
  theme: 'vs' | 'vs-dark' | 'hc-black'
  language: 'javascript' | 'typescript'
  fontSize: number
  tabSize: number
  wordWrap: 'off' | 'on' | 'wordWrapColumn' | 'bounded'
  minimap: boolean
  lineNumbers: 'on' | 'off' | 'relative' | 'interval'
  folding: boolean
  autoIndent: 'none' | 'keep' | 'brackets' | 'advanced' | 'full'
}

// Error Types
export class ScriptFlowError extends Error {
  constructor(
    message: string,
    public code: string,
    public scriptId?: string,
    public tabId?: number
  ) {
    super(message)
    this.name = 'ScriptFlowError'
  }
}

// Event Types
export interface ScriptEvent {
  type: 'created' | 'updated' | 'deleted' | 'enabled' | 'disabled' | 'executed'
  script: Script
  timestamp: number
}

export interface TabEvent {
  type: 'created' | 'updated' | 'activated' | 'closed'
  tab: TabInfo
  timestamp: number
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: number
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type ScriptStatus = 'enabled' | 'disabled' | 'error' | 'running'

export type ExecutionMode = 'immediate' | 'scheduled' | 'conditional'

// Constants
export const SCRIPT_STORAGE_KEY = 'scriptflow_scripts'
export const SETTINGS_STORAGE_KEY = 'scriptflow_settings'
export const EXECUTION_HISTORY_KEY = 'scriptflow_execution_history'
export const TAB_STATES_KEY = 'scriptflow_tab_states'

export const DEFAULT_SETTINGS: ExtensionSettings = {
  autoInject: true,
  showNotifications: true,
  enableLogging: true,
  logLevel: 'info',
  maxConcurrentScripts: 10,
  scriptTimeout: 30000,
  enableCSP: true,
  theme: 'auto',
  popupSize: 'medium',
  showExecutionTime: true,
  enableAI: false,
  aiProvider: 'openai',
  allowEval: false,
  allowInlineScripts: false,
  sandboxMode: true
}

export const SUPPORTED_LANGUAGES = ['javascript', 'typescript'] as const
export const SUPPORTED_RUN_AT = ['document_start', 'document_end', 'document_idle'] as const
export const SUPPORTED_WORLDS = ['MAIN', 'ISOLATED'] as const