/**
 * LogManager - Application logging system
 * Provides structured logging with different levels
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  error?: Error
}

class LogManager {
  private logs: LogEntry[] = []
  private maxLogs: number = 1000
  private logLevel: LogLevel = LogLevel.INFO
  private listeners: Array<(entry: LogEntry) => void> = []

  /**
   * Set the minimum log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context)
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context)
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context)
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context, error)
  }

  /**
   * Log a critical error message
   */
  critical(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.CRITICAL, message, context, error)
  }

  /**
   * Internal logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    if (level < this.logLevel) {
      return
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
    }

    this.logs.push(entry)

    // Trim logs if exceeding max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // Console output
    this.logToConsole(entry)

    // Notify listeners
    this.notifyListeners(entry)
  }

  /**
   * Output log to console
   */
  private logToConsole(entry: LogEntry): void {
    const levelName = LogLevel[entry.level]
    const prefix = `[${entry.timestamp}] [${levelName}]`

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(prefix, entry.message, entry.context)
        break
      case LogLevel.INFO:
        console.info(prefix, entry.message, entry.context)
        break
      case LogLevel.WARN:
        console.warn(prefix, entry.message, entry.context)
        break
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(prefix, entry.message, entry.context, entry.error)
        break
    }
  }

  /**
   * Get all logs
   */
  getLogs(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.logs.filter((log) => log.level >= level)
    }
    return [...this.logs]
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = []
  }

  /**
   * Subscribe to new log entries
   */
  subscribe(listener: (entry: LogEntry) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * Notify listeners
   */
  private notifyListeners(entry: LogEntry): void {
    this.listeners.forEach((listener) => listener(entry))
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }
}

export const logManager = new LogManager()
export default LogManager
