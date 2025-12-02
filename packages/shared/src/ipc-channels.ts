/**
 * IPC 通道类型定义
 * 所有 IPC 通道的参数和返回值类型约束
 */

// 重新导出需要的类型（避免循环依赖，这里使用类型别名）
// 实际类型定义在 src/shared/ 目录中

// ADB 类型
export interface AdbRunCommandOptions {
  adbPath?: string
  deviceId?: string
  args: string[]
}

export interface AdbFileTransferOptions {
  adbPath?: string
  deviceId: string
  localPath: string
  remotePath: string
}

export interface ADBDeviceInfo {
  id: string
  status: string
  product?: string
  model?: string
  device?: string
  transportId?: string
}

export interface AdbCommandResult {
  stdout: string
  stderr: string
  code: number
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
  missing?: boolean
}

// AI 类型
export interface GenericAIConfig {
  provider: string
  apiKey: string
  baseUrl?: string
  model?: string
}

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AICompletionResult {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface AIConversationLogEntry {
  timestamp: number
  feature: string
  messages: AIChatMessage[]
  result: AICompletionResult
  metadata?: Record<string, unknown>
}

export interface AITestConnectionResult {
  success: boolean
  message: string
  model?: string
}

// Notification 类型
export interface NotificationPayload {
  title: string
  message: string
  channel?: 'auto' | 'system' | 'in-app'
  severity?: 'info' | 'warning' | 'error' | 'success'
}

export interface NotificationResult {
  delivered: boolean
  channel?: string
  error?: string
}

// Environment 类型
export type EnvVarScope = 'system' | 'user' | 'process'

export interface EnvironmentVariable {
  key: string
  value: string
  scope: EnvVarScope
  source?: string
}

export interface EnvironmentCapabilities {
  supportsEditing: boolean
  canEditUser: boolean
  canEditSystem: boolean
  canDelete: boolean
  notes?: string
}

export interface EnvironmentSnapshot {
  variables: EnvironmentVariable[]
  platform: NodeJS.Platform
  scopes: EnvVarScope[]
  capabilities: EnvironmentCapabilities
  pathEntries: {
    user: string[]
    system: string[]
    process: string[]
  }
  generatedAt: number
}

export interface EnvironmentMutationPayload {
  key: string
  value: string
  scope: EnvVarScope
}

export interface EnvironmentDeletePayload {
  key: string
  scope: EnvVarScope
}

export interface PathEntriesPayload {
  scope: EnvVarScope
  entries: string[]
}

// Resource 类型 - 从 resource.ts 导入
import type { ResourceUsage, ProcessInfo } from './resource'
export type { ResourceUsage, ProcessInfo }

// ==================== 通用类型 ====================

export type AppConfig = Record<string, unknown>

export interface FileSelectOptions {
  title?: string
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
}

export interface FolderSelectOptions {
  title?: string
  defaultPath?: string
}

export interface PtyCreateOptions {
  id: string
  command?: string
  args?: string[]
  cwd?: string
  shell?: string
  mode?: 'interactive' | 'task' | 'ssh'
}

export interface PtyExitResult {
  exitCode: number
  signal?: number
}

export interface RunScriptOptions {
  command: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
  shell?: boolean
}

export interface ScriptRunResult {
  success: boolean
  id: string
  pid?: number | null
}

export interface HttpResponse {
  ok: boolean
  status: number
  data: string
}

export interface LoginWindowOptions {
  url: string
  autoDetect?: boolean
}

export interface LoginWindowResult {
  success: boolean
  cookies?: string
  error?: string
  metadata?: { cookieCount: number; domain: string }
}

export interface AIChatCompletionPayload {
  config: GenericAIConfig
  messages: AIChatMessage[]
  temperature?: number
  maxTokens?: number
  feature?: string
  metadata?: Record<string, unknown>
  log?: boolean
}

// ==================== IPC 通道定义 ====================

/**
 * 所有 IPC 通道的类型映射
 * 格式: 'channel:name': { args: [...参数类型]; return: 返回类型 }
 */
export interface IpcChannelMap {
  // ==================== App ====================
  'app:getVersion': { args: []; return: string }
  'app:getPlatform': { args: []; return: NodeJS.Platform }
  'app:getAppPath': { args: []; return: string }
  'app:getResourcesPath': { args: []; return: string }
  'app:getPath': { args: [name: string]; return: string }
  'app:findFiles': { args: [pattern: string]; return: string[] }

  // ==================== Updater ====================
  'updater:check': { args: []; return: void }
  'updater:download': { args: []; return: void }
  'updater:install': { args: []; return: void }
  'updater:getCurrentVersion': { args: []; return: string }

  // ==================== Config ====================
  'config:load': { args: []; return: AppConfig | null }
  'config:save': { args: [config: AppConfig]; return: boolean }
  'config:getHostname': { args: []; return: string }
  'config:getSection': { args: [section: string]; return: unknown }
  'config:getObsidian': { args: []; return: unknown }
  'config:getSavedPath': { args: []; return: string | null }

  // ==================== File ====================
  'file:select': { args: [options?: FileSelectOptions]; return: string | undefined }
  'file:selectFolder': { args: [options?: FolderSelectOptions]; return: string | undefined }
  'file:read': { args: [path: string]; return: string }
  'file:write': { args: [path: string, content: string]; return: void }
  'file:ensureDir': { args: [path: string]; return: void }
  'file:exists': { args: [path: string]; return: boolean }
  'file:copy': { args: [source: string, target: string]; return: void }
  'file:delete': { args: [path: string]; return: void }
  'file:readBase64': { args: [path: string]; return: string }
  'file:writeBase64': { args: [path: string, base64Data: string]; return: void }
  'file:getTempDir': { args: []; return: string }

  // ==================== Clipboard ====================
  'clipboard:readText': { args: []; return: string }
  'clipboard:writeText': { args: [text: string]; return: boolean }

  // ==================== Shell ====================
  'shell:openPath': { args: [path: string]; return: string }
  'shell:openExternal': { args: [target: string]; return: void }

  // ==================== Environment ====================
  'env:list': { args: []; return: EnvironmentSnapshot }
  'env:set': { args: [payload: EnvironmentMutationPayload]; return: EnvironmentVariable }
  'env:delete': { args: [payload: EnvironmentDeletePayload]; return: boolean }
  'env:setPathEntries': { args: [payload: PathEntriesPayload]; return: boolean }
  'env:which': { args: [command: string]; return: string | null }

  // ==================== Terminal ====================
  'terminal:exec': { args: [command: string]; return: string }
  'terminal:execute': { args: [command: string]; return: { output: string; exitCode: number } }

  // ==================== PTY ====================
  'pty:create': { args: [options: PtyCreateOptions]; return: string }
  'pty:write': { args: [id: string, data: string]; return: boolean }
  'pty:resize': { args: [id: string, cols: number, rows: number]; return: boolean }
  'pty:close': { args: [id: string]; return: boolean }

  // ==================== Script ====================
  'script:run': { args: [options: string | RunScriptOptions, legacyArgs?: string[]]; return: ScriptRunResult }
  'script:kill': { args: [identifier: { id?: string; pid?: number } | string | number]; return: boolean }

  // ==================== HTTP ====================
  'http:get': { args: [url: string]; return: HttpResponse }

  // ==================== Notification ====================
  'notification:show': { args: [options: { title: string; body: string }]; return: boolean }
  'notification:dispatch': { args: [payload: NotificationPayload]; return: NotificationResult }

  // ==================== Window ====================
  'window:minimize': { args: []; return: void }
  'window:maximize': { args: []; return: void }
  'window:close': { args: []; return: void }
  'window:isMaximized': { args: []; return: boolean }

  // ==================== Resources ====================
  'resources:getUsage': { args: []; return: ResourceUsage }
  'resources:getProcesses': { args: [limit?: number]; return: ProcessInfo[] }

  // ==================== ADB ====================
  'adb:check': { args: [options?: { adbPath?: string }]; return: AdbCheckResponse }
  'adb:listDevices': { args: [options?: { adbPath?: string }]; return: ADBDeviceInfo[] }
  'adb:runCommand': { args: [options: AdbRunCommandOptions]; return: AdbCommandResult }
  'adb:push': { args: [options: AdbFileTransferOptions]; return: AdbCommandResult }
  'adb:pull': { args: [options: AdbFileTransferOptions]; return: AdbCommandResult }
  'adb:screenshot': { args: [options: { adbPath?: string; deviceId: string; outputDir?: string }]; return: AdbScreenshotResult }
  'adb:logcat': { args: [options: { adbPath?: string; deviceId: string; filter?: string }]; return: AdbLogcatResult }

  // ==================== AI ====================
  'ai:testConnection': { args: [config: GenericAIConfig]; return: AITestConnectionResult }
  'ai:chatCompletion': { args: [payload: AIChatCompletionPayload]; return: AICompletionResult }
  'ai:logConversation': { args: [entry: AIConversationLogEntry]; return: string }

  // ==================== GitHub ====================
  'github:verifyToken': { args: [token: string]; return: { valid: boolean; user?: string; error?: string } }
  'github:listRepos': { args: [token: string]; return: unknown[] }
  'github:cloneRepo': { args: [options: { url: string; targetPath: string }]; return: unknown }
  'github:loadLocalRepos': { args: [hostname: string]; return: unknown[] }
  'github:saveLocalRepos': { args: [hostname: string, repos: unknown[]]; return: boolean }
  'github:loadFavorites': { args: []; return: string[] }
  'github:saveFavorites': { args: [favorites: string[]]; return: boolean }

  // ==================== Git ====================
  'git:getInfo': { args: [repoPath: string]; return: unknown }
  'git:execCommand': { args: [repoPath: string, command: string]; return: unknown }

  // ==================== Auth ====================
  'auth:openLoginWindow': { args: [options: LoginWindowOptions]; return: LoginWindowResult }

  // ==================== Web Archive ====================
  'webarchive:crawl': { args: [request: unknown]; return: unknown }
  'webarchive:crawlMultiple': { args: [requests: unknown[]]; return: Record<string, unknown> }
  'webarchive:checkIn': { args: [request: unknown]; return: unknown }

  // ==================== Obsidian ====================
  'obsidian:sync': { args: [data: unknown]; return: boolean }
  'obsidian:readVault': { args: [path: string]; return: unknown }
}

// ==================== 类型工具 ====================

/** 所有 IPC 通道名称 */
export type IpcChannel = keyof IpcChannelMap

/** 提取指定通道的参数类型 */
export type IpcArgs<C extends IpcChannel> = IpcChannelMap[C]['args']

/** 提取指定通道的返回类型 */
export type IpcReturn<C extends IpcChannel> = IpcChannelMap[C]['return']

/** IPC 错误类型 */
export interface IpcError {
  channel: string
  message: string
  code: string
  timestamp: number
}

// ==================== 事件通道定义 ====================

/** 事件通道类型映射（主进程 -> 渲染进程） */
export interface IpcEventMap {
  // PTY 事件
  'pty-output': { id: string; data: string }
  'pty-exit': { id: string; exitCode: number; signal?: number }
  
  // Script 事件
  'script:output': { id: string; type: 'stdout' | 'stderr'; data: string }
  'script:exit': { id: string; code: number | null; signal: string | null }
  'script:error': { id: string; message: string }
  
  // Updater 事件
  'update-checking': void
  'update-available': { version: string; releaseNotes: string; releaseDate: string }
  'update-not-available': { version: string }
  'update-download-progress': { percent: number; bytesPerSecond: number; transferred: number; total: number }
  'update-downloaded': { version: string }
  'update-error': { message: string }
}

/** 事件通道名称 */
export type IpcEvent = keyof IpcEventMap

/** 提取事件数据类型 */
export type IpcEventData<E extends IpcEvent> = IpcEventMap[E]
