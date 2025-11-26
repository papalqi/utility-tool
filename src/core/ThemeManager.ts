import { ThemeConfig } from '../shared/types'
import { theme as antdTheme } from 'antd'

export type ThemeMode = 'light' | 'dark'

/**
 * ThemeManager - Manages application theming
 * Supports dark/light modes and auto-switching
 */
class ThemeManager {
  private currentTheme: ThemeMode = 'dark'
  private autoSwitch: boolean = false
  private listeners: Array<(theme: ThemeMode) => void> = []
  private autoSwitchTimer: NodeJS.Timeout | null = null

  /**
   * Initialize theme manager with config
   */
  initialize(config: ThemeConfig): void {
    this.currentTheme = config.current
    this.autoSwitch = config.auto_switch

    // Apply theme
    this.applyTheme(this.currentTheme)

    // Setup auto-switch if enabled
    if (this.autoSwitch) {
      this.setupAutoSwitch(config.dark_mode_start_time, config.light_mode_start_time)
    }
  }

  /**
   * Get current theme
   */
  getTheme(): ThemeMode {
    return this.currentTheme
  }

  /**
   * Set theme
   */
  setTheme(theme: ThemeMode): void {
    if (this.currentTheme !== theme) {
      this.currentTheme = theme
      this.applyTheme(theme)
      this.notifyListeners()
    }
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme(): void {
    this.setTheme(this.currentTheme === 'dark' ? 'light' : 'dark')
  }

  /**
   * Get Ant Design theme configuration
   */
  getAntdTheme() {
    return {
      algorithm:
        this.currentTheme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: '#1890ff',
        borderRadius: 8,
        colorBgContainer: this.currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
        colorBgElevated: this.currentTheme === 'dark' ? '#2a2a2a' : '#f5f5f5',
      },
    }
  }

  /**
   * Subscribe to theme changes
   */
  subscribe(listener: (theme: ThemeMode) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * Enable auto-switching
   */
  enableAutoSwitch(darkModeStart?: string, lightModeStart?: string): void {
    this.autoSwitch = true
    this.setupAutoSwitch(darkModeStart, lightModeStart)
  }

  /**
   * Disable auto-switching
   */
  disableAutoSwitch(): void {
    this.autoSwitch = false
    if (this.autoSwitchTimer) {
      clearInterval(this.autoSwitchTimer)
      this.autoSwitchTimer = null
    }
  }

  /**
   * Apply theme to document
   */
  private applyTheme(theme: ThemeMode): void {
    document.documentElement.setAttribute('data-theme', theme)

    // Apply to body for background color
    if (theme === 'dark') {
      document.body.style.backgroundColor = '#141414'
      document.body.style.color = '#ffffff'
    } else {
      document.body.style.backgroundColor = '#ffffff'
      document.body.style.color = '#000000'
    }
  }

  /**
   * Setup auto theme switching based on time
   */
  private setupAutoSwitch(darkModeStart?: string, lightModeStart?: string): void {
    if (this.autoSwitchTimer) {
      clearInterval(this.autoSwitchTimer)
    }

    const checkAndSwitch = () => {
      const now = new Date()
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

      const darkStart = darkModeStart || '18:00'
      const lightStart = lightModeStart || '08:00'

      if (currentTime >= darkStart || currentTime < lightStart) {
        this.setTheme('dark')
      } else {
        this.setTheme('light')
      }
    }

    // Check immediately
    checkAndSwitch()

    // Check every minute
    this.autoSwitchTimer = setInterval(checkAndSwitch, 60000)
  }

  /**
   * Notify listeners of theme change
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.currentTheme))
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.disableAutoSwitch()
    this.listeners = []
  }
}

export const themeManager = new ThemeManager()
export default ThemeManager
