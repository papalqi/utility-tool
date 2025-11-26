/**
 * ThemeContext - 主题管理上下文
 *
 * 使用 React Context + Ant Design ConfigProvider
 * 实现全局主题切换和自动时间切换
 *
 * 对应 Python 版本：src/core/theme_manager.py
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react'
import { ConfigProvider, theme as antdTheme } from 'antd'
import { logger } from '@/core/Logger'

export type ThemeMode = 'light' | 'dark'

interface ThemeColors {
  // Primary colors
  primary: string
  primaryDark: string
  primaryLight: string

  // Background colors
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string

  // Text colors
  textPrimary: string
  textSecondary: string

  // Border colors
  borderPrimary: string

  // Status colors
  success: string
  warning: string
  danger: string
  info: string

  // Calendar colors
  calendarBorder: string
  calendarHeaderBg: string
  calendarHeaderText: string
  calendarDayText: string
  calendarTodayBg: string
  calendarTodayText: string
  calendarTimeText: string
  calendarHoverBg: string

  // Terminal colors
  terminalBg: string
  terminalFg: string
  terminalCursor: string
  terminalSelection: string
  terminalBlack: string
  terminalRed: string
  terminalGreen: string
  terminalYellow: string
  terminalBlue: string
  terminalMagenta: string
  terminalCyan: string
  terminalWhite: string
  terminalBrightBlack: string
  terminalBrightRed: string
  terminalBrightGreen: string
  terminalBrightYellow: string
  terminalBrightBlue: string
  terminalBrightMagenta: string
  terminalBrightCyan: string
  terminalBrightWhite: string

  // Special colors
  starYellow: string
  codeBg: string
  codeText: string
  eventTextPrimary: string
  eventTextSecondary: string
  eventBg: string
}

interface ThemeContextValue {
  mode: ThemeMode
  colors: ThemeColors
  setTheme: (mode: ThemeMode) => void
  toggleTheme: () => void
  enableAutoSwitch: (darkStart?: string, lightStart?: string) => void
  disableAutoSwitch: () => void
  isAutoSwitch: boolean
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

// 亮色主题颜色
const lightColors: ThemeColors = {
  primary: '#3498db',
  primaryDark: '#2980b9',
  primaryLight: '#5dade2',
  bgPrimary: '#f5f7fa', // 柔和的背景
  bgSecondary: '#ffffff', // 卡片背景
  bgTertiary: '#eef0f5', // 提升背景
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  borderPrimary: '#e5e7eb',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  // Calendar colors
  calendarBorder: 'rgba(0, 0, 0, 0.1)',
  calendarHeaderBg: 'rgba(0, 0, 0, 0.02)',
  calendarHeaderText: 'rgba(0, 0, 0, 0.88)',
  calendarDayText: 'rgba(0, 0, 0, 0.65)',
  calendarTodayBg: 'rgba(22, 119, 255, 0.1)',
  calendarTodayText: '#1677ff',
  calendarTimeText: 'rgba(0, 0, 0, 0.45)',
  calendarHoverBg: 'rgba(0, 0, 0, 0.02)',
  // Terminal colors - Light theme
  terminalBg: '#f5f5f5',
  terminalFg: '#1f2937',
  terminalCursor: '#1f2937',
  terminalSelection: 'rgba(0, 0, 0, 0.2)',
  terminalBlack: '#000000',
  terminalRed: '#c91b00',
  terminalGreen: '#00a600',
  terminalYellow: '#c7c400',
  terminalBlue: '#0037da',
  terminalMagenta: '#bc05bc',
  terminalCyan: '#0087c3',
  terminalWhite: '#c0c0c0',
  terminalBrightBlack: '#767676',
  terminalBrightRed: '#e74856',
  terminalBrightGreen: '#16c60c',
  terminalBrightYellow: '#f9f1a5',
  terminalBrightBlue: '#3b78ff',
  terminalBrightMagenta: '#b4009e',
  terminalBrightCyan: '#61d6d6',
  terminalBrightWhite: '#f2f2f2',
  // Special colors
  starYellow: '#faad14',
  codeBg: '#f5f5f5',
  codeText: '#1f2937',
  eventTextPrimary: '#ffffff',
  eventTextSecondary: 'rgba(255, 255, 255, 0.85)',
  eventBg: 'rgba(0, 0, 0, 0.02)',
}

// 暗色主题颜色
const darkColors: ThemeColors = {
  primary: '#60a5fa', // 更明亮的蓝
  primaryDark: '#3b82f6',
  primaryLight: '#93c5fd',
  bgPrimary: '#09090b', // 深邃黑背景 rgba(9, 9, 11)
  bgSecondary: '#0f0f11', // 更深的次级背景
  bgTertiary: '#18181b', // 提升背景
  textPrimary: '#f3f4f6',
  textSecondary: '#9ca3af',
  borderPrimary: '#27272a', // 更深的边框色
  success: '#34d399',
  warning: '#fbbf24',
  danger: '#f87171',
  info: '#60a5fa',
  // Calendar colors
  calendarBorder: 'rgba(255, 255, 255, 0.1)',
  calendarHeaderBg: 'rgba(0, 0, 0, 0.3)',
  calendarHeaderText: 'rgba(255, 255, 255, 0.85)',
  calendarDayText: 'rgba(255, 255, 255, 0.65)',
  calendarTodayBg: 'rgba(22, 119, 255, 0.08)',
  calendarTodayText: '#1677ff',
  calendarTimeText: 'rgba(255, 255, 255, 0.45)',
  calendarHoverBg: 'rgba(255, 255, 255, 0.03)',
  // Terminal colors - Dark theme (VS Code Dark+)
  terminalBg: '#1e1e1e',
  terminalFg: '#cccccc',
  terminalCursor: '#ffffff',
  terminalSelection: 'rgba(255, 255, 255, 0.3)',
  terminalBlack: '#000000',
  terminalRed: '#cd3131',
  terminalGreen: '#0dbc79',
  terminalYellow: '#e5e510',
  terminalBlue: '#2472c8',
  terminalMagenta: '#bc3fbc',
  terminalCyan: '#11a8cd',
  terminalWhite: '#e5e5e5',
  terminalBrightBlack: '#666666',
  terminalBrightRed: '#f14c4c',
  terminalBrightGreen: '#23d18b',
  terminalBrightYellow: '#f5f543',
  terminalBrightBlue: '#3b8eea',
  terminalBrightMagenta: '#d670d6',
  terminalBrightCyan: '#29b8db',
  terminalBrightWhite: '#ffffff',
  // Special colors
  starYellow: '#fbbf24',
  codeBg: '#0f0f0f',
  codeText: '#f5f5f5',
  eventTextPrimary: '#ffffff',
  eventTextSecondary: 'rgba(255, 255, 255, 0.85)',
  eventBg: 'rgba(255, 255, 255, 0.03)',
}

interface ThemeProviderProps {
  children: ReactNode
  initialTheme?: ThemeMode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialTheme = 'dark',
}) => {
  const [mode, setMode] = useState<ThemeMode>(initialTheme)
  const [isAutoSwitch, setIsAutoSwitch] = useState(false)
  const autoSwitchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 获取当前主题颜色
  const colors = mode === 'dark' ? darkColors : lightColors

  // 设置主题
  const setTheme = (newMode: ThemeMode) => {
    if (newMode !== mode) {
      setMode(newMode)
      applyThemeToDocument(newMode)
      logger.info(`Theme changed to: ${newMode}`)

      // 保存到配置
      saveThemeToConfig(newMode)
    }
  }

  // 切换主题
  const toggleTheme = () => {
    setTheme(mode === 'dark' ? 'light' : 'dark')
  }

  // 启用自动切换
  const enableAutoSwitch = (darkStart = '18:00', lightStart = '08:00') => {
    setIsAutoSwitch(true)

    const checkAndSwitch = () => {
      const now = new Date()
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

      if (currentTime >= darkStart || currentTime < lightStart) {
        setTheme('dark')
      } else {
        setTheme('light')
      }
    }

    // 立即检查一次
    checkAndSwitch()

    // 每分钟检查一次
    if (autoSwitchTimerRef.current) {
      clearInterval(autoSwitchTimerRef.current)
    }
    autoSwitchTimerRef.current = setInterval(checkAndSwitch, 60000)

    logger.info('Auto theme switch enabled', { darkStart, lightStart })
  }

  // 禁用自动切换
  const disableAutoSwitch = () => {
    setIsAutoSwitch(false)
    if (autoSwitchTimerRef.current) {
      clearInterval(autoSwitchTimerRef.current)
      autoSwitchTimerRef.current = null
    }
    logger.info('Auto theme switch disabled')
  }

  // 应用主题到文档
  const applyThemeToDocument = (theme: ThemeMode) => {
    document.documentElement.setAttribute('data-theme', theme)

    // 设置 CSS 变量
    const root = document.documentElement
    const themeColors = theme === 'dark' ? darkColors : lightColors

    root.style.setProperty('--color-primary', themeColors.primary)
    root.style.setProperty('--color-bg-primary', themeColors.bgPrimary)
    root.style.setProperty('--color-bg-secondary', themeColors.bgSecondary)
    root.style.setProperty('--color-text-primary', themeColors.textPrimary)
    root.style.setProperty('--color-text-secondary', themeColors.textSecondary)
    root.style.setProperty('--color-border', themeColors.borderPrimary)

    // Calendar colors
    root.style.setProperty('--calendar-border', themeColors.calendarBorder)
    root.style.setProperty('--calendar-header-bg', themeColors.calendarHeaderBg)
    root.style.setProperty('--calendar-header-text', themeColors.calendarHeaderText)
    root.style.setProperty('--calendar-day-text', themeColors.calendarDayText)
    root.style.setProperty('--calendar-today-bg', themeColors.calendarTodayBg)
    root.style.setProperty('--calendar-today-text', themeColors.calendarTodayText)
    root.style.setProperty('--calendar-time-text', themeColors.calendarTimeText)
    root.style.setProperty('--calendar-hover-bg', themeColors.calendarHoverBg)

    // Terminal colors
    root.style.setProperty('--terminal-bg', themeColors.terminalBg)
    root.style.setProperty('--terminal-fg', themeColors.terminalFg)
    root.style.setProperty('--terminal-cursor', themeColors.terminalCursor)
    root.style.setProperty('--terminal-selection', themeColors.terminalSelection)

    // Special colors
    root.style.setProperty('--color-star-yellow', themeColors.starYellow)
    root.style.setProperty('--color-code-bg', themeColors.codeBg)
    root.style.setProperty('--color-code-text', themeColors.codeText)
    root.style.setProperty('--color-event-text-primary', themeColors.eventTextPrimary)
    root.style.setProperty('--color-event-text-secondary', themeColors.eventTextSecondary)
    root.style.setProperty('--color-event-bg', themeColors.eventBg)

    // Glassmorphism variables
    const glassBg = theme === 'dark' ? 'rgba(9, 9, 11, 0.8)' : 'rgba(255, 255, 255, 0.7)'
    const glassBorder = theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.4)'
    root.style.setProperty('--glass-bg', glassBg)
    root.style.setProperty('--glass-border', glassBorder)
    root.style.setProperty('--glass-backdrop', 'blur(12px)')
  }

  // 保存主题到配置
  const saveThemeToConfig = async (theme: ThemeMode) => {
    try {
      if (window.electronAPI) {
        const config = (await window.electronAPI.loadConfig()) as {
          theme: { current: ThemeMode; auto_switch: boolean }
        } & Record<string, unknown>
        if (config) {
          config.theme.current = theme
          await window.electronAPI.saveConfig(config)
        }
      }
    } catch (error) {
      logger.error('Failed to save theme to config', error)
    }
  }

  // 当 mode 变化时应用主题
  useEffect(() => {
    applyThemeToDocument(mode)
  }, [mode])

  // 初始化时从配置加载主题设置（仅运行一次）
  useEffect(() => {
    const loadThemeFromConfig = async () => {
      try {
        if (window.electronAPI) {
          const config = (await window.electronAPI.loadConfig()) as {
            theme?: {
              current: ThemeMode
              auto_switch: boolean
              dark_mode_start_time?: string
              light_mode_start_time?: string
            }
          }
          if (config?.theme) {
            setMode(config.theme.current)
            if (config.theme.auto_switch) {
              enableAutoSwitch(
                config.theme.dark_mode_start_time,
                config.theme.light_mode_start_time
              )
            }
          }
        }
      } catch (error) {
        logger.error('Failed to load theme from config', error)
      }
    }

    loadThemeFromConfig()

    // 清理定时器
    return () => {
      if (autoSwitchTimerRef.current) {
        clearInterval(autoSwitchTimerRef.current)
        autoSwitchTimerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ant Design 主题配置
  const antdThemeConfig = {
    algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: colors.primary,
      colorSuccess: colors.success,
      colorWarning: colors.warning,
      colorError: colors.danger,
      colorInfo: colors.info,
      borderRadius: 8,
      colorBgContainer: colors.bgSecondary,
      colorBgElevated: colors.bgTertiary,
    },
    components: {
      Alert: {
        borderRadiusLG: 8,
        paddingContentVerticalLG: 12,
        paddingContentHorizontalLG: 16,
        // 自定义颜色 - 使用半透明背景
        colorInfoBg: mode === 'dark' ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.1)',
        colorInfoBorder: '#3b82f6',
        colorSuccessBg: mode === 'dark' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.1)',
        colorSuccessBorder: '#10b981',
        colorWarningBg: mode === 'dark' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.1)',
        colorWarningBorder: '#f59e0b',
        colorErrorBg: mode === 'dark' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(239, 68, 68, 0.1)',
        colorErrorBorder: '#ef4444',
      },
    },
  }

  const value: ThemeContextValue = {
    mode,
    colors,
    setTheme,
    toggleTheme,
    enableAutoSwitch,
    disableAutoSwitch,
    isAutoSwitch,
  }

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={antdThemeConfig}>{children}</ConfigProvider>
    </ThemeContext.Provider>
  )
}

/**
 * 使用主题的 Hook
 */
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

export default ThemeContext
