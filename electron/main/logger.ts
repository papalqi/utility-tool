/**
 * Electron 主进程日志配置
 * 使用 electron-log 实现自动日志轮转和多输出
 */

import log from 'electron-log'
import { app } from 'electron'
import path from 'path'
import { execSync } from 'child_process'

/**
 * 配置 electron-log
 */
export function setupLogger() {
  // Windows 下设置控制台为 UTF-8 编码
  if (process.platform === 'win32') {
    try {
      // 设置环境变量，确保子进程也使用 UTF-8
      process.env.PYTHONIOENCODING = 'utf-8'
      process.env.CHCP = '65001'
      
      // 设置 stdout/stderr 编码
      if (process.stdout.setDefaultEncoding) {
        process.stdout.setDefaultEncoding('utf8')
      }
      if (process.stderr.setDefaultEncoding) {
        process.stderr.setDefaultEncoding('utf8')
      }
      
      // 尝试执行 chcp 命令（可能失败，忽略错误）
      try {
        execSync('chcp 65001', { stdio: 'ignore', windowsHide: true })
      } catch {
        // chcp 命令失败不影响功能，静默忽略
      }
    } catch (error) {
      // 编码设置失败不影响功能
    }
  }

  // 设置日志文件路径
  const logPath = path.join(app.getPath('userData'), 'logs')

  // 主日志文件
  log.transports.file.resolvePathFn = () =>
    path.join(logPath, 'main.log')

  // 配置文件传输
  log.transports.file.level = 'debug'
  log.transports.file.maxSize = 10 * 1024 * 1024 // 10MB
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
  
  // Windows 下强制使用 UTF-8 编码
  if (process.platform === 'win32') {
    // @ts-expect-error - electron-log 类型定义可能不完整
    log.transports.file.encoding = 'utf8'
  }

  // 配置控制台传输
  log.transports.console.level = 'debug'
  log.transports.console.format = '[{level}] {text}'

  // 捕获未处理的异常和拒绝
  log.errorHandler.startCatching({
    showDialog: false,
    onError({ error }) {
      log.error('Uncaught error:', error)
    },
  })

  // 记录应用启动
  log.info('='.repeat(60))
  log.info('Application started')
  log.info(`Version: ${app.getVersion()}`)
  log.info(`Platform: ${process.platform}`)
  log.info(`Electron: ${process.versions.electron}`)
  log.info(`Chrome: ${process.versions.chrome}`)
  log.info(`Node: ${process.versions.node}`)
  log.info(`Log path: ${logPath}`)
  log.info('='.repeat(60))
}

// 导出配置好的 logger
export default log
