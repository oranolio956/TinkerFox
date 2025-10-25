/**
 * ScriptFlow Scheduling Store Hook
 * 
 * Zustand store for scheduling state management with comprehensive
 * error handling and type safety
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type {
  ScheduleConfig,
  ActiveSchedule,
  ScheduleExecutionResult,
  SchedulerStats,
  ScheduleValidationResult,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  ExecuteScheduleRequest,
  ScheduleQueryOptions,
  ScheduleStatus,
  ScheduleMode
} from '@/types/scheduling'
import { SchedulingError, SCHEDULING_ERROR_CODES } from '@/types/scheduling'

interface SchedulingState {
  // State
  schedules: ActiveSchedule[]
  stats: SchedulerStats | null
  loading: boolean
  error: string | null
  lastUpdated: number

  // Actions
  loadSchedules: (options?: ScheduleQueryOptions) => Promise<void>
  createSchedule: (request: CreateScheduleRequest) => Promise<ActiveSchedule>
  updateSchedule: (request: UpdateScheduleRequest) => Promise<ActiveSchedule>
  deleteSchedule: (scheduleId: string) => Promise<void>
  executeSchedule: (request: ExecuteScheduleRequest) => Promise<ScheduleExecutionResult>
  pauseSchedule: (scheduleId: string) => Promise<void>
  resumeSchedule: (scheduleId: string) => Promise<void>
  validateSchedule: (config: Partial<ScheduleConfig>) => Promise<ScheduleValidationResult>
  
  // Utility actions
  clearError: () => void
  refreshStats: () => Promise<void>
  getScheduleById: (scheduleId: string) => ActiveSchedule | undefined
  getSchedulesByScript: (scriptId: string) => ActiveSchedule[]
  getSchedulesByStatus: (status: ScheduleStatus) => ActiveSchedule[]
  getSchedulesByMode: (mode: ScheduleMode) => ActiveSchedule[]
}

export const useSchedulingStore = create<SchedulingState>()(
  devtools(
    (set, get) => ({
      // Initial state
      schedules: [],
      stats: null,
      loading: false,
      error: null,
      lastUpdated: 0,

      // Load schedules
      loadSchedules: async (options = {}) => {
        set({ loading: true, error: null })

        try {
          const response = await chrome.runtime.sendMessage({
            type: 'GET_SCHEDULES',
            payload: options
          })

          if (response.success) {
            set({
              schedules: response.data.schedules || [],
              stats: response.data.stats || null,
              loading: false,
              lastUpdated: Date.now()
            })
          } else {
            throw new SchedulingError(
              response.error || 'Failed to load schedules',
              SCHEDULING_ERROR_CODES.SYSTEM_ERROR
            )
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          set({
            error: errorMessage,
            loading: false
          })
          console.error('Failed to load schedules:', error)
        }
      },

      // Create schedule
      createSchedule: async (request) => {
        set({ loading: true, error: null })

        try {
          const response = await chrome.runtime.sendMessage({
            type: 'CREATE_SCHEDULE',
            payload: request
          })

          if (response.success) {
            const newSchedule = response.data
            set(state => ({
              schedules: [...state.schedules, newSchedule],
              loading: false,
              lastUpdated: Date.now()
            }))
            return newSchedule
          } else {
            throw new SchedulingError(
              response.error || 'Failed to create schedule',
              SCHEDULING_ERROR_CODES.SYSTEM_ERROR
            )
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          set({
            error: errorMessage,
            loading: false
          })
          throw error
        }
      },

      // Update schedule
      updateSchedule: async (request) => {
        set({ loading: true, error: null })

        try {
          const response = await chrome.runtime.sendMessage({
            type: 'UPDATE_SCHEDULE',
            payload: request
          })

          if (response.success) {
            const updatedSchedule = response.data
            set(state => ({
              schedules: state.schedules.map(schedule =>
                schedule.config.id === request.id ? updatedSchedule : schedule
              ),
              loading: false,
              lastUpdated: Date.now()
            }))
            return updatedSchedule
          } else {
            throw new SchedulingError(
              response.error || 'Failed to update schedule',
              SCHEDULING_ERROR_CODES.SYSTEM_ERROR
            )
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          set({
            error: errorMessage,
            loading: false
          })
          throw error
        }
      },

      // Delete schedule
      deleteSchedule: async (scheduleId) => {
        set({ loading: true, error: null })

        try {
          const response = await chrome.runtime.sendMessage({
            type: 'DELETE_SCHEDULE',
            payload: { scheduleId }
          })

          if (response.success) {
            set(state => ({
              schedules: state.schedules.filter(schedule => schedule.config.id !== scheduleId),
              loading: false,
              lastUpdated: Date.now()
            }))
          } else {
            throw new SchedulingError(
              response.error || 'Failed to delete schedule',
              SCHEDULING_ERROR_CODES.SYSTEM_ERROR
            )
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          set({
            error: errorMessage,
            loading: false
          })
          throw error
        }
      },

      // Execute schedule
      executeSchedule: async (request) => {
        set({ loading: true, error: null })

        try {
          const response = await chrome.runtime.sendMessage({
            type: 'EXECUTE_SCHEDULE',
            payload: request
          })

          if (response.success) {
            set({ loading: false, lastUpdated: Date.now() })
            return response.data
          } else {
            throw new SchedulingError(
              response.error || 'Failed to execute schedule',
              SCHEDULING_ERROR_CODES.EXECUTION_FAILED
            )
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          set({
            error: errorMessage,
            loading: false
          })
          throw error
        }
      },

      // Pause schedule
      pauseSchedule: async (scheduleId) => {
        set({ loading: true, error: null })

        try {
          const response = await chrome.runtime.sendMessage({
            type: 'PAUSE_SCHEDULE',
            payload: { scheduleId }
          })

          if (response.success) {
            set(state => ({
              schedules: state.schedules.map(schedule =>
                schedule.config.id === scheduleId
                  ? { ...schedule, status: 'paused' as ScheduleStatus, updatedAt: Date.now() }
                  : schedule
              ),
              loading: false,
              lastUpdated: Date.now()
            }))
          } else {
            throw new SchedulingError(
              response.error || 'Failed to pause schedule',
              SCHEDULING_ERROR_CODES.SYSTEM_ERROR
            )
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          set({
            error: errorMessage,
            loading: false
          })
          throw error
        }
      },

      // Resume schedule
      resumeSchedule: async (scheduleId) => {
        set({ loading: true, error: null })

        try {
          const response = await chrome.runtime.sendMessage({
            type: 'RESUME_SCHEDULE',
            payload: { scheduleId }
          })

          if (response.success) {
            set(state => ({
              schedules: state.schedules.map(schedule =>
                schedule.config.id === scheduleId
                  ? { ...schedule, status: 'active' as ScheduleStatus, updatedAt: Date.now() }
                  : schedule
              ),
              loading: false,
              lastUpdated: Date.now()
            }))
          } else {
            throw new SchedulingError(
              response.error || 'Failed to resume schedule',
              SCHEDULING_ERROR_CODES.SYSTEM_ERROR
            )
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          set({
            error: errorMessage,
            loading: false
          })
          throw error
        }
      },

      // Validate schedule
      validateSchedule: async (config) => {
        try {
          const response = await chrome.runtime.sendMessage({
            type: 'VALIDATE_SCHEDULE',
            payload: { config }
          })

          if (response.success) {
            return response.data
          } else {
            throw new SchedulingError(
              response.error || 'Failed to validate schedule',
              SCHEDULING_ERROR_CODES.VALIDATION_FAILED
            )
          }
        } catch (error) {
          console.error('Failed to validate schedule:', error)
          throw error
        }
      },

      // Clear error
      clearError: () => {
        set({ error: null })
      },

      // Refresh stats
      refreshStats: async () => {
        try {
          const response = await chrome.runtime.sendMessage({
            type: 'GET_SCHEDULER_STATS'
          })

          if (response.success) {
            set({
              stats: response.data,
              lastUpdated: Date.now()
            })
          }
        } catch (error) {
          console.error('Failed to refresh stats:', error)
        }
      },

      // Get schedule by ID
      getScheduleById: (scheduleId) => {
        return get().schedules.find(schedule => schedule.config.id === scheduleId)
      },

      // Get schedules by script
      getSchedulesByScript: (scriptId) => {
        return get().schedules.filter(schedule => schedule.config.scriptId === scriptId)
      },

      // Get schedules by status
      getSchedulesByStatus: (status) => {
        return get().schedules.filter(schedule => schedule.status === status)
      },

      // Get schedules by mode
      getSchedulesByMode: (mode) => {
        return get().schedules.filter(schedule => schedule.config.mode === mode)
      }
    }),
    {
      name: 'scheduling-store',
      partialize: (state) => ({
        schedules: state.schedules,
        stats: state.stats,
        lastUpdated: state.lastUpdated
      })
    }
  )
)

// Auto-load schedules when store is first used
useSchedulingStore.getState().loadSchedules()