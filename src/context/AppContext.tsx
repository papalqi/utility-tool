/**
 * 应用全局Context
 * 用于在不同Widget之间共享状态
 */

/* eslint-disable react/prop-types */
import { createContext, useContext, useState, useRef, useEffect, useMemo, ReactNode } from 'react'
import type { TodoItem } from '../shared/types'

export type PomodoroMode = 'work' | 'short_break' | 'long_break'

export interface PomodoroState {
  mode: PomodoroMode
  timeRemaining: number
  isRunning: boolean
  sessionCount: number
  currentTask: TodoItem | null
  workContent: string
}

interface AppContextType {
  // Settings Drawer Control
  isSettingsOpen: boolean
  setIsSettingsOpen: (isOpen: boolean) => void

  // Pomodoro 共享状态
  pomodoroState: PomodoroState
  pomodoroActions: {
    start: (task?: TodoItem | null) => void
    pause: () => void
    reset: (workDuration?: number) => void
    skip: (shortBreak?: number, longBreak?: number, interval?: number) => void
    setTask: (task: TodoItem | null) => void
    setWorkContent: (content: string) => void
  }

  // 兼容旧 API
  currentPomodoroTask: TodoItem | null
  setCurrentPomodoroTask: (task: TodoItem | null) => void
  startPomodoroWithTask: (task: TodoItem) => void
}

const DEFAULT_WORK_DURATION = 25 * 60
const DEFAULT_SHORT_BREAK = 5 * 60
const DEFAULT_LONG_BREAK = 15 * 60
const DEFAULT_LONG_BREAK_INTERVAL = 4

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Pomodoro 全局状态
  const [pomodoroState, setPomodoroState] = useState<PomodoroState>({
    mode: 'work',
    timeRemaining: DEFAULT_WORK_DURATION,
    isRunning: false,
    sessionCount: 0,
    currentTask: null,
    workContent: '',
  })

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  // 计时器 tick
  useEffect(() => {
    if (pomodoroState.isRunning) {
      timerRef.current = setInterval(() => {
        setPomodoroState((prev) => {
          if (prev.timeRemaining <= 1) {
            // 会话完成
            clearInterval(timerRef.current!)
            timerRef.current = null

            const newSessionCount = prev.mode === 'work' ? prev.sessionCount + 1 : prev.sessionCount
            let nextMode: PomodoroMode = 'work'
            let nextTime = DEFAULT_WORK_DURATION

            if (prev.mode === 'work') {
              if (newSessionCount % DEFAULT_LONG_BREAK_INTERVAL === 0) {
                nextMode = 'long_break'
                nextTime = DEFAULT_LONG_BREAK
              } else {
                nextMode = 'short_break'
                nextTime = DEFAULT_SHORT_BREAK
              }
            }

            return {
              ...prev,
              mode: nextMode,
              timeRemaining: nextTime,
              isRunning: false,
              sessionCount: newSessionCount,
              workContent: prev.mode === 'work' ? '' : prev.workContent,
            }
          }
          return { ...prev, timeRemaining: prev.timeRemaining - 1 }
        })
      }, 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [pomodoroState.isRunning])

  const pomodoroActions = useMemo(() => ({
    start: (task?: TodoItem | null) => {
      setPomodoroState((prev) => {
        const activeTask = task || prev.currentTask
        const content = task?.text || prev.workContent || prev.currentTask?.text || ''
        return {
          ...prev,
          isRunning: true,
          currentTask: activeTask || null,
          workContent: content,
        }
      })
    },

    pause: () => {
      setPomodoroState((prev) => ({ ...prev, isRunning: false }))
    },

    reset: (workDuration: number = 25) => {
      setPomodoroState({
        mode: 'work',
        timeRemaining: workDuration * 60,
        isRunning: false,
        sessionCount: 0,
        currentTask: null,
        workContent: '',
      })
    },

    skip: (shortBreak = 5, longBreak = 15, interval = 4) => {
      setPomodoroState((prev) => {
        const newSessionCount = prev.mode === 'work' ? prev.sessionCount + 1 : prev.sessionCount
        let nextMode: PomodoroMode = 'work'
        let nextTime = DEFAULT_WORK_DURATION

        if (prev.mode === 'work') {
          if (newSessionCount % interval === 0) {
            nextMode = 'long_break'
            nextTime = longBreak * 60
          } else {
            nextMode = 'short_break'
            nextTime = shortBreak * 60
          }
        }

        return {
          ...prev,
          mode: nextMode,
          timeRemaining: nextTime,
          isRunning: false,
          sessionCount: newSessionCount,
          workContent: prev.mode === 'work' ? '' : prev.workContent,
        }
      })
    },

    setTask: (task: TodoItem | null) => {
      setPomodoroState((prev) => ({
        ...prev,
        currentTask: task,
        workContent: task?.text || prev.workContent,
      }))
    },

    setWorkContent: (content: string) => {
      setPomodoroState((prev) => ({ ...prev, workContent: content }))
    },
  }), [])

  // 兼容旧 API
  const currentPomodoroTask = pomodoroState.currentTask
  const setCurrentPomodoroTask = pomodoroActions.setTask
  const startPomodoroWithTask = (task: TodoItem) => {
    pomodoroActions.setTask(task)
  }

  return (
    <AppContext.Provider
      value={{
        isSettingsOpen,
        setIsSettingsOpen,
        pomodoroState,
        pomodoroActions,
        currentPomodoroTask,
        setCurrentPomodoroTask,
        startPomodoroWithTask,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useAppContext = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider')
  }
  return context
}
