/**
 * 共享的 ADB 类型定义
 * 供 Electron 主进程与 React Renderer 共用
 */

export interface ADBDeviceInfo {
  id: string
  status: string
  model?: string
  product?: string
  transportId?: string
  deviceName?: string
  manufacturer?: string
  androidVersion?: string
}

export interface AdbCommandResult {
  stdout: string
  stderr: string
  code: number
}

export interface AdbRunCommandOptions {
  adbPath?: string
  deviceId?: string
  args: string[]
  timeout?: number
}

export interface AdbFileTransferOptions {
  adbPath?: string
  deviceId: string
  localPath: string
  remotePath: string
  timeout?: number
}

export interface AdbScreenshotResult {
  filePath: string
  size: number
}

export interface AdbLogcatResult {
  log: string
  length: number
}

export interface AdbCheckResponse {
  ok: boolean
  message: string
  version?: string
}
