/**
 * Scheduling Panel Component
 * 
 * Provides UI for managing script schedules with comprehensive validation.
 * Integrates with the scheduling store and feature gating system.
 * 
 * @fileoverview Production-grade scheduling UI with type safety and validation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Play, Pause, Trash2, Plus, Calendar, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useSchedulingStore } from '../hooks/useSchedulingStore';
import { featureManager, FEATURE_FLAGS } from '../../lib/features';
import type { 
  ScheduleConfig, 
  ScheduleMode, 
  OnceScheduleConfig, 
  IntervalScheduleConfig, 
  CronScheduleConfig,
  ConditionalScheduleConfig,
  EventScheduleConfig,
  ScheduleStatus 
} from '../../types/scheduling';

/**
 * Schedule form validation state
 */
interface ValidationState {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

/**
 * Schedule form data
 */
interface ScheduleFormData {
  name: string;
  description: string;
  scriptId: string;
  mode: ScheduleMode;
  config: ScheduleConfig;
  enabled: boolean;
}

/**
 * Scheduling Panel Props
 */
interface SchedulingPanelProps {
  className?: string;
}

/**
 * Scheduling Panel Component
 */
export const SchedulingPanel: React.FC<SchedulingPanelProps> = ({ className = '' }) => {
  const {
    schedules,
    stats,
    loading,
    error,
    loadSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    pauseSchedule,
    resumeSchedule,
    executeSchedule,
  } = useSchedulingStore();

  const [isFeatureEnabled, setIsFeatureEnabled] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [formData, setFormData] = useState<ScheduleFormData>({
    name: '',
    description: '',
    scriptId: '',
    mode: 'once',
    config: {
      mode: 'once',
      executeAt: Date.now() + 60000, // 1 minute from now
    },
    enabled: true,
  });
  const [validation, setValidation] = useState<ValidationState>({
    isValid: false,
    errors: {},
    warnings: {},
  });

  // Check if scheduling feature is enabled
  useEffect(() => {
    const checkFeature = () => {
      const enabled = featureManager.isFeatureEnabled(FEATURE_FLAGS.SCRIPT_SCHEDULING);
      setIsFeatureEnabled(enabled);
    };

    checkFeature();
    const unsubscribe = featureManager.subscribeToFeature(FEATURE_FLAGS.SCRIPT_SCHEDULING, checkFeature);

    return unsubscribe;
  }, []);

  // Load schedules on mount
  useEffect(() => {
    if (isFeatureEnabled) {
      loadSchedules();
    }
  }, [isFeatureEnabled, loadSchedules]);

  // Validate form data
  const validateForm = useCallback((data: ScheduleFormData): ValidationState => {
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    // Validate name
    if (!data.name.trim()) {
      errors.name = 'Schedule name is required';
    } else if (data.name.length > 100) {
      errors.name = 'Schedule name must be less than 100 characters';
    }

    // Validate description
    if (data.description.length > 500) {
      warnings.description = 'Description is quite long';
    }

    // Validate script ID
    if (!data.scriptId) {
      errors.scriptId = 'Script selection is required';
    }

    // Validate schedule config based on mode
    switch (data.mode) {
      case 'once':
        const onceConfig = data.config as OnceScheduleConfig;
        if (!onceConfig.executeAt || onceConfig.executeAt <= Date.now()) {
          errors.executeAt = 'Execution time must be in the future';
        }
        break;

      case 'interval':
        const intervalConfig = data.config as IntervalScheduleConfig;
        if (!intervalConfig.intervalMs || intervalConfig.intervalMs < 1000) {
          errors.intervalMs = 'Interval must be at least 1 second';
        }
        if (intervalConfig.maxExecutions && intervalConfig.maxExecutions < 1) {
          errors.maxExecutions = 'Max executions must be at least 1';
        }
        break;

      case 'cron':
        const cronConfig = data.config as CronScheduleConfig;
        if (!cronConfig.cronExpression || !isValidCronExpression(cronConfig.cronExpression)) {
          errors.cronExpression = 'Invalid cron expression';
        }
        break;

      case 'conditional':
        const conditionalConfig = data.config as ConditionalScheduleConfig;
        if (!conditionalConfig.conditions || conditionalConfig.conditions.length === 0) {
          errors.conditions = 'At least one condition is required';
        }
        break;

      case 'event':
        const eventConfig = data.config as EventScheduleConfig;
        if (!eventConfig.eventType || !eventConfig.eventSource) {
          errors.eventType = 'Event type and source are required';
        }
        break;
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      warnings,
    };
  }, []);

  // Update validation when form data changes
  useEffect(() => {
    const validationResult = validateForm(formData);
    setValidation(validationResult);
  }, [formData, validateForm]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validation.isValid) {
      return;
    }

    try {
      if (editingSchedule) {
        await updateSchedule(editingSchedule, {
          name: formData.name,
          description: formData.description,
          scriptId: formData.scriptId,
          config: formData.config,
          enabled: formData.enabled,
        });
        setEditingSchedule(null);
      } else {
        await createSchedule({
          name: formData.name,
          description: formData.description,
          scriptId: formData.scriptId,
          config: formData.config,
          enabled: formData.enabled,
        });
      }

      setShowCreateForm(false);
      setFormData({
        name: '',
        description: '',
        scriptId: '',
        mode: 'once',
        config: {
          mode: 'once',
          executeAt: Date.now() + 60000,
        },
        enabled: true,
      });
    } catch (error) {
      console.error('Failed to save schedule:', error);
    }
  };

  // Handle schedule actions
  const handlePause = async (scheduleId: string) => {
    try {
      await pauseSchedule(scheduleId);
    } catch (error) {
      console.error('Failed to pause schedule:', error);
    }
  };

  const handleResume = async (scheduleId: string) => {
    try {
      await resumeSchedule(scheduleId);
    } catch (error) {
      console.error('Failed to resume schedule:', error);
    }
  };

  const handleDelete = async (scheduleId: string) => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      try {
        await deleteSchedule(scheduleId);
      } catch (error) {
        console.error('Failed to delete schedule:', error);
      }
    }
  };

  const handleExecute = async (scheduleId: string) => {
    try {
      await executeSchedule(scheduleId);
    } catch (error) {
      console.error('Failed to execute schedule:', error);
    }
  };

  // Format schedule status
  const formatStatus = (status: ScheduleStatus): { text: string; color: string; icon: React.ReactNode } => {
    switch (status) {
      case 'active':
        return { text: 'Active', color: 'text-green-600', icon: <CheckCircle className="w-4 h-4" /> };
      case 'paused':
        return { text: 'Paused', color: 'text-yellow-600', icon: <Pause className="w-4 h-4" /> };
      case 'completed':
        return { text: 'Completed', color: 'text-blue-600', icon: <CheckCircle className="w-4 h-4" /> };
      case 'failed':
        return { text: 'Failed', color: 'text-red-600', icon: <XCircle className="w-4 h-4" /> };
      default:
        return { text: 'Unknown', color: 'text-gray-600', icon: <AlertCircle className="w-4 h-4" /> };
    }
  };

  // Format schedule mode
  const formatMode = (mode: ScheduleMode): string => {
    switch (mode) {
      case 'once': return 'Once';
      case 'interval': return 'Interval';
      case 'cron': return 'Cron';
      case 'conditional': return 'Conditional';
      case 'event': return 'Event';
      default: return 'Unknown';
    }
  };

  // Validate cron expression (basic validation)
  const isValidCronExpression = (expression: string): boolean => {
    const cronRegex = /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([012]?\d|3[01])) (\*|([0]?\d|1[0-2])) (\*|([0-6]))$/;
    return cronRegex.test(expression);
  };

  if (!isFeatureEnabled) {
    return (
      <div className={`p-6 text-center ${className}`}>
        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Scheduling Disabled</h3>
        <p className="text-gray-600 mb-4">
          Script scheduling is currently disabled. Enable it in settings to use this feature.
        </p>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Open Settings
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Script Scheduling
          </h2>
          <p className="text-sm text-gray-600">
            Manage automated script execution schedules
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Schedule
        </button>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{stats.totalSchedules}</div>
            <div className="text-sm text-gray-600">Total Schedules</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">{stats.activeSchedules}</div>
            <div className="text-sm text-gray-600">Active</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-yellow-600">{stats.pausedSchedules}</div>
            <div className="text-sm text-gray-600">Paused</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-purple-600">{stats.totalExecutions}</div>
            <div className="text-sm text-gray-600">Total Executions</div>
          </div>
        </div>
      )}

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

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Schedules List */}
      <div className="space-y-4">
        {schedules.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Schedules</h3>
            <p className="text-gray-600 mb-4">
              Create your first schedule to automate script execution
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Schedule
            </button>
          </div>
        ) : (
          schedules.map((schedule) => {
            const status = formatStatus(schedule.status);
            return (
              <div key={schedule.id} className="bg-white border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-gray-900">{schedule.name}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.icon}
                        {status.text}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {formatMode(schedule.config.mode)}
                      </span>
                    </div>
                    {schedule.description && (
                      <p className="text-sm text-gray-600 mb-2">{schedule.description}</p>
                    )}
                    <div className="text-xs text-gray-500">
                      Created: {new Date(schedule.createdAt).toLocaleDateString()}
                      {schedule.lastExecutedAt && (
                        <span className="ml-4">
                          Last executed: {new Date(schedule.lastExecutedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {schedule.status === 'active' ? (
                      <button
                        onClick={() => handlePause(schedule.id)}
                        className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-md"
                        title="Pause schedule"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    ) : schedule.status === 'paused' ? (
                      <button
                        onClick={() => handleResume(schedule.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-md"
                        title="Resume schedule"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    ) : null}
                    <button
                      onClick={() => handleExecute(schedule.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-md"
                      title="Execute now"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingSchedule(schedule.id)}
                      className="p-2 text-gray-600 hover:bg-gray-50 rounded-md"
                      title="Edit schedule"
                    >
                      <Calendar className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(schedule.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                      title="Delete schedule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create/Edit Form Modal */}
      {(showCreateForm || editingSchedule) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingSchedule(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Schedule Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md ${
                      validation.errors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter schedule name"
                  />
                  {validation.errors.name && (
                    <p className="mt-1 text-sm text-red-600">{validation.errors.name}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md ${
                      validation.errors.description ? 'border-red-300' : 'border-gray-300'
                    }`}
                    rows={3}
                    placeholder="Enter schedule description"
                  />
                  {validation.errors.description && (
                    <p className="mt-1 text-sm text-red-600">{validation.errors.description}</p>
                  )}
                  {validation.warnings.description && (
                    <p className="mt-1 text-sm text-yellow-600">{validation.warnings.description}</p>
                  )}
                </div>

                {/* Script Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Script *
                  </label>
                  <select
                    value={formData.scriptId}
                    onChange={(e) => setFormData({ ...formData, scriptId: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md ${
                      validation.errors.scriptId ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select a script</option>
                    {/* TODO: Load scripts from script store */}
                    <option value="script1">Sample Script 1</option>
                    <option value="script2">Sample Script 2</option>
                  </select>
                  {validation.errors.scriptId && (
                    <p className="mt-1 text-sm text-red-600">{validation.errors.scriptId}</p>
                  )}
                </div>

                {/* Schedule Mode */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Schedule Mode *
                  </label>
                  <select
                    value={formData.mode}
                    onChange={(e) => {
                      const mode = e.target.value as ScheduleMode;
                      setFormData({
                        ...formData,
                        mode,
                        config: getDefaultConfigForMode(mode),
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="once">Once</option>
                    <option value="interval">Interval</option>
                    <option value="cron">Cron</option>
                    <option value="conditional">Conditional</option>
                    <option value="event">Event</option>
                  </select>
                </div>

                {/* Mode-specific configuration */}
                {renderModeConfig()}

                {/* Enabled Toggle */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enabled"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="enabled" className="ml-2 block text-sm text-gray-700">
                    Enable schedule
                  </label>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingSchedule(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!validation.isValid}
                  className={`px-4 py-2 rounded-md ${
                    validation.isValid
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  // Render mode-specific configuration
  function renderModeConfig(): React.ReactNode {
    switch (formData.mode) {
      case 'once':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Execute At *
            </label>
            <input
              type="datetime-local"
              value={new Date((formData.config as OnceScheduleConfig).executeAt).toISOString().slice(0, 16)}
              onChange={(e) => {
                const config = formData.config as OnceScheduleConfig;
                setFormData({
                  ...formData,
                  config: {
                    ...config,
                    executeAt: new Date(e.target.value).getTime(),
                  },
                });
              }}
              className={`w-full px-3 py-2 border rounded-md ${
                validation.errors.executeAt ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {validation.errors.executeAt && (
              <p className="mt-1 text-sm text-red-600">{validation.errors.executeAt}</p>
            )}
          </div>
        );

      case 'interval':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Interval (milliseconds) *
              </label>
              <input
                type="number"
                value={(formData.config as IntervalScheduleConfig).intervalMs || ''}
                onChange={(e) => {
                  const config = formData.config as IntervalScheduleConfig;
                  setFormData({
                    ...formData,
                    config: {
                      ...config,
                      intervalMs: parseInt(e.target.value) || 0,
                    },
                  });
                }}
                className={`w-full px-3 py-2 border rounded-md ${
                  validation.errors.intervalMs ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="e.g., 60000 for 1 minute"
                min="1000"
              />
              {validation.errors.intervalMs && (
                <p className="mt-1 text-sm text-red-600">{validation.errors.intervalMs}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Executions (optional)
              </label>
              <input
                type="number"
                value={(formData.config as IntervalScheduleConfig).maxExecutions || ''}
                onChange={(e) => {
                  const config = formData.config as IntervalScheduleConfig;
                  setFormData({
                    ...formData,
                    config: {
                      ...config,
                      maxExecutions: parseInt(e.target.value) || undefined,
                    },
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Leave empty for unlimited"
                min="1"
              />
            </div>
          </div>
        );

      case 'cron':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cron Expression *
            </label>
            <input
              type="text"
              value={(formData.config as CronScheduleConfig).cronExpression || ''}
              onChange={(e) => {
                const config = formData.config as CronScheduleConfig;
                setFormData({
                  ...formData,
                  config: {
                    ...config,
                    cronExpression: e.target.value,
                  },
                });
              }}
              className={`w-full px-3 py-2 border rounded-md ${
                validation.errors.cronExpression ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="e.g., 0 9 * * 1-5 (weekdays at 9 AM)"
            />
            {validation.errors.cronExpression && (
              <p className="mt-1 text-sm text-red-600">{validation.errors.cronExpression}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Format: minute hour day month weekday
            </p>
          </div>
        );

      case 'conditional':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Conditions *
            </label>
            <div className="text-sm text-gray-600">
              Conditional scheduling configuration will be implemented in a future update.
            </div>
            {validation.errors.conditions && (
              <p className="mt-1 text-sm text-red-600">{validation.errors.conditions}</p>
            )}
          </div>
        );

      case 'event':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Type *
              </label>
              <input
                type="text"
                value={(formData.config as EventScheduleConfig).eventType || ''}
                onChange={(e) => {
                  const config = formData.config as EventScheduleConfig;
                  setFormData({
                    ...formData,
                    config: {
                      ...config,
                      eventType: e.target.value,
                    },
                  });
                }}
                className={`w-full px-3 py-2 border rounded-md ${
                  validation.errors.eventType ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="e.g., pageLoad, userAction, customEvent"
              />
              {validation.errors.eventType && (
                <p className="mt-1 text-sm text-red-600">{validation.errors.eventType}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Source *
              </label>
              <input
                type="text"
                value={(formData.config as EventScheduleConfig).eventSource || ''}
                onChange={(e) => {
                  const config = formData.config as EventScheduleConfig;
                  setFormData({
                    ...formData,
                    config: {
                      ...config,
                      eventSource: e.target.value,
                    },
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g., window, document, custom"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  // Get default config for mode
  function getDefaultConfigForMode(mode: ScheduleMode): ScheduleConfig {
    switch (mode) {
      case 'once':
        return {
          mode: 'once',
          executeAt: Date.now() + 60000,
        };
      case 'interval':
        return {
          mode: 'interval',
          intervalMs: 60000,
        };
      case 'cron':
        return {
          mode: 'cron',
          cronExpression: '0 9 * * 1-5',
        };
      case 'conditional':
        return {
          mode: 'conditional',
          conditions: [],
        };
      case 'event':
        return {
          mode: 'event',
          eventType: '',
          eventSource: 'window',
        };
      default:
        return {
          mode: 'once',
          executeAt: Date.now() + 60000,
        };
    }
  }
};