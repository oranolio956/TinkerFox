export interface UserScript {
  id: string;                    // nanoid() unique ID
  name: string;                  // From @name metadata
  code: string;                  // Full script source
  metadata: ScriptMetadata;
  enabled: boolean;
  createdAt: number;             // Unix timestamp
  updatedAt: number;
  lastRunAt: number | null;
  runCount: number;
  version: string;               // From @version
  updateUrl: string | null;      // From @updateURL
  downloadUrl: string | null;    // From @downloadURL
  tags: string[];                // User-defined tags
  category: string;              // Script category
}

export interface ScriptMetadata {
  name: string;
  namespace?: string;
  version: string;
  description?: string;
  author?: string;
  match: string[];               // @match patterns
  include: string[];             // @include patterns  
  exclude: string[];             // @exclude patterns
  require: string[];             // External libraries
  grant: string[];               // GM_* APIs needed
  runAt: 'document-start' | 'document-end' | 'document-idle';
  noframes: boolean;             // Don't run in iframes
  updateURL?: string;            // @updateURL
  downloadURL?: string;          // @downloadURL
  icon?: string;                 // @icon
  homepageURL?: string;          // @homepageURL
  supportURL?: string;           // @supportURL
}

export interface ScriptVersion {
  id: string;
  scriptId: string;              // Foreign key to UserScript
  version: string;
  code: string;
  createdAt: number;
  changeLog?: string;
}

export interface ScriptExecution {
  id: string;
  scriptId: string;
  url: string;
  success: boolean;
  error?: string;
  executionTime: number;         // Milliseconds
  timestamp: number;
}

export interface Settings {
  id: 'global';                  // Only one settings object
  autoUpdate: boolean;
  updateInterval: number;        // Hours between update checks
  theme: 'light' | 'dark' | 'auto';
  editorFontSize: number;
  githubSyncEnabled: boolean;
  githubToken?: string;
  githubRepo?: string;
}

export interface ScriptAnalytics {
  id: number;                    // Auto-increment ID
  scriptId: string;              // Foreign key to UserScript
  metric: string;                // Metric name (execution_time, memory_usage, etc.)
  value: number;                 // Metric value
  timestamp: number;             // When metric was recorded
  metadata?: Record<string, any>; // Additional metric data
}

export interface Command {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  shortcut?: string;
  category: string;
}