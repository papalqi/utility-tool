/**
 * 应用全局Context
 * 用于在不同Widget之间共享状态
 */

/* eslint-disable react/prop-types */
import { createContext, useContext, useState, ReactNode } from 'react'
import type { TodoItem } from '../shared/types'

interface AppContextType {
  // Settings Drawer Control
  isSettingsOpen: boolean
  setIsSettingsOpen: (isOpen: boolean) => void

  // Pomodoro相关状态
  currentPomodoroTask: TodoItem | null
  setCurrentPomodoroTask: (task: TodoItem | null) => void

  // 启动Pomodoro并切换到Pomodoro页面
  startPomodoroWithTask: (task: TodoItem) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentPomodoroTask, setCurrentPomodoroTask] = useState<TodoItem | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // 注意：startPomodoroWithTask 现在需要从外部获取 setActiveWidget
  // 这将在组件层面处理
  const startPomodoroWithTask = (task: TodoItem) => {
    setCurrentPomodoroTask(task)
    // setActiveWidget 将在使用此函数的组件中调用
  }

  return (
    <AppContext.Provider
      value={{
        isSettingsOpen,
        setIsSettingsOpen,
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
