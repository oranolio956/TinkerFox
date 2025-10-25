/**
 * Feature Gating System for ScriptFlow
 * 
 * Provides centralized feature toggles and capability management.
 * All experimental or optional features must be behind a toggle in the settings.
 * 
 * @fileoverview Production-grade feature gating with type safety and validation
 */

import { Logger } from './logger';
import { StorageManager } from './storage-manager';
import type { ExtensionSettings } from '../types';

/**
 * Feature identifiers for type-safe feature toggling
 */
export const FEATURE_FLAGS = {
  // Core features
  SCRIPT_SCHEDULING: 'script_scheduling',
  AI_ASSISTANT: 'ai_assistant',
  IMPORT_EXPORT: 'import_export',
  CUSTOM_EVENTS: 'custom_events',
  
  // Advanced features
  ADVANCED_LOGGING: 'advanced_logging',
  REMOTE_SYNC: 'remote_sync',
  SCRIPT_ANALYTICS: 'script_analytics',
  PERFORMANCE_MONITORING: 'performance_monitoring',
  
  // Experimental features
  BETA_UI: 'beta_ui',
  EXPERIMENTAL_APIS: 'experimental_apis',
  DEBUG_MODE: 'debug_mode',
  
  // Security features
  STRICT_CSP: 'strict_csp',
  SANDBOX_SCRIPTS: 'sandbox_scripts',
  CONTENT_SECURITY: 'content_security',
} as const;

/**
 * Feature categories for organization and UI grouping
 */
export const FEATURE_CATEGORIES = {
  CORE: 'core',
  ADVANCED: 'advanced',
  EXPERIMENTAL: 'experimental',
  SECURITY: 'security',
} as const;

/**
 * Feature configuration interface
 */
export interface FeatureConfig {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly enabled: boolean;
  readonly experimental: boolean;
  readonly requiresRestart: boolean;
  readonly dependencies: readonly string[];
  readonly conflicts: readonly string[];
  readonly minVersion?: string;
  readonly maxVersion?: string;
  readonly settings: readonly FeatureSetting[];
}

/**
 * Feature setting definition
 */
export interface FeatureSetting {
  readonly key: string;
  readonly type: 'boolean' | 'string' | 'number' | 'select';
  readonly label: string;
  readonly description: string;
  readonly defaultValue: unknown;
  readonly options?: readonly { value: unknown; label: string }[];
  readonly validation?: (value: unknown) => boolean;
}

/**
 * Feature state for runtime management
 */
export interface FeatureState {
  readonly enabled: boolean;
  readonly lastModified: number;
  readonly modifiedBy: 'user' | 'system' | 'migration';
  readonly metadata: Record<string, unknown>;
}

/**
 * Feature dependency resolution result
 */
export interface DependencyResult {
  readonly canEnable: boolean;
  readonly missingDependencies: readonly string[];
  readonly conflictingFeatures: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Feature manager class for centralized feature control
 */
export class FeatureManager {
  private static instance: FeatureManager | null = null;
  private readonly logger: Logger;
  private readonly storage: StorageManager;
  private readonly features: Map<string, FeatureConfig>;
  private readonly states: Map<string, FeatureState>;
  private readonly listeners: Map<string, Set<(enabled: boolean) => void>>;

  private constructor() {
    this.logger = new Logger('FeatureManager');
    this.storage = StorageManager.getInstance();
    this.features = new Map();
    this.states = new Map();
    this.listeners = new Map();
    
    this.initializeFeatures();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): FeatureManager {
    if (!FeatureManager.instance) {
      FeatureManager.instance = new FeatureManager();
    }
    return FeatureManager.instance;
  }

  /**
   * Initialize all feature definitions
   */
  private initializeFeatures(): void {
    const featureConfigs: FeatureConfig[] = [
      {
        id: FEATURE_FLAGS.SCRIPT_SCHEDULING,
        name: 'Script Scheduling',
        description: 'Advanced script scheduling with time-based and event-driven execution',
        category: FEATURE_CATEGORIES.CORE,
        enabled: true,
        experimental: false,
        requiresRestart: false,
        dependencies: [],
        conflicts: [],
        settings: [
          {
            key: 'maxConcurrentSchedules',
            type: 'number',
            label: 'Max Concurrent Schedules',
            description: 'Maximum number of schedules that can run simultaneously',
            defaultValue: 10,
            validation: (value) => typeof value === 'number' && value > 0 && value <= 100,
          },
          {
            key: 'scheduleRetryAttempts',
            type: 'number',
            label: 'Retry Attempts',
            description: 'Number of retry attempts for failed schedule executions',
            defaultValue: 3,
            validation: (value) => typeof value === 'number' && value >= 0 && value <= 10,
          },
        ],
      },
      {
        id: FEATURE_FLAGS.AI_ASSISTANT,
        name: 'AI Assistant',
        description: 'AI-powered script suggestions and code refactoring',
        category: FEATURE_CATEGORIES.ADVANCED,
        enabled: false,
        experimental: true,
        requiresRestart: true,
        dependencies: [],
        conflicts: [],
        settings: [
          {
            key: 'aiProvider',
            type: 'select',
            label: 'AI Provider',
            description: 'Choose the AI service provider',
            defaultValue: 'openai',
            options: [
              { value: 'openai', label: 'OpenAI' },
              { value: 'anthropic', label: 'Anthropic' },
              { value: 'local', label: 'Local Model' },
            ],
          },
          {
            key: 'aiApiKey',
            type: 'string',
            label: 'API Key',
            description: 'API key for the selected AI provider',
            defaultValue: '',
            validation: (value) => typeof value === 'string' && value.length > 0,
          },
        ],
      },
      {
        id: FEATURE_FLAGS.IMPORT_EXPORT,
        name: 'Import/Export',
        description: 'Import and export scripts with full schema validation',
        category: FEATURE_CATEGORIES.CORE,
        enabled: true,
        experimental: false,
        requiresRestart: false,
        dependencies: [],
        conflicts: [],
        settings: [
          {
            key: 'exportFormat',
            type: 'select',
            label: 'Default Export Format',
            description: 'Default format for script exports',
            defaultValue: 'json',
            options: [
              { value: 'json', label: 'JSON' },
              { value: 'yaml', label: 'YAML' },
              { value: 'zip', label: 'ZIP Archive' },
            ],
          },
          {
            key: 'includeMetadata',
            type: 'boolean',
            label: 'Include Metadata',
            description: 'Include script metadata in exports',
            defaultValue: true,
          },
        ],
      },
      {
        id: FEATURE_FLAGS.CUSTOM_EVENTS,
        name: 'Custom Events',
        description: 'Custom event triggers and rules engine for advanced automation',
        category: FEATURE_CATEGORIES.ADVANCED,
        enabled: false,
        experimental: true,
        requiresRestart: false,
        dependencies: [FEATURE_FLAGS.SCRIPT_SCHEDULING],
        conflicts: [],
        settings: [
          {
            key: 'maxEventListeners',
            type: 'number',
            label: 'Max Event Listeners',
            description: 'Maximum number of custom event listeners',
            defaultValue: 50,
            validation: (value) => typeof value === 'number' && value > 0 && value <= 200,
          },
        ],
      },
      {
        id: FEATURE_FLAGS.ADVANCED_LOGGING,
        name: 'Advanced Logging',
        description: 'Enhanced logging with remote endpoints and structured data',
        category: FEATURE_CATEGORIES.ADVANCED,
        enabled: false,
        experimental: false,
        requiresRestart: false,
        dependencies: [],
        conflicts: [],
        settings: [
          {
            key: 'logLevel',
            type: 'select',
            label: 'Log Level',
            description: 'Minimum log level to capture',
            defaultValue: 'info',
            options: [
              { value: 'debug', label: 'Debug' },
              { value: 'info', label: 'Info' },
              { value: 'warn', label: 'Warning' },
              { value: 'error', label: 'Error' },
            ],
          },
          {
            key: 'remoteLogging',
            type: 'boolean',
            label: 'Remote Logging',
            description: 'Send logs to remote endpoint',
            defaultValue: false,
          },
          {
            key: 'logRetentionDays',
            type: 'number',
            label: 'Log Retention (Days)',
            description: 'Number of days to keep logs',
            defaultValue: 30,
            validation: (value) => typeof value === 'number' && value > 0 && value <= 365,
          },
        ],
      },
      {
        id: FEATURE_FLAGS.DEBUG_MODE,
        name: 'Debug Mode',
        description: 'Enhanced debugging capabilities and development tools',
        category: FEATURE_CATEGORIES.EXPERIMENTAL,
        enabled: false,
        experimental: true,
        requiresRestart: true,
        dependencies: [FEATURE_FLAGS.ADVANCED_LOGGING],
        conflicts: [],
        settings: [
          {
            key: 'verboseLogging',
            type: 'boolean',
            label: 'Verbose Logging',
            description: 'Enable verbose logging for debugging',
            defaultValue: false,
          },
          {
            key: 'performanceProfiling',
            type: 'boolean',
            label: 'Performance Profiling',
            description: 'Enable performance profiling',
            defaultValue: false,
          },
        ],
      },
    ];

    // Register all features
    for (const config of featureConfigs) {
      this.features.set(config.id, config);
      this.states.set(config.id, {
        enabled: config.enabled,
        lastModified: Date.now(),
        modifiedBy: 'system',
        metadata: {},
      });
    }

    this.logger.info('Feature definitions initialized', { 
      featureCount: this.features.size 
    });
  }

  /**
   * Check if a feature is enabled
   */
  public isFeatureEnabled(featureId: string): boolean {
    const state = this.states.get(featureId);
    if (!state) {
      this.logger.warn('Feature not found', { featureId });
      return false;
    }
    return state.enabled;
  }

  /**
   * Get feature configuration
   */
  public getFeatureConfig(featureId: string): FeatureConfig | null {
    return this.features.get(featureId) || null;
  }

  /**
   * Get all features by category
   */
  public getFeaturesByCategory(category: string): FeatureConfig[] {
    return Array.from(this.features.values())
      .filter(feature => feature.category === category);
  }

  /**
   * Get all available features
   */
  public getAllFeatures(): FeatureConfig[] {
    return Array.from(this.features.values());
  }

  /**
   * Enable a feature with dependency resolution
   */
  public async enableFeature(featureId: string): Promise<boolean> {
    try {
      const dependencyResult = this.checkDependencies(featureId, true);
      if (!dependencyResult.canEnable) {
        this.logger.error('Cannot enable feature due to dependencies', {
          featureId,
          missingDependencies: dependencyResult.missingDependencies,
          conflictingFeatures: dependencyResult.conflictingFeatures,
        });
        return false;
      }

      const feature = this.features.get(featureId);
      if (!feature) {
        this.logger.error('Feature not found', { featureId });
        return false;
      }

      // Update state
      this.states.set(featureId, {
        enabled: true,
        lastModified: Date.now(),
        modifiedBy: 'user',
        metadata: this.states.get(featureId)?.metadata || {},
      });

      // Save to storage
      await this.saveFeatureStates();

      // Notify listeners
      this.notifyListeners(featureId, true);

      this.logger.info('Feature enabled', { featureId });
      return true;
    } catch (error) {
      this.logger.error('Failed to enable feature', { featureId, error });
      return false;
    }
  }

  /**
   * Disable a feature
   */
  public async disableFeature(featureId: string): Promise<boolean> {
    try {
      const feature = this.features.get(featureId);
      if (!feature) {
        this.logger.error('Feature not found', { featureId });
        return false;
      }

      // Check for dependent features
      const dependentFeatures = this.getDependentFeatures(featureId);
      if (dependentFeatures.length > 0) {
        this.logger.warn('Cannot disable feature with dependents', {
          featureId,
          dependentFeatures,
        });
        return false;
      }

      // Update state
      this.states.set(featureId, {
        enabled: false,
        lastModified: Date.now(),
        modifiedBy: 'user',
        metadata: this.states.get(featureId)?.metadata || {},
      });

      // Save to storage
      await this.saveFeatureStates();

      // Notify listeners
      this.notifyListeners(featureId, false);

      this.logger.info('Feature disabled', { featureId });
      return true;
    } catch (error) {
      this.logger.error('Failed to disable feature', { featureId, error });
      return false;
    }
  }

  /**
   * Check feature dependencies and conflicts
   */
  public checkDependencies(featureId: string, enable: boolean): DependencyResult {
    const feature = this.features.get(featureId);
    if (!feature) {
      return {
        canEnable: false,
        missingDependencies: [featureId],
        conflictingFeatures: [],
        warnings: ['Feature not found'],
      };
    }

    const missingDependencies: string[] = [];
    const conflictingFeatures: string[] = [];
    const warnings: string[] = [];

    if (enable) {
      // Check dependencies
      for (const depId of feature.dependencies) {
        if (!this.isFeatureEnabled(depId)) {
          missingDependencies.push(depId);
        }
      }

      // Check conflicts
      for (const conflictId of feature.conflicts) {
        if (this.isFeatureEnabled(conflictId)) {
          conflictingFeatures.push(conflictId);
        }
      }

      // Check version constraints
      if (feature.minVersion || feature.maxVersion) {
        warnings.push('Version constraints not implemented yet');
      }
    } else {
      // Check for dependent features
      const dependents = this.getDependentFeatures(featureId);
      if (dependents.length > 0) {
        warnings.push(`Disabling this feature will also disable: ${dependents.join(', ')}`);
      }
    }

    const canEnable = enable 
      ? missingDependencies.length === 0 && conflictingFeatures.length === 0
      : true;

    return {
      canEnable,
      missingDependencies,
      conflictingFeatures,
      warnings,
    };
  }

  /**
   * Get features that depend on the given feature
   */
  private getDependentFeatures(featureId: string): string[] {
    const dependents: string[] = [];
    
    for (const [id, feature] of this.features) {
      if (feature.dependencies.includes(featureId) && this.isFeatureEnabled(id)) {
        dependents.push(id);
      }
    }
    
    return dependents;
  }

  /**
   * Subscribe to feature state changes
   */
  public subscribeToFeature(featureId: string, callback: (enabled: boolean) => void): () => void {
    if (!this.listeners.has(featureId)) {
      this.listeners.set(featureId, new Set());
    }
    
    this.listeners.get(featureId)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(featureId);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(featureId);
        }
      }
    };
  }

  /**
   * Notify listeners of feature state changes
   */
  private notifyListeners(featureId: string, enabled: boolean): void {
    const listeners = this.listeners.get(featureId);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(enabled);
        } catch (error) {
          this.logger.error('Error in feature listener', { featureId, error });
        }
      }
    }
  }

  /**
   * Save feature states to storage
   */
  private async saveFeatureStates(): Promise<void> {
    try {
      const statesObject: Record<string, FeatureState> = {};
      for (const [id, state] of this.states) {
        statesObject[id] = state;
      }
      
      await this.storage.set('featureStates', statesObject);
    } catch (error) {
      this.logger.error('Failed to save feature states', { error });
    }
  }

  /**
   * Load feature states from storage
   */
  public async loadFeatureStates(): Promise<void> {
    try {
      const storedStates = await this.storage.get<Record<string, FeatureState>>('featureStates');
      if (storedStates) {
        for (const [id, state] of Object.entries(storedStates)) {
          if (this.features.has(id)) {
            this.states.set(id, state);
          }
        }
        this.logger.info('Feature states loaded from storage');
      }
    } catch (error) {
      this.logger.error('Failed to load feature states', { error });
    }
  }

  /**
   * Reset all features to default state
   */
  public async resetToDefaults(): Promise<void> {
    try {
      for (const [id, feature] of this.features) {
        this.states.set(id, {
          enabled: feature.enabled,
          lastModified: Date.now(),
          modifiedBy: 'system',
          metadata: {},
        });
      }
      
      await this.saveFeatureStates();
      this.logger.info('Features reset to defaults');
    } catch (error) {
      this.logger.error('Failed to reset features', { error });
    }
  }

  /**
   * Get feature statistics
   */
  public getFeatureStats(): {
    total: number;
    enabled: number;
    disabled: number;
    experimental: number;
    byCategory: Record<string, number>;
  } {
    const total = this.features.size;
    let enabled = 0;
    let disabled = 0;
    let experimental = 0;
    const byCategory: Record<string, number> = {};

    for (const feature of this.features.values()) {
      if (this.isFeatureEnabled(feature.id)) {
        enabled++;
      } else {
        disabled++;
      }

      if (feature.experimental) {
        experimental++;
      }

      byCategory[feature.category] = (byCategory[feature.category] || 0) + 1;
    }

    return {
      total,
      enabled,
      disabled,
      experimental,
      byCategory,
    };
  }
}

// Export singleton instance
export const featureManager = FeatureManager.getInstance();

// Export convenience functions
export const isFeatureEnabled = (featureId: string): boolean => 
  featureManager.isFeatureEnabled(featureId);

export const enableFeature = (featureId: string): Promise<boolean> => 
  featureManager.enableFeature(featureId);

export const disableFeature = (featureId: string): Promise<boolean> => 
  featureManager.disableFeature(featureId);

export const getFeatureConfig = (featureId: string): FeatureConfig | null => 
  featureManager.getFeatureConfig(featureId);

export const subscribeToFeature = (featureId: string, callback: (enabled: boolean) => void): (() => void) => 
  featureManager.subscribeToFeature(featureId, callback);