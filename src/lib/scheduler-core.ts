/**
 * ScriptFlow Scheduler Core
 * 
 * Mission-critical scheduling engine with bulletproof error handling
 * Built for production reliability with zero tolerance for failure
 */

import type {
  ScheduleConfig,
  ActiveSchedule,
  ScheduleExecutionResult,
  ScheduleExecutionError,
  ScheduleExecutionHistory,
  SchedulerStats,
  ScheduleValidationResult,
  ScheduleValidationError,
  ScheduleValidationWarning,
  ExecutionContext,
  ScheduleTrigger,
  SchedulingErrorCode,
  SCHEDULING_ERROR_CODES,
  SCHEDULING_LIMITS,
  SUPPORTED_TIMEZONES,
  SupportedTimezone
} from '@/types/scheduling'
import { SchedulingError } from '@/types/scheduling'
import { ScriptManager } from './script-manager'
import { StorageManager } from './storage-manager'
import { Logger } from './logger'

/**
 * Scheduler Core Class
 * 
 * Handles all scheduling operations with comprehensive error handling,
 * retry logic, and state management
 */
export class SchedulerCore {
  private readonly scriptManager: ScriptManager
  private readonly storageManager: StorageManager
  private readonly logger: Logger
  private readonly activeSchedules: Map<string, ActiveSchedule> = new Map()
  private readonly executionHistory: Map<string, ScheduleExecutionHistory> = new Map()
  private readonly alarmCallbacks: Map<string, () => Promise<void>> = new Map()
  private isInitialized = false
  private stats: SchedulerStats = this.createEmptyStats()

  constructor(
    scriptManager: ScriptManager,
    storageManager: StorageManager,
    logger: Logger
  ) {
    this.scriptManager = scriptManager
    this.storageManager = storageManager
    this.logger = logger
  }

  /**
   * Initialize the scheduler
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Scheduler already initialized')
      return
    }

    try {
      this.logger.info('Initializing scheduler core')
      
      // Load active schedules from storage
      await this.loadActiveSchedules()
      
      // Load execution history
      await this.loadExecutionHistory()
      
      // Set up Chrome alarms listener
      this.setupAlarmListener()
      
      // Restore any pending alarms
      await this.restorePendingAlarms()
      
      this.isInitialized = true
      this.stats.uptime = Date.now()
      
      this.logger.info('Scheduler core initialized successfully', {
        activeSchedules: this.activeSchedules.size,
        executionHistory: this.executionHistory.size
      })
    } catch (error) {
      this.logger.error('Failed to initialize scheduler core', { error })
      throw new SchedulingError(
        'Failed to initialize scheduler',
        SCHEDULING_ERROR_CODES.SCHEDULER_NOT_INITIALIZED,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Create a new schedule
   */
  async createSchedule(config: ScheduleConfig): Promise<ActiveSchedule> {
    this.ensureInitialized()

    try {
      this.logger.info('Creating new schedule', { scheduleId: config.id, mode: config.mode })

      // Validate schedule configuration
      const validation = await this.validateScheduleConfig(config)
      if (!validation.valid) {
        throw new SchedulingError(
          'Invalid schedule configuration',
          SCHEDULING_ERROR_CODES.INVALID_SCHEDULE_CONFIG,
          { errors: validation.errors }
        )
      }

      // Check if schedule already exists
      if (this.activeSchedules.has(config.id)) {
        throw new SchedulingError(
          'Schedule already exists',
          SCHEDULING_ERROR_CODES.VALIDATION_FAILED,
          { scheduleId: config.id }
        )
      }

      // Verify script exists and is enabled
      const script = await this.scriptManager.getScript(config.scriptId)
      if (!script) {
        throw new SchedulingError(
          'Script not found',
          SCHEDULING_ERROR_CODES.SCRIPT_NOT_FOUND,
          { scriptId: config.scriptId }
        )
      }

      if (!script.enabled) {
        throw new SchedulingError(
          'Script is disabled',
          SCHEDULING_ERROR_CODES.SCRIPT_DISABLED,
          { scriptId: config.scriptId }
        )
      }

      // Create active schedule
      const activeSchedule: ActiveSchedule = {
        config,
        status: config.enabled ? 'active' : 'disabled',
        executionCount: 0,
        failureCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      // Calculate next execution time
      if (config.enabled) {
        activeSchedule.nextExecution = await this.calculateNextExecution(config)
        
        // Set up alarm if needed
        if (activeSchedule.nextExecution) {
          await this.setupAlarm(config.id, activeSchedule.nextExecution)
        }
      }

      // Store schedule
      this.activeSchedules.set(config.id, activeSchedule)
      await this.persistActiveSchedule(activeSchedule)

      // Update stats
      this.updateStats()

      this.logger.info('Schedule created successfully', {
        scheduleId: config.id,
        nextExecution: activeSchedule.nextExecution
      })

      return activeSchedule
    } catch (error) {
      this.logger.error('Failed to create schedule', { 
        scheduleId: config.id, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
      throw error
    }
  }

  /**
   * Update an existing schedule
   */
  async updateSchedule(scheduleId: string, updates: Partial<ScheduleConfig>): Promise<ActiveSchedule> {
    this.ensureInitialized()

    try {
      this.logger.info('Updating schedule', { scheduleId })

      const existingSchedule = this.activeSchedules.get(scheduleId)
      if (!existingSchedule) {
        throw new SchedulingError(
          'Schedule not found',
          SCHEDULING_ERROR_CODES.VALIDATION_FAILED,
          { scheduleId }
        )
      }

      // Create updated configuration
      const updatedConfig = { ...existingSchedule.config, ...updates, updatedAt: Date.now() }

      // Validate updated configuration
      const validation = await this.validateScheduleConfig(updatedConfig)
      if (!validation.valid) {
        throw new SchedulingError(
          'Invalid schedule configuration',
          SCHEDULING_ERROR_CODES.INVALID_SCHEDULE_CONFIG,
          { errors: validation.errors }
        )
      }

      // Clear existing alarm
      await this.clearAlarm(scheduleId)

      // Create updated active schedule
      const updatedSchedule: ActiveSchedule = {
        ...existingSchedule,
        config: updatedConfig,
        updatedAt: Date.now()
      }

      // Recalculate next execution if enabled
      if (updatedConfig.enabled) {
        updatedSchedule.status = 'active'
        updatedSchedule.nextExecution = await this.calculateNextExecution(updatedConfig)
        
        if (updatedSchedule.nextExecution) {
          await this.setupAlarm(scheduleId, updatedSchedule.nextExecution)
        }
      } else {
        updatedSchedule.status = 'disabled'
        updatedSchedule.nextExecution = undefined
      }

      // Update storage
      this.activeSchedules.set(scheduleId, updatedSchedule)
      await this.persistActiveSchedule(updatedSchedule)

      this.logger.info('Schedule updated successfully', {
        scheduleId,
        nextExecution: updatedSchedule.nextExecution
      })

      return updatedSchedule
    } catch (error) {
      this.logger.error('Failed to update schedule', { 
        scheduleId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
      throw error
    }
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: string): Promise<void> {
    this.ensureInitialized()

    try {
      this.logger.info('Deleting schedule', { scheduleId })

      const schedule = this.activeSchedules.get(scheduleId)
      if (!schedule) {
        throw new SchedulingError(
          'Schedule not found',
          SCHEDULING_ERROR_CODES.VALIDATION_FAILED,
          { scheduleId }
        )
      }

      // Clear alarm
      await this.clearAlarm(scheduleId)

      // Remove from active schedules
      this.activeSchedules.delete(scheduleId)

      // Remove from storage
      await this.storageManager.delete(`schedule_${scheduleId}`)

      // Update stats
      this.updateStats()

      this.logger.info('Schedule deleted successfully', { scheduleId })
    } catch (error) {
      this.logger.error('Failed to delete schedule', { 
        scheduleId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
      throw error
    }
  }

  /**
   * Execute a schedule immediately
   */
  async executeSchedule(scheduleId: string, force = false): Promise<ScheduleExecutionResult> {
    this.ensureInitialized()

    try {
      this.logger.info('Executing schedule', { scheduleId, force })

      const schedule = this.activeSchedules.get(scheduleId)
      if (!schedule) {
        throw new SchedulingError(
          'Schedule not found',
          SCHEDULING_ERROR_CODES.VALIDATION_FAILED,
          { scheduleId }
        )
      }

      if (!force && schedule.status !== 'active') {
        throw new SchedulingError(
          'Schedule is not active',
          SCHEDULING_ERROR_CODES.VALIDATION_FAILED,
          { scheduleId, status: schedule.status }
        )
      }

      // Create execution context
      const executionId = this.generateExecutionId()
      const context: ExecutionContext = {
        scheduleId,
        scriptId: schedule.config.scriptId,
        executionId,
        timestamp: Date.now(),
        trigger: {
          type: 'once',
          source: 'user',
          timestamp: Date.now()
        },
        metadata: {}
      }

      // Execute script
      const result = await this.executeScriptWithRetry(schedule, context)

      // Update schedule stats
      schedule.executionCount++
      if (!result.success) {
        schedule.failureCount++
      }
      schedule.lastExecution = Date.now()
      schedule.updatedAt = Date.now()

      // Persist updated schedule
      await this.persistActiveSchedule(schedule)

      // Store execution result
      await this.storeExecutionResult(result)

      // Update stats
      this.updateStats()

      this.logger.info('Schedule executed successfully', {
        scheduleId,
        executionId,
        success: result.success,
        duration: result.duration
      })

      return result
    } catch (error) {
      this.logger.error('Failed to execute schedule', { 
        scheduleId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
      throw error
    }
  }

  /**
   * Get all schedules with optional filtering
   */
  getSchedules(options: {
    status?: string
    mode?: string
    scriptId?: string
    limit?: number
    offset?: number
  } = {}): ActiveSchedule[] {
    this.ensureInitialized()

    let schedules = Array.from(this.activeSchedules.values())

    // Apply filters
    if (options.status) {
      schedules = schedules.filter(s => s.status === options.status)
    }
    if (options.mode) {
      schedules = schedules.filter(s => s.config.mode === options.mode)
    }
    if (options.scriptId) {
      schedules = schedules.filter(s => s.config.scriptId === options.scriptId)
    }

    // Apply pagination
    const offset = options.offset || 0
    const limit = options.limit || schedules.length
    schedules = schedules.slice(offset, offset + limit)

    return schedules
  }

  /**
   * Get scheduler statistics
   */
  getStats(): SchedulerStats {
    this.ensureInitialized()
    return { ...this.stats }
  }

  /**
   * Pause a schedule
   */
  async pauseSchedule(scheduleId: string): Promise<void> {
    this.ensureInitialized()

    const schedule = this.activeSchedules.get(scheduleId)
    if (!schedule) {
      throw new SchedulingError(
        'Schedule not found',
        SCHEDULING_ERROR_CODES.VALIDATION_FAILED,
        { scheduleId }
      )
    }

    if (schedule.status !== 'active') {
      throw new SchedulingError(
        'Schedule is not active',
        SCHEDULING_ERROR_CODES.VALIDATION_FAILED,
        { scheduleId, status: schedule.status }
      )
    }

    // Clear alarm
    await this.clearAlarm(scheduleId)

    // Update status
    schedule.status = 'paused'
    schedule.updatedAt = Date.now()
    schedule.nextExecution = undefined

    // Persist changes
    await this.persistActiveSchedule(schedule)

    this.logger.info('Schedule paused', { scheduleId })
  }

  /**
   * Resume a schedule
   */
  async resumeSchedule(scheduleId: string): Promise<void> {
    this.ensureInitialized()

    const schedule = this.activeSchedules.get(scheduleId)
    if (!schedule) {
      throw new SchedulingError(
        'Schedule not found',
        SCHEDULING_ERROR_CODES.VALIDATION_FAILED,
        { scheduleId }
      )
    }

    if (schedule.status !== 'paused') {
      throw new SchedulingError(
        'Schedule is not paused',
        SCHEDULING_ERROR_CODES.VALIDATION_FAILED,
        { scheduleId, status: schedule.status }
      )
    }

    // Recalculate next execution
    schedule.nextExecution = await this.calculateNextExecution(schedule.config)
    schedule.status = 'active'
    schedule.updatedAt = Date.now()

    // Set up alarm
    if (schedule.nextExecution) {
      await this.setupAlarm(scheduleId, schedule.nextExecution)
    }

    // Persist changes
    await this.persistActiveSchedule(schedule)

    this.logger.info('Schedule resumed', { 
      scheduleId, 
      nextExecution: schedule.nextExecution 
    })
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Ensure scheduler is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new SchedulingError(
        'Scheduler not initialized',
        SCHEDULING_ERROR_CODES.SCHEDULER_NOT_INITIALIZED
      )
    }
  }

  /**
   * Load active schedules from storage
   */
  private async loadActiveSchedules(): Promise<void> {
    try {
      const schedules = await this.storageManager.get<Record<string, ActiveSchedule>>('active_schedules')
      if (schedules) {
        for (const [id, schedule] of Object.entries(schedules)) {
          this.activeSchedules.set(id, schedule)
        }
      }
    } catch (error) {
      this.logger.error('Failed to load active schedules', { error })
      throw error
    }
  }

  /**
   * Load execution history from storage
   */
  private async loadExecutionHistory(): Promise<void> {
    try {
      const history = await this.storageManager.get<Record<string, ScheduleExecutionHistory>>('execution_history')
      if (history) {
        for (const [id, entry] of Object.entries(history)) {
          this.executionHistory.set(id, entry)
        }
      }
    } catch (error) {
      this.logger.error('Failed to load execution history', { error })
      throw error
    }
  }

  /**
   * Set up Chrome alarms listener
   */
  private setupAlarmListener(): void {
    chrome.alarms.onAlarm.addListener(async (alarm) => {
      if (alarm.name.startsWith('schedule_')) {
        const scheduleId = alarm.name.replace('schedule_', '')
        await this.handleAlarm(scheduleId)
      }
    })
  }

  /**
   * Handle alarm trigger
   */
  private async handleAlarm(scheduleId: string): Promise<void> {
    try {
      this.logger.info('Handling alarm', { scheduleId })

      const schedule = this.activeSchedules.get(scheduleId)
      if (!schedule) {
        this.logger.warn('Schedule not found for alarm', { scheduleId })
        return
      }

      if (schedule.status !== 'active') {
        this.logger.warn('Schedule is not active', { scheduleId, status: schedule.status })
        return
      }

      // Execute schedule
      await this.executeSchedule(scheduleId)

      // Recalculate next execution for recurring schedules
      if (schedule.config.mode !== 'once') {
        const nextExecution = await this.calculateNextExecution(schedule.config)
        if (nextExecution) {
          schedule.nextExecution = nextExecution
          await this.setupAlarm(scheduleId, nextExecution)
          await this.persistActiveSchedule(schedule)
        }
      } else {
        // One-time schedule completed
        schedule.status = 'completed'
        schedule.nextExecution = undefined
        await this.persistActiveSchedule(schedule)
      }
    } catch (error) {
      this.logger.error('Failed to handle alarm', { scheduleId, error })
    }
  }

  /**
   * Restore pending alarms after extension restart
   */
  private async restorePendingAlarms(): Promise<void> {
    try {
      const alarms = await chrome.alarms.getAll()
      for (const alarm of alarms) {
        if (alarm.name.startsWith('schedule_')) {
          const scheduleId = alarm.name.replace('schedule_', '')
          const schedule = this.activeSchedules.get(scheduleId)
          if (schedule && schedule.status === 'active') {
            // Alarm is still valid
            this.logger.info('Restored pending alarm', { scheduleId, scheduledTime: alarm.scheduledTime })
          } else {
            // Clean up orphaned alarm
            await chrome.alarms.clear(alarm.name)
            this.logger.info('Cleared orphaned alarm', { scheduleId })
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to restore pending alarms', { error })
    }
  }

  /**
   * Calculate next execution time for a schedule
   */
  private async calculateNextExecution(config: ScheduleConfig): Promise<number | undefined> {
    const now = Date.now()

    switch (config.mode) {
      case 'once':
        return config.executeAt > now ? config.executeAt : undefined

      case 'interval':
        const startTime = config.startAt || now
        if (config.endAt && now > config.endAt) {
          return undefined
        }
        return startTime + config.intervalMs

      case 'cron':
        // Simplified cron calculation - in production, use a proper cron library
        return this.calculateCronNextExecution(config.cronExpression, now)

      case 'conditional':
        // For conditional schedules, we'll check periodically
        return now + config.checkInterval

      case 'event':
        // Event-based schedules don't have a fixed next execution time
        return undefined

      default:
        return undefined
    }
  }

  /**
   * Calculate next execution time for cron expression
   */
  private calculateCronNextExecution(cronExpression: string, now: number): number | undefined {
    // This is a simplified implementation
    // In production, use a proper cron library like 'cron-parser'
    try {
      // For now, return a placeholder
      // TODO: Implement proper cron parsing
      return now + 60000 // 1 minute from now
    } catch (error) {
      this.logger.error('Failed to parse cron expression', { cronExpression, error })
      return undefined
    }
  }

  /**
   * Set up Chrome alarm
   */
  private async setupAlarm(scheduleId: string, when: number): Promise<void> {
    try {
      const alarmName = `schedule_${scheduleId}`
      await chrome.alarms.create(alarmName, { when })
      this.logger.info('Alarm set up', { scheduleId, when })
    } catch (error) {
      this.logger.error('Failed to set up alarm', { scheduleId, when, error })
      throw new SchedulingError(
        'Failed to create alarm',
        SCHEDULING_ERROR_CODES.ALARM_CREATION_FAILED,
        { scheduleId, when, error: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Clear Chrome alarm
   */
  private async clearAlarm(scheduleId: string): Promise<void> {
    try {
      const alarmName = `schedule_${scheduleId}`
      await chrome.alarms.clear(alarmName)
      this.logger.info('Alarm cleared', { scheduleId })
    } catch (error) {
      this.logger.error('Failed to clear alarm', { scheduleId, error })
      // Don't throw here as it's not critical
    }
  }

  /**
   * Execute script with retry logic
   */
  private async executeScriptWithRetry(
    schedule: ActiveSchedule,
    context: ExecutionContext
  ): Promise<ScheduleExecutionResult> {
    const startTime = Date.now()
    let lastError: ScheduleExecutionError | undefined

    for (let attempt = 0; attempt <= schedule.config.maxRetries; attempt++) {
      try {
        this.logger.info('Executing script', {
          scheduleId: schedule.config.id,
          scriptId: schedule.config.scriptId,
          attempt: attempt + 1,
          maxRetries: schedule.config.maxRetries
        })

        // Get current active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
        const tabId = tabs[0]?.id

        if (!tabId) {
          throw new SchedulingError(
            'No active tab found',
            SCHEDULING_ERROR_CODES.EXECUTION_FAILED,
            { context }
          )
        }

        // Execute script
        const result = await this.scriptManager.executeScript(schedule.config.scriptId, tabId)

        const endTime = Date.now()
        const duration = endTime - startTime

        return {
          executionId: context.executionId,
          scheduleId: schedule.config.id,
          scriptId: schedule.config.scriptId,
          success: true,
          startTime,
          endTime,
          duration,
          metadata: context.metadata
        }
      } catch (error) {
        lastError = {
          code: error instanceof SchedulingError ? error.code : SCHEDULING_ERROR_CODES.EXECUTION_FAILED,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          context: { scheduleId: schedule.config.id, attempt: attempt + 1 },
          retryable: attempt < schedule.config.maxRetries,
          timestamp: Date.now()
        }

        this.logger.warn('Script execution failed', {
          scheduleId: schedule.config.id,
          attempt: attempt + 1,
          maxRetries: schedule.config.maxRetries,
          error: lastError
        })

        // Wait before retry
        if (attempt < schedule.config.maxRetries) {
          await this.delay(schedule.config.retryDelay)
        }
      }
    }

    // All retries failed
    const endTime = Date.now()
    const duration = endTime - startTime

    return {
      executionId: context.executionId,
      scheduleId: schedule.config.id,
      scriptId: schedule.config.scriptId,
      success: false,
      startTime,
      endTime,
      duration,
      error: lastError,
      metadata: context.metadata
    }
  }

  /**
   * Validate schedule configuration
   */
  private async validateScheduleConfig(config: ScheduleConfig): Promise<ScheduleValidationResult> {
    const errors: ScheduleValidationError[] = []
    const warnings: ScheduleValidationWarning[] = []

    // Validate required fields
    if (!config.id) {
      errors.push({
        field: 'id',
        code: 'REQUIRED_FIELD_MISSING',
        message: 'Schedule ID is required'
      })
    }

    if (!config.scriptId) {
      errors.push({
        field: 'scriptId',
        code: 'REQUIRED_FIELD_MISSING',
        message: 'Script ID is required'
      })
    }

    if (!config.name || config.name.trim().length === 0) {
      errors.push({
        field: 'name',
        code: 'REQUIRED_FIELD_MISSING',
        message: 'Schedule name is required'
      })
    }

    // Validate name length
    if (config.name && config.name.length > SCHEDULING_LIMITS.MAX_SCHEDULE_NAME_LENGTH) {
      errors.push({
        field: 'name',
        code: 'INVALID_VALUE',
        message: `Schedule name must be less than ${SCHEDULING_LIMITS.MAX_SCHEDULE_NAME_LENGTH} characters`,
        value: config.name
      })
    }

    // Validate mode-specific fields
    switch (config.mode) {
      case 'once':
        if (!config.executeAt || config.executeAt <= Date.now()) {
          errors.push({
            field: 'executeAt',
            code: 'INVALID_VALUE',
            message: 'Execute time must be in the future',
            value: config.executeAt
          })
        }
        break

      case 'interval':
        if (!config.intervalMs || config.intervalMs < SCHEDULING_LIMITS.MIN_INTERVAL_MS) {
          errors.push({
            field: 'intervalMs',
            code: 'INVALID_VALUE',
            message: `Interval must be at least ${SCHEDULING_LIMITS.MIN_INTERVAL_MS}ms`,
            value: config.intervalMs
          })
        }
        break

      case 'cron':
        if (!config.cronExpression) {
          errors.push({
            field: 'cronExpression',
            code: 'REQUIRED_FIELD_MISSING',
            message: 'Cron expression is required'
          })
        } else if (!this.isValidCronExpression(config.cronExpression)) {
          errors.push({
            field: 'cronExpression',
            code: 'INVALID_CRON_EXPRESSION',
            message: 'Invalid cron expression',
            value: config.cronExpression
          })
        }
        break
    }

    // Validate timezone
    if (config.timezone && !SUPPORTED_TIMEZONES.includes(config.timezone as SupportedTimezone)) {
      warnings.push({
        field: 'timezone',
        code: 'UNSUPPORTED_TIMEZONE',
        message: 'Timezone may not be fully supported',
        value: config.timezone
      })
    }

    // Validate retry settings
    if (config.maxRetries > SCHEDULING_LIMITS.MAX_RETRIES) {
      errors.push({
        field: 'maxRetries',
        code: 'INVALID_VALUE',
        message: `Max retries cannot exceed ${SCHEDULING_LIMITS.MAX_RETRIES}`,
        value: config.maxRetries
      })
    }

    if (config.timeout > SCHEDULING_LIMITS.MAX_TIMEOUT_MS) {
      errors.push({
        field: 'timeout',
        code: 'INVALID_VALUE',
        message: `Timeout cannot exceed ${SCHEDULING_LIMITS.MAX_TIMEOUT_MS}ms`,
        value: config.timeout
      })
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Check if cron expression is valid
   */
  private isValidCronExpression(expression: string): boolean {
    // Simplified validation - in production, use a proper cron library
    const parts = expression.trim().split(/\s+/)
    return parts.length >= 5 && parts.length <= 6
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Create empty stats object
   */
  private createEmptyStats(): SchedulerStats {
    return {
      totalSchedules: 0,
      activeSchedules: 0,
      pausedSchedules: 0,
      disabledSchedules: 0,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      uptime: 0
    }
  }

  /**
   * Update scheduler statistics
   */
  private updateStats(): void {
    const schedules = Array.from(this.activeSchedules.values())
    
    this.stats.totalSchedules = schedules.length
    this.stats.activeSchedules = schedules.filter(s => s.status === 'active').length
    this.stats.pausedSchedules = schedules.filter(s => s.status === 'paused').length
    this.stats.disabledSchedules = schedules.filter(s => s.status === 'disabled').length
    this.stats.totalExecutions = schedules.reduce((sum, s) => sum + s.executionCount, 0)
    this.stats.failedExecutions = schedules.reduce((sum, s) => sum + s.failureCount, 0)
    this.stats.successfulExecutions = this.stats.totalExecutions - this.stats.failedExecutions
    
    // Calculate average execution time
    const totalTime = schedules.reduce((sum, s) => {
      // This would need to be calculated from execution history
      return sum
    }, 0)
    this.stats.averageExecutionTime = this.stats.totalExecutions > 0 ? totalTime / this.stats.totalExecutions : 0
  }

  /**
   * Persist active schedule to storage
   */
  private async persistActiveSchedule(schedule: ActiveSchedule): Promise<void> {
    try {
      const schedules = await this.storageManager.get<Record<string, ActiveSchedule>>('active_schedules') || {}
      schedules[schedule.config.id] = schedule
      await this.storageManager.set('active_schedules', schedules)
    } catch (error) {
      this.logger.error('Failed to persist active schedule', { 
        scheduleId: schedule.config.id, 
        error 
      })
      throw error
    }
  }

  /**
   * Store execution result
   */
  private async storeExecutionResult(result: ScheduleExecutionResult): Promise<void> {
    try {
      const history = this.executionHistory.get(result.scheduleId) || {
        id: result.scheduleId,
        scheduleId: result.scheduleId,
        executions: [],
        totalExecutions: 0,
        successCount: 0,
        failureCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      history.executions.push(result)
      history.totalExecutions++
      if (result.success) {
        history.successCount++
      } else {
        history.failureCount++
      }
      history.lastExecution = result.endTime
      history.updatedAt = Date.now()

      // Keep only last N executions
      if (history.executions.length > SCHEDULING_LIMITS.MAX_EXECUTION_HISTORY) {
        history.executions = history.executions.slice(-SCHEDULING_LIMITS.MAX_EXECUTION_HISTORY)
      }

      this.executionHistory.set(result.scheduleId, history)

      // Persist to storage
      const allHistory = await this.storageManager.get<Record<string, ScheduleExecutionHistory>>('execution_history') || {}
      allHistory[result.scheduleId] = history
      await this.storageManager.set('execution_history', allHistory)
    } catch (error) {
      this.logger.error('Failed to store execution result', { 
        executionId: result.executionId, 
        error 
      })
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}