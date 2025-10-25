/**
 * Feature Settings Page
 * 
 * Provides comprehensive feature management interface with toggles,
 * configuration options, and dependency management.
 * 
 * @fileoverview Production-grade feature settings with validation and safety
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Toggle, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Info, 
  RefreshCw,
  Shield,
  Zap,
  Experiment,
  Lock
} from 'lucide-react';
import { featureManager, FEATURE_FLAGS, FEATURE_CATEGORIES } from '../../lib/features';
import type { FeatureConfig, FeatureState } from '../../lib/features';

/**
 * Feature Settings Page Props
 */
interface FeatureSettingsPageProps {
  className?: string;
}

/**
 * Feature Settings Page Component
 */
export const FeatureSettingsPage: React.FC<FeatureSettingsPageProps> = ({ className = '' }) => {
  const [features, setFeatures] = useState<FeatureConfig[]>([]);
  const [featureStates, setFeatureStates] = useState<Map<string, FeatureState>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showExperimental, setShowExperimental] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());

  // Load features and states
  useEffect(() => {
    loadFeatures();
  }, []);

  const loadFeatures = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load feature states from storage
      await featureManager.loadFeatureStates();

      // Get all features
      const allFeatures = featureManager.getAllFeatures();
      setFeatures(allFeatures);

      // Get current states
      const states = new Map<string, FeatureState>();
      for (const feature of allFeatures) {
        const state = {
          enabled: featureManager.isFeatureEnabled(feature.id),
          lastModified: Date.now(),
          modifiedBy: 'user' as const,
          metadata: {},
        };
        states.set(feature.id, state);
      }
      setFeatureStates(states);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load features');
    } finally {
      setLoading(false);
    }
  };

  // Handle feature toggle
  const handleFeatureToggle = async (featureId: string, enabled: boolean) => {
    try {
      setPendingChanges(prev => new Set(prev).add(featureId));

      const success = enabled 
        ? await featureManager.enableFeature(featureId)
        : await featureManager.disableFeature(featureId);

      if (success) {
        // Update local state
        setFeatureStates(prev => {
          const newStates = new Map(prev);
          const currentState = newStates.get(featureId);
          if (currentState) {
            newStates.set(featureId, {
              ...currentState,
              enabled,
              lastModified: Date.now(),
              modifiedBy: 'user',
            });
          }
          return newStates;
        });
      } else {
        setError(`Failed to ${enabled ? 'enable' : 'disable'} feature: ${featureId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle feature');
    } finally {
      setPendingChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(featureId);
        return newSet;
      });
    }
  };

  // Reset to defaults
  const handleResetToDefaults = async () => {
    if (window.confirm('Are you sure you want to reset all features to their default states? This will disable all custom settings.')) {
      try {
        setLoading(true);
        await featureManager.resetToDefaults();
        await loadFeatures();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reset features');
      } finally {
        setLoading(false);
      }
    }
  };

  // Get filtered features
  const getFilteredFeatures = (): FeatureConfig[] => {
    let filtered = features;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(feature => feature.category === selectedCategory);
    }

    // Filter experimental features
    if (!showExperimental) {
      filtered = filtered.filter(feature => !feature.experimental);
    }

    return filtered;
  };

  // Get category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case FEATURE_CATEGORIES.CORE:
        return <Settings className="w-4 h-4" />;
      case FEATURE_CATEGORIES.ADVANCED:
        return <Zap className="w-4 h-4" />;
      case FEATURE_CATEGORIES.EXPERIMENTAL:
        return <Experiment className="w-4 h-4" />;
      case FEATURE_CATEGORIES.SECURITY:
        return <Shield className="w-4 h-4" />;
      default:
        return <Settings className="w-4 h-4" />;
    }
  };

  // Get category name
  const getCategoryName = (category: string): string => {
    switch (category) {
      case FEATURE_CATEGORIES.CORE:
        return 'Core Features';
      case FEATURE_CATEGORIES.ADVANCED:
        return 'Advanced Features';
      case FEATURE_CATEGORIES.EXPERIMENTAL:
        return 'Experimental Features';
      case FEATURE_CATEGORIES.SECURITY:
        return 'Security Features';
      default:
        return 'Other Features';
    }
  };

  // Get feature status
  const getFeatureStatus = (feature: FeatureConfig) => {
    const state = featureStates.get(feature.id);
    const isEnabled = state?.enabled || false;
    const isPending = pendingChanges.has(feature.id);

    return {
      isEnabled,
      isPending,
      canToggle: !isPending,
    };
  };

  // Get dependency info
  const getDependencyInfo = (feature: FeatureConfig) => {
    const dependencyResult = featureManager.checkDependencies(feature.id, true);
    return dependencyResult;
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading features...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Feature Settings
          </h2>
          <p className="text-gray-600 mt-1">
            Manage extension features and capabilities
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleResetToDefaults}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            <RefreshCw className="w-4 h-4" />
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <XCircle className="w-5 h-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Category:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Categories</option>
              <option value={FEATURE_CATEGORIES.CORE}>Core Features</option>
              <option value={FEATURE_CATEGORIES.ADVANCED}>Advanced Features</option>
              <option value={FEATURE_CATEGORIES.EXPERIMENTAL}>Experimental Features</option>
              <option value={FEATURE_CATEGORIES.SECURITY}>Security Features</option>
            </select>
          </div>

          {/* Experimental Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showExperimental"
              checked={showExperimental}
              onChange={(e) => setShowExperimental(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="showExperimental" className="text-sm text-gray-700">
              Show experimental features
            </label>
          </div>
        </div>
      </div>

      {/* Features List */}
      <div className="space-y-4">
        {getFilteredFeatures().length === 0 ? (
          <div className="text-center py-12">
            <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Features Found</h3>
            <p className="text-gray-600">
              Try adjusting your filters or enable experimental features to see more options.
            </p>
          </div>
        ) : (
          getFilteredFeatures().map((feature) => {
            const status = getFeatureStatus(feature);
            const dependencyInfo = getDependencyInfo(feature);
            const categoryName = getCategoryName(feature.category);

            return (
              <div key={feature.id} className="bg-white border rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {feature.name}
                      </h3>
                      {feature.experimental && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <Experiment className="w-3 h-3" />
                          Experimental
                        </span>
                      )}
                      {feature.requiresRestart && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <RefreshCw className="w-3 h-3" />
                          Requires Restart
                        </span>
                      )}
                    </div>

                    <p className="text-gray-600 mb-3">{feature.description}</p>

                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        {getCategoryIcon(feature.category)}
                        {categoryName}
                      </div>
                      {feature.dependencies.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Lock className="w-4 h-4" />
                          {feature.dependencies.length} dependencies
                        </div>
                      )}
                    </div>

                    {/* Dependencies */}
                    {feature.dependencies.length > 0 && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-md">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Dependencies:</h4>
                        <div className="flex flex-wrap gap-2">
                          {feature.dependencies.map((depId) => {
                            const depFeature = features.find(f => f.id === depId);
                            const depEnabled = featureManager.isFeatureEnabled(depId);
                            return (
                              <span
                                key={depId}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                  depEnabled
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {depEnabled ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {depFeature?.name || depId}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Dependency Warnings */}
                    {!dependencyInfo.canEnable && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                        <div className="flex">
                          <AlertTriangle className="w-5 h-5 text-yellow-400" />
                          <div className="ml-3">
                            <h4 className="text-sm font-medium text-yellow-800">
                              Cannot Enable Feature
                            </h4>
                            <div className="mt-1 text-sm text-yellow-700">
                              {dependencyInfo.missingDependencies.length > 0 && (
                                <p>Missing dependencies: {dependencyInfo.missingDependencies.join(', ')}</p>
                              )}
                              {dependencyInfo.conflictingFeatures.length > 0 && (
                                <p>Conflicting features: {dependencyInfo.conflictingFeatures.join(', ')}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Feature Settings */}
                    {feature.settings.length > 0 && status.isEnabled && (
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                        <h4 className="text-sm font-medium text-blue-800 mb-3">Configuration Options:</h4>
                        <div className="space-y-3">
                          {feature.settings.map((setting) => (
                            <div key={setting.key} className="flex items-center justify-between">
                              <div>
                                <label className="text-sm font-medium text-blue-700">
                                  {setting.label}
                                </label>
                                <p className="text-xs text-blue-600">{setting.description}</p>
                              </div>
                              <div className="text-sm text-blue-600">
                                {typeof setting.defaultValue === 'boolean' ? (
                                  setting.defaultValue ? 'Enabled' : 'Disabled'
                                ) : (
                                  String(setting.defaultValue)
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-blue-600 mt-2">
                          * Configuration options will be available in the main settings page
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Toggle Switch */}
                  <div className="ml-6 flex-shrink-0">
                    <div className="flex items-center">
                      <button
                        onClick={() => handleFeatureToggle(feature.id, !status.isEnabled)}
                        disabled={!status.canToggle || !dependencyInfo.canEnable}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          status.isEnabled
                            ? 'bg-blue-600'
                            : 'bg-gray-200'
                        } ${
                          !status.canToggle || !dependencyInfo.canEnable
                            ? 'opacity-50 cursor-not-allowed'
                            : 'cursor-pointer'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            status.isEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      {status.isPending && (
                        <RefreshCw className="w-4 h-4 text-blue-600 animate-spin ml-2" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Statistics */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Feature Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {features.filter(f => featureManager.isFeatureEnabled(f.id)).length}
            </div>
            <div className="text-sm text-gray-600">Enabled</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">
              {features.filter(f => !featureManager.isFeatureEnabled(f.id)).length}
            </div>
            <div className="text-sm text-gray-600">Disabled</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {features.filter(f => f.experimental).length}
            </div>
            <div className="text-sm text-gray-600">Experimental</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {features.length}
            </div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
        </div>
      </div>
    </div>
  );
};