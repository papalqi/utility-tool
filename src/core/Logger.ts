/**
 * Logger - 使用 electron-log 的日志管理系统
 *
 * 特性：
 * - 多级别日志（silly, debug, info, warn, error）
 * - 自动日志轮转（10MB，最多5个备份）
 * - 同时输出到文件和控制台
 * - 主进程和渲染进程统一接口
 * - 支持结构化日志
 *
 * 对应 Python 版本：src/utils/logger.py
 */

// 日志级别类型
export type LogLevel = 'silly' | 'debug' | 'verbose' | 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: Date
  level: LogLevel
  message: string
  data?: unknown
  error?: Error
}

// 日志监听器类型
type LogListener = (entry: LogEntry) => void

/**
 * Logger 类 - 日志管理器
 *
 * 在渲染进程中使用简化版本（因为 electron-log 主要在主进程使用）
 * 通过 IPC 发送日志到主进程进行持久化
 */
class Logger {
  private listeners: LogListener[] = []
  private logHistory: LogEntry[] = []
  private maxHistorySize = 1000
  private minLevel: LogLevel = 'info'

  /**
   * 设置最小日志级别
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level
  }

  /**
   * 获取当前日志级别
   */
  getLevel(): LogLevel {
    return this.minLevel
  }

  /**
   * 记录 silly 级别日志
   */
  silly(message: string, data?: unknown): void {
    this.log('silly', message, data)
  }

  /**
   * 记录 debug 级别日志
   */
  debug(message: string, data?: unknown): void {
    this.log('debug', message, data)
  }

  /**
   * 记录 verbose 级别日志
   */
  verbose(message: string, data?: unknown): void {
    this.log('verbose', message, data)
  }

  /**
   * 记录 info 级别日志
   */
  info(message: string, data?: unknown): void {
    this.log('info', message, data)
  }

  /**
   * 记录 warn 级别日志
   */
  warn(message: string, data?: unknown): void {
    this.log('warn', message, data)
  }

  /**
   * 记录 error 级别日志
   */
  error(message: string, error?: Error | unknown, data?: unknown): void {
    this.log('error', message, data, error as Error)
  }

  /**
   * 内部日志方法
   */
  private log(level: LogLevel, message: string, data?: unknown, error?: Error): void {
    // 检查日志级别
    if (!this.shouldLog(level)) {
      return
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      data,
      error,
    }

    // 添加到历史记录
    this.addToHistory(entry)

    // 输出到控制台
    this.logToConsole(entry)

    // 通知监听器
    this.notifyListeners(entry)

    // 在 Electron 环境中，通过 IPC 发送到主进程
    if (window.electronAPI) {
      // TODO: 实现 IPC 日志发送
      // window.electronAPI.log(entry)
    }
  }

  /**
   * 判断是否应该记录该级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['silly', 'debug', 'verbose', 'info', 'warn', 'error']
    const currentIndex = levels.indexOf(this.minLevel)
    const logIndex = levels.indexOf(level)
    return logIndex >= currentIndex
  }

  /**
   * 添加到历史记录
   */
  private addToHistory(entry: LogEntry): void {
    this.logHistory.push(entry)

    // 限制历史记录大小
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory = this.logHistory.slice(-this.maxHistorySize)
    }
  }

  /**
   * 输出到控制台
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString()
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}]`

    const args: unknown[] = [prefix, entry.message]
    if (entry.data) {
      args.push(entry.data)
    }
    if (entry.error) {
      args.push(entry.error)
    }

    switch (entry.level) {
      case 'silly':
      case 'debug':
      case 'verbose':
        console.debug(...args)
        break
      case 'info':
        console.info(...args)
        break
      case 'warn':
        console.warn(...args)
        break
      case 'error':
        console.error(...args)
        break
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(entry: LogEntry): void {
    this.listeners.forEach((listener) => {
      try {
        listener(entry)
      } catch (error) {
        console.error('Error in log listener:', error)
      }
    })
  }

  /**
   * 订阅日志事件
   */
  subscribe(listener: LogListener): () => void {
    this.listeners.push(listener)

    // 返回取消订阅函数
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * 获取日志历史
   */
  getHistory(level?: LogLevel): LogEntry[] {
    if (!level) {
      return [...this.logHistory]
    }

    return this.logHistory.filter((entry) => entry.level === level)
  }

  /**
   * 清除日志历史
   */
  clearHistory(): void {
    this.logHistory = []
  }

  /**
   * 导出日志为 JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logHistory, null, 2)
  }

  /**
   * 设置最大历史记录大小
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = size
    if (this.logHistory.length > size) {
      this.logHistory = this.logHistory.slice(-size)
    }
  }

  /**
   * 创建子日志器（带前缀）
   */
  createScope(scope: string): ScopedLogger {
    return new ScopedLogger(this, scope)
  }
}

/**
 * 带作用域的日志器
 */
class ScopedLogger {
  constructor(
    private logger: Logger,
    private scope: string
  ) {}

  private formatMessage(message: string): string {
    return `[${this.scope}] ${message}`
  }

  silly(message: string, data?: unknown): void {
    this.logger.silly(this.formatMessage(message), data)
  }

  debug(message: string, data?: unknown): void {
    this.logger.debug(this.formatMessage(message), data)
  }

  verbose(message: string, data?: unknown): void {
    this.logger.verbose(this.formatMessage(message), data)
  }

  info(message: string, data?: unknown): void {
    this.logger.info(this.formatMessage(message), data)
  }

  warn(message: string, data?: unknown): void {
    this.logger.warn(this.formatMessage(message), data)
  }

  error(message: string, error?: Error | unknown, data?: unknown): void {
    this.logger.error(this.formatMessage(message), error, data)
  }
}

// 导出单例实例
export const logger = new Logger()

// 导出类型
export type { ScopedLogger }
export default Logger
