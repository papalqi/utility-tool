/**
 * Pomodoro 状态管理 Hook
 * 提供全局 Pomodoro 计时器状态和操作
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { TodoItem } from '@/shared/types'

export type PomodoroMode = 'work' | 'short_break' | 'long_break'

export interface PomodoroState {
  mode: PomodoroMode
  timeRemaining: number // 剩余时间（秒）
  isRunning: boolean
  sessionCount: number // 已完成的工作会话数
  workContent: string // 当前工作内容
}

export interface PomodoroActions {
  /** 设置关联的任务 */
  setTask: (task: TodoItem) => void
  /** 开始计时 */
  start: (linkedTask?: TodoItem | null) => void
  /** 暂停计时 */
  pause: () => void
  /** 重置计时器 */
  reset: (workDuration: number) => void
  /** 跳过当前阶段 */
  skip: (shortBreakDuration: number, longBreakDuration: number, longBreakInterval: number) => void
  /** 设置工作内容 */
  setWorkContent: (content: string) => void
}

const DEFAULT_WORK_DURATION = 25 * 60 // 25 分钟，单位：秒
const DEFAULT_SHORT_BREAK = 5 * 60 // 5 分钟
const DEFAULT_LONG_BREAK = 15 * 60 // 15 分钟
const DEFAULT_LONG_BREAK_INTERVAL = 4 // 每 4 个工作会话后长休息

export function usePomodoro(): { state: PomodoroState; actions: PomodoroActions } {
  const [mode, setMode] = useState<PomodoroMode>('work')
  const [timeRemaining, setTimeRemaining] = useState(DEFAULT_WORK_DURATION)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)
  const [workContent, setWorkContent] = useState('')

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const workDurationRef = useRef(DEFAULT_WORK_DURATION)
  const shortBreakDurationRef = useRef(DEFAULT_SHORT_BREAK)
  const longBreakDurationRef = useRef(DEFAULT_LONG_BREAK)
  const longBreakIntervalRef = useRef(DEFAULT_LONG_BREAK_INTERVAL)

  // 清理定时器
  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // 启动定时器
  const startTimer = useCallback(() => {
    clearTimer()
    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // 时间到，切换到下一个阶段
          clearTimer()
          setIsRunning(false)

          if (mode === 'work') {
            // 工作完成，增加会话计数
            setSessionCount((count) => {
              const newCount = count + 1
              // 判断是否需要长休息
              if (newCount % longBreakIntervalRef.current === 0) {
                setMode('long_break')
                setTimeRemaining(longBreakDurationRef.current)
              } else {
                setMode('short_break')
                setTimeRemaining(shortBreakDurationRef.current)
              }
              return newCount
            })
          } else {
            // 休息结束，回到工作模式
            setMode('work')
            setTimeRemaining(workDurationRef.current)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [mode, clearTimer])

  // 设置任务
  const setTask = useCallback((task: TodoItem) => {
    setWorkContent(task.text || '')
  }, [])

  // 开始计时
  const start = useCallback(
    (linkedTask?: TodoItem | null) => {
      if (linkedTask) {
        setTask(linkedTask)
      }
      setIsRunning(true)
      startTimer()
    },
    [setTask, startTimer]
  )

  // 暂停计时
  const pause = useCallback(() => {
    setIsRunning(false)
    clearTimer()
  }, [clearTimer])

  // 重置计时器
  const reset = useCallback(
    (workDuration: number) => {
      workDurationRef.current = workDuration * 60 // 转换为秒
      setMode('work')
      setTimeRemaining(workDurationRef.current)
      setIsRunning(false)
      clearTimer()
    },
    [clearTimer]
  )

  // 跳过当前阶段
  const skip = useCallback(
    (shortBreakDuration: number, longBreakDuration: number, longBreakInterval: number) => {
      shortBreakDurationRef.current = shortBreakDuration * 60
      longBreakDurationRef.current = longBreakDuration * 60
      longBreakIntervalRef.current = longBreakInterval

      clearTimer()
      setIsRunning(false)

      if (mode === 'work') {
        // 跳过工作，直接进入休息
        setSessionCount((count) => {
          const newCount = count + 1
          if (newCount % longBreakInterval === 0) {
            setMode('long_break')
            setTimeRemaining(longBreakDuration * 60)
          } else {
            setMode('short_break')
            setTimeRemaining(shortBreakDuration * 60)
          }
          return newCount
        })
      } else {
        // 跳过休息，回到工作
        setMode('work')
        setTimeRemaining(workDurationRef.current)
      }
    },
    [mode, clearTimer]
  )

  // 设置工作内容
  const setWorkContentAction = useCallback((content: string) => {
    setWorkContent(content)
  }, [])

  // 当 isRunning 变化时，启动或停止定时器
  useEffect(() => {
    if (isRunning) {
      startTimer()
    } else {
      clearTimer()
    }
    return () => clearTimer()
  }, [isRunning, startTimer, clearTimer])

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  const state: PomodoroState = {
    mode,
    timeRemaining,
    isRunning,
    sessionCount,
    workContent,
  }

  const actions: PomodoroActions = {
    setTask,
    start,
    pause,
    reset,
    skip,
    setWorkContent: setWorkContentAction,
  }

  return { state, actions }
}

