/**
 * ScriptFlow Scheduling System Types
 * 
 * Comprehensive type definitions for advanced script scheduling
 * Built with mission-critical reliability and type safety
 */

import type { Script } from './index'

// ============================================================================
// CORE SCHEDULING TYPES
// ============================================================================

/**
 * Schedule execution modes
 */
export type ScheduleMode = 
  | 'once'           // Execute once at specific time
  | 'interval'       // Execute at regular intervals
  | 'cron'           // Execute based on cron expression
  | 'conditional'    // Execute when conditions are met
  | 'event'          // Execute on specific events

/**
 * Schedule status
 */
export type ScheduleStatus = 
  | 'active'         // Schedule is active and running
  | 'paused'         // Schedule is paused by user
  | 'disabled'       // Schedule is disabled
  | 'completed'      // One-time schedule completed
  | 'failed'         // Schedule failed and stopped
  | 'expired'        // Schedule has expired

/**
 * Execution context for scheduled scripts
 */
export interface ExecutionContext {
  readonly scheduleId: string
  readonly scriptId: string
  readonly executionId: string
  readonly timestamp: number
  readonly trigger: ScheduleTrigger
  readonly metadata: Record<string, unknown>
}

/**
 * Schedule trigger information
 */
export interface ScheduleTrigger {
  readonly type: ScheduleMode
  readonly source: 'user' | 'system' | 'api'
  readonly timestamp: number
  readonly metadata?: Record<string, unknown>
}

// ============================================================================
// SCHEDULE CONFIGURATION TYPES
// ============================================================================

/**
 * Base schedule configuration
 */
export interface BaseScheduleConfig {
  readonly id: string
  readonly scriptId: string
  readonly name: string
  readonly description?: string
  readonly enabled: boolean
  readonly mode: ScheduleMode
  readonly priority: number
  readonly maxRetries: number
  readonly retryDelay: number
  readonly timeout: number
  readonly createdAt: number
  readonly updatedAt: number
  readonly createdBy: string
  readonly tags: readonly string[]
  readonly metadata: Record<string, unknown>
}

/**
 * One-time schedule configuration
 */
export interface OnceScheduleConfig extends BaseScheduleConfig {
  readonly mode: 'once'
  readonly executeAt: number
  readonly timezone: string
}

/**
 * Interval schedule configuration
 */
export interface IntervalScheduleConfig extends BaseScheduleConfig {
  readonly mode: 'interval'
  readonly intervalMs: number
  readonly startAt?: number
  readonly endAt?: number
  readonly timezone: string
}

/**
 * Cron schedule configuration
 */
export interface CronScheduleConfig extends BaseScheduleConfig {
  readonly mode: 'cron'
  readonly cronExpression: string
  readonly timezone: string
  readonly startAt?: number
  readonly endAt?: number
}

/**
 * Conditional schedule configuration
 */
export interface ConditionalScheduleConfig extends BaseScheduleConfig {
  readonly mode: 'conditional'
  readonly conditions: readonly ScheduleCondition[]
  readonly checkInterval: number
  readonly cooldown: number
}

/**
 * Event-based schedule configuration
 */
export interface EventScheduleConfig extends BaseScheduleConfig {
  readonly mode: 'event'
  readonly events: readonly string[]
  readonly targetUrls?: readonly string[]
  readonly cooldown: number
}

/**
 * Union type for all schedule configurations
 */
export type ScheduleConfig = 
  | OnceScheduleConfig
  | IntervalScheduleConfig
  | CronScheduleConfig
  | ConditionalScheduleConfig
  | EventScheduleConfig

// ============================================================================
// CONDITION SYSTEM
// ============================================================================

/**
 * Condition operators
 */
export type ConditionOperator = 
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'regex'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'is_empty'
  | 'is_not_empty'
  | 'is_true'
  | 'is_false'

/**
 * Condition data sources
 */
export type ConditionSource = 
  | 'url'
  | 'title'
  | 'domain'
  | 'time'
  | 'day_of_week'
  | 'day_of_month'
  | 'month'
  | 'year'
  | 'local_storage'
  | 'session_storage'
  | 'cookie'
  | 'custom'

/**
 * Schedule condition
 */
export interface ScheduleCondition {
  readonly id: string
  readonly source: ConditionSource
  readonly operator: ConditionOperator
  readonly value: string | number | boolean
  readonly caseSensitive: boolean
  readonly metadata?: Record<string, unknown>
}

// ============================================================================
// EXECUTION TYPES
// ============================================================================

/**
 * Schedule execution result
 */
export interface ScheduleExecutionResult {
  readonly executionId: string
  readonly scheduleId: string
  readonly scriptId: string
  readonly success: boolean
  readonly startTime: number
  readonly endTime: number
  readonly duration: number
  readonly error?: ScheduleExecutionError
  readonly output?: unknown
  readonly metadata: Record<string, unknown>
}

/**
 * Schedule execution error
 */
export interface ScheduleExecutionError {
  readonly code: string
  readonly message: string
  readonly stack?: string
  readonly context: Record<string, unknown>
  readonly retryable: boolean
  readonly timestamp: number
}

/**
 * Schedule execution history entry
 */
export interface ScheduleExecutionHistory {
  readonly id: string
  readonly scheduleId: string
  readonly executions: readonly ScheduleExecutionResult[]
  readonly totalExecutions: number
  readonly successCount: number
  readonly failureCount: number
  readonly lastExecution?: number
  readonly createdAt: number
  readonly updatedAt: number
}

// ============================================================================
// SCHEDULER STATE TYPES
// ============================================================================

/**
 * Active schedule instance
 */
export interface ActiveSchedule {
  readonly config: ScheduleConfig
  readonly status: ScheduleStatus
  readonly nextExecution?: number
  readonly lastExecution?: number
  readonly executionCount: number
  readonly failureCount: number
  readonly alarmId?: string
  readonly createdAt: number
  readonly updatedAt: number
}

/**
 * Scheduler statistics
 */
export interface SchedulerStats {
  readonly totalSchedules: number
  readonly activeSchedules: number
  readonly pausedSchedules: number
  readonly disabledSchedules: number
  readonly totalExecutions: number
  readonly successfulExecutions: number
  readonly failedExecutions: number
  readonly averageExecutionTime: number
  readonly lastExecution?: number
  readonly uptime: number
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Scheduling-specific error codes
 */
export const SCHEDULING_ERROR_CODES = {
  // Configuration errors
  INVALID_SCHEDULE_CONFIG: 'INVALID_SCHEDULE_CONFIG',
  INVALID_CRON_EXPRESSION: 'INVALID_CRON_EXPRESSION',
  INVALID_CONDITION: 'INVALID_CONDITION',
  INVALID_TIMEZONE: 'INVALID_TIMEZONE',
  
  // Execution errors
  EXECUTION_FAILED: 'EXECUTION_FAILED',
  EXECUTION_TIMEOUT: 'EXECUTION_TIMEOUT',
  SCRIPT_NOT_FOUND: 'SCRIPT_NOT_FOUND',
  SCRIPT_DISABLED: 'SCRIPT_DISABLED',
  
  // Scheduler errors
  SCHEDULER_NOT_INITIALIZED: 'SCHEDULER_NOT_INITIALIZED',
  ALARM_CREATION_FAILED: 'ALARM_CREATION_FAILED',
  ALARM_CLEAR_FAILED: 'ALARM_CLEAR_FAILED',
  STORAGE_ERROR: 'STORAGE_ERROR',
  
  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  INVALID_VALUE: 'INVALID_VALUE',
  
  // System errors
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED'
} as const

export type SchedulingErrorCode = typeof SCHEDULING_ERROR_CODES[keyof typeof SCHEDULING_ERROR_CODES]

/**
 * Scheduling error class
 */
export class SchedulingError extends Error {
  constructor(
    message: string,
    public readonly code: SchedulingErrorCode,
    public readonly context: Record<string, unknown> = {},
    public readonly retryable: boolean = false
  ) {
    super(message)
    this.name = 'SchedulingError'
  }
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Schedule validation result
 */
export interface ScheduleValidationResult {
  readonly valid: boolean
  readonly errors: readonly ScheduleValidationError[]
  readonly warnings: readonly ScheduleValidationWarning[]
}

/**
 * Schedule validation error
 */
export interface ScheduleValidationError {
  readonly field: string
  readonly code: string
  readonly message: string
  readonly value?: unknown
}

/**
 * Schedule validation warning
 */
export interface ScheduleValidationWarning {
  readonly field: string
  readonly code: string
  readonly message: string
  readonly value?: unknown
}

// ============================================================================
// API TYPES
// ============================================================================

/**
 * Schedule creation request
 */
export interface CreateScheduleRequest {
  readonly scriptId: string
  readonly name: string
  readonly description?: string
  readonly mode: ScheduleMode
  readonly config: Omit<ScheduleConfig, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>
}

/**
 * Schedule update request
 */
export interface UpdateScheduleRequest {
  readonly id: string
  readonly updates: Partial<Omit<ScheduleConfig, 'id' | 'createdAt' | 'createdBy'>>
}

/**
 * Schedule execution request
 */
export interface ExecuteScheduleRequest {
  readonly scheduleId: string
  readonly force?: boolean
  readonly context?: Record<string, unknown>
}

/**
 * Schedule query options
 */
export interface ScheduleQueryOptions {
  readonly status?: ScheduleStatus
  readonly mode?: ScheduleMode
  readonly scriptId?: string
  readonly tags?: readonly string[]
  readonly limit?: number
  readonly offset?: number
  readonly sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'nextExecution'
  readonly sortOrder?: 'asc' | 'desc'
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default schedule configuration
 */
export const DEFAULT_SCHEDULE_CONFIG: Partial<ScheduleConfig> = {
  enabled: true,
  priority: 0,
  maxRetries: 3,
  retryDelay: 5000,
  timeout: 30000,
  tags: [],
  metadata: {}
} as const

/**
 * Maximum values for validation
 */
export const SCHEDULING_LIMITS = {
  MAX_SCHEDULES: 1000,
  MAX_CONDITIONS_PER_SCHEDULE: 10,
  MAX_TAGS_PER_SCHEDULE: 20,
  MAX_SCHEDULE_NAME_LENGTH: 100,
  MAX_SCHEDULE_DESCRIPTION_LENGTH: 500,
  MAX_EXECUTION_HISTORY: 10000,
  MIN_INTERVAL_MS: 1000,
  MAX_INTERVAL_MS: 86400000, // 24 hours
  MAX_TIMEOUT_MS: 300000, // 5 minutes
  MAX_RETRIES: 10
} as const

/**
 * Supported timezones
 */
export const SUPPORTED_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney'
] as const

export type SupportedTimezone = typeof SUPPORTED_TIMEZONES[number]