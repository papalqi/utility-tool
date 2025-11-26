import { contextBridge, ipcRenderer } from 'electron'
import {
  AdbRunCommandOptions,
  AdbFileTransferOptions,
  ADBDeviceInfo,
  AdbCommandResult,
  AdbScreenshotResult,
  AdbLogcatResult,
  AdbCheckResponse,
} from '@shared/adb'
import {
  GenericAIConfig,
  AIChatMessage,
  AICompletionResult,
  AIConversationLogEntry,
  AITestConnectionResult,
} from '@shared/ai'
import { NotificationPayload, NotificationResult } from '@shared/notification'
import type {
  EnvironmentSnapshot,
  EnvironmentMutationPayload,
  EnvironmentDeletePayload,
  PathEntriesPayload,
  EnvironmentVariable,
} from '@shared/system'

type RunScriptPayload = {
  command: string
  args?: string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
  shell?: boolean
}

type ScriptOutputPayload = {
  id: string
  type: 'stdout' | 'stderr'
  data: string
}

type ScriptExitPayload = {
  id: string
  code: number | null
  signal: string | null
}

type ScriptErrorPayload = {
  id: string
  message: string
}

type AIChatCompletionPayload = {
  config: GenericAIConfig
  messages: AIChatMessage[]
  temperature?: number
  maxTokens?: number
  feature?: string
  metadata?: Record<string, unknown>
  log?: boolean
}

type PtyCreateOptions = {
  id: string
  command?: string
  args?: string[]
  cwd?: string
  shell?: string
  mode?: 'interactive' | 'task' | 'ssh'
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),

  // 自动更新
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),
    downloadUpdate: () => ipcRenderer.invoke('updater:download'),
    installUpdate: () => ipcRenderer.invoke('updater:install'),
    getCurrentVersion: () => ipcRenderer.invoke('updater:getCurrentVersion'),
    // 监听更新事件
    onChecking: (callback: () => void) => {
      const subscription = () => callback()
      ipcRenderer.on('update-checking', subscription)
      return () => ipcRenderer.removeListener('update-checking', subscription)
    },
    onAvailable: (callback: (info: { version: string; releaseNotes: string; releaseDate: string }) => void) => {
      const subscription = (_event: unknown, info: { version: string; releaseNotes: string; releaseDate: string }) => callback(info)
      ipcRenderer.on('update-available', subscription)
      return () => ipcRenderer.removeListener('update-available', subscription)
    },
    onNotAvailable: (callback: (info: { version: string }) => void) => {
      const subscription = (_event: unknown, info: { version: string }) => callback(info)
      ipcRenderer.on('update-not-available', subscription)
      return () => ipcRenderer.removeListener('update-not-available', subscription)
    },
    onDownloadProgress: (callback: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => {
      const subscription = (_event: unknown, progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => callback(progress)
      ipcRenderer.on('update-download-progress', subscription)
      return () => ipcRenderer.removeListener('update-download-progress', subscription)
    },
    onDownloaded: (callback: (info: { version: string }) => void) => {
      const subscription = (_event: unknown, info: { version: string }) => callback(info)
      ipcRenderer.on('update-downloaded', subscription)
      return () => ipcRenderer.removeListener('update-downloaded', subscription)
    },
    onError: (callback: (error: { message: string }) => void) => {
      const subscription = (_event: unknown, error: { message: string }) => callback(error)
      ipcRenderer.on('update-error', subscription)
      return () => ipcRenderer.removeListener('update-error', subscription)
    },
  },

  // Config management
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config: unknown) => ipcRenderer.invoke('config:save', config),
  getHostname: () => ipcRenderer.invoke('config:getHostname'),
  getSavedConfigPath: () => ipcRenderer.invoke('config:getSavedPath'),

  // File operations
  selectFile: (options: unknown) => ipcRenderer.invoke('file:select', options),
  selectFolder: (options: unknown) => ipcRenderer.invoke('file:selectFolder', options),
  readFile: (path: string) => ipcRenderer.invoke('file:read', path),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke('file:write', path, content),
  ensureDir: (path: string) => ipcRenderer.invoke('file:ensureDir', path),
  exists: (path: string) => ipcRenderer.invoke('file:exists', path),
  copyFile: (source: string, target: string) => ipcRenderer.invoke('file:copy', source, target),
  deleteFile: (path: string) => ipcRenderer.invoke('file:delete', path),
  readFileBase64: (path: string) => ipcRenderer.invoke('file:readBase64', path),
  writeFileBase64: (path: string, base64Data: string) =>
    ipcRenderer.invoke('file:writeBase64', path, base64Data),
  getTempDir: () => ipcRenderer.invoke('file:getTempDir'),
  getAppPath: () => ipcRenderer.invoke('app:getAppPath'),
  getResourcesPath: () => ipcRenderer.invoke('app:getResourcesPath'),
  getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
  findFiles: (pattern: string) => ipcRenderer.invoke('app:findFiles', pattern),
  readClipboardText: () => ipcRenderer.invoke('clipboard:readText'),
  writeClipboardText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text),
  openExternal: (target: string) => ipcRenderer.invoke('shell:openExternal', target),

  // Environment variables
  getEnvironmentVariables: (): Promise<EnvironmentSnapshot> => ipcRenderer.invoke('env:list'),
  setEnvironmentVariable: (payload: EnvironmentMutationPayload): Promise<EnvironmentVariable> =>
    ipcRenderer.invoke('env:set', payload),
  deleteEnvironmentVariable: (payload: EnvironmentDeletePayload): Promise<boolean> =>
    ipcRenderer.invoke('env:delete', payload),
  setPathEntries: (payload: PathEntriesPayload): Promise<boolean> =>
    ipcRenderer.invoke('env:setPathEntries', payload),
  which: (command: string): Promise<string | null> => ipcRenderer.invoke('env:which', command),

  // Obsidian integration
  syncWithObsidian: (data: unknown) => ipcRenderer.invoke('obsidian:sync', data),
  readObsidianVault: (path: string) => ipcRenderer.invoke('obsidian:readVault', path),

  // Script execution
  runScript: (options: string | RunScriptPayload, args?: string[]) =>
    ipcRenderer.invoke('script:run', options, args),
  killScript: (identifier: { id?: string; pid?: number } | string | number) =>
    ipcRenderer.invoke('script:kill', identifier),
  onScriptOutput: (callback: (payload: ScriptOutputPayload) => void) => {
    const subscription = (_event: unknown, payload: ScriptOutputPayload) => callback(payload)
    ipcRenderer.on('script:output', subscription)
    return () => ipcRenderer.removeListener('script:output', subscription)
  },
  onScriptExit: (callback: (payload: ScriptExitPayload) => void) => {
    const subscription = (_event: unknown, payload: ScriptExitPayload) => callback(payload)
    ipcRenderer.on('script:exit', subscription)
    return () => ipcRenderer.removeListener('script:exit', subscription)
  },
  onScriptError: (callback: (payload: ScriptErrorPayload) => void) => {
    const subscription = (_event: unknown, payload: ScriptErrorPayload) => callback(payload)
    ipcRenderer.on('script:error', subscription)
    return () => ipcRenderer.removeListener('script:error', subscription)
  },

  // Terminal
  executeCommand: (command: string) => ipcRenderer.invoke('terminal:execute', command),
  execCommand: (command: string) => ipcRenderer.invoke('terminal:exec', command),

  // PTY
  ptyCreate: (options: PtyCreateOptions) => ipcRenderer.invoke('pty:create', options),
  ptyWrite: (id: string, data: string) => ipcRenderer.invoke('pty:write', id, data),
  ptyResize: (id: string, cols: number, rows: number) =>
    ipcRenderer.invoke('pty:resize', id, cols, rows),
  ptyClose: (id: string) => ipcRenderer.invoke('pty:close', id),
  onPtyOutput: (id: string, callback: (data: string) => void) => {
    const channel = `pty-output-${id}`
    const subscription = (_event: unknown, data: string) => callback(data)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  },
  onPtyExit: (id: string, callback: (result: { exitCode: number; signal?: number }) => void) => {
    const channel = `pty-exit-${id}`
    const subscription = (_event: unknown, result: { exitCode: number; signal?: number }) =>
      callback(result)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  },

  // HTTP requests
  httpGet: (url: string) => ipcRenderer.invoke('http:get', url),

  // System notifications
  showNotification: (options: { title: string; body: string }) =>
    ipcRenderer.invoke('notification:show', options),
  dispatchNotification: (payload: NotificationPayload): Promise<NotificationResult> =>
    ipcRenderer.invoke('notification:dispatch', payload),

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Event listeners
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const subscription = (_event: unknown, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  },

  // Generic invoke method for flexibility
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),

  // ADB helpers
  adbCheck: (options?: { adbPath?: string }): Promise<AdbCheckResponse> =>
    ipcRenderer.invoke('adb:check', options),
  adbListDevices: (options?: { adbPath?: string }): Promise<ADBDeviceInfo[]> =>
    ipcRenderer.invoke('adb:listDevices', options),
  adbRunCommand: (options: AdbRunCommandOptions): Promise<AdbCommandResult> =>
    ipcRenderer.invoke('adb:runCommand', options),
  adbPush: (options: AdbFileTransferOptions): Promise<AdbCommandResult> =>
    ipcRenderer.invoke('adb:push', options),
  adbPull: (options: AdbFileTransferOptions): Promise<AdbCommandResult> =>
    ipcRenderer.invoke('adb:pull', options),
  adbScreenshot: (options: {
    adbPath?: string
    deviceId: string
    outputDir?: string
  }): Promise<AdbScreenshotResult> => ipcRenderer.invoke('adb:screenshot', options),
  adbLogcat: (options: {
    adbPath?: string
    deviceId: string
    filter?: string
  }): Promise<AdbLogcatResult> => ipcRenderer.invoke('adb:logcat', options),

  // AI helpers
  aiTestConnection: (config: GenericAIConfig): Promise<AITestConnectionResult> =>
    ipcRenderer.invoke('ai:testConnection', config),
  aiChatCompletion: (payload: AIChatCompletionPayload): Promise<AICompletionResult> =>
    ipcRenderer.invoke('ai:chatCompletion', payload),
  aiLogConversation: (entry: AIConversationLogEntry): Promise<string> =>
    ipcRenderer.invoke('ai:logConversation', entry),

  // Auth window - 登录窗口
  openLoginWindow: (options: { url: string; autoDetect?: boolean }) =>
    ipcRenderer.invoke('auth:openLoginWindow', options),

  // Web Archive
  webarchiveCrawl: (request: unknown) => ipcRenderer.invoke('webarchive:crawl', request),
  webarchiveCrawlMultiple: (requests: unknown[]) =>
    ipcRenderer.invoke('webarchive:crawlMultiple', requests),
  webarchiveCheckIn: (request: unknown) => ipcRenderer.invoke('webarchive:checkIn', request),

  // Resource Monitor
  getResourceUsage: () => ipcRenderer.invoke('resources:getUsage'),
  getTopProcesses: (limit?: number) => ipcRenderer.invoke('resources:getProcesses', limit),
})

// TypeScript definitions for the exposed API
declare global {
  interface UpdaterAPI {
    checkForUpdates: () => Promise<void>
    downloadUpdate: () => Promise<void>
    installUpdate: () => void
    getCurrentVersion: () => Promise<string>
    onChecking: (callback: () => void) => () => void
    onAvailable: (callback: (info: {
      version: string
      releaseNotes: string
      releaseDate: string
    }) => void) => () => void
    onNotAvailable: (callback: (info: { version: string }) => void) => () => void
    onDownloadProgress: (callback: (progress: {
      percent: number
      bytesPerSecond: number
      transferred: number
      total: number
    }) => void) => () => void
    onDownloaded: (callback: (info: { version: string }) => void) => () => void
    onError: (callback: (error: { message: string }) => void) => () => void
  }

  interface Window {
    electronAPI: {
      getVersion: () => Promise<string>
      getPlatform: () => Promise<string>
      updater: UpdaterAPI
      loadConfig: () => Promise<unknown>
      saveConfig: (config: unknown) => Promise<void>
      getHostname: () => Promise<string>
      getSavedConfigPath: () => Promise<string | null>
      selectFile: (options: unknown) => Promise<string | undefined>
      selectFolder: (options: unknown) => Promise<string | undefined>
      readFile: (path: string) => Promise<string>
      writeFile: (path: string, content: string) => Promise<void>
      ensureDir: (path: string) => Promise<void>
      copyFile: (source: string, target: string) => Promise<void>
      deleteFile: (path: string) => Promise<void>
      readFileBase64: (path: string) => Promise<string>
      writeFileBase64: (path: string, base64Data: string) => Promise<void>
      getTempDir: () => Promise<string>
      getAppPath: () => Promise<string>
      getResourcesPath: () => Promise<string>
      getPath: (name: string) => Promise<string>
      findFiles: (pattern: string) => Promise<string[]>
      readClipboardText: () => Promise<string>
      writeClipboardText: (text: string) => Promise<boolean>
      openExternal: (target: string) => Promise<void>
      getEnvironmentVariables: () => Promise<EnvironmentSnapshot>
      setEnvironmentVariable: (
        payload: EnvironmentMutationPayload
      ) => Promise<EnvironmentVariable>
      deleteEnvironmentVariable: (payload: EnvironmentDeletePayload) => Promise<boolean>
      setPathEntries: (payload: PathEntriesPayload) => Promise<boolean>
      which: (command: string) => Promise<string | null>
      execCommand: (command: string) => Promise<string>
      syncWithObsidian: (data: unknown) => Promise<void>
      readObsidianVault: (path: string) => Promise<unknown>
      runScript: (options: string | RunScriptPayload, args?: string[]) => Promise<{ success: boolean; id: string; pid?: number | null }>
      killScript: (identifier: { id?: string; pid?: number } | string | number) => Promise<boolean>
      onScriptOutput: (callback: (payload: ScriptOutputPayload) => void) => () => void
      onScriptExit: (callback: (payload: ScriptExitPayload) => void) => () => void
      onScriptError: (callback: (payload: ScriptErrorPayload) => void) => () => void
      executeCommand: (command: string) => Promise<unknown>
      ptyCreate: (options: PtyCreateOptions) => Promise<string>
      ptyWrite: (id: string, data: string) => Promise<boolean>
      ptyResize: (id: string, cols: number, rows: number) => Promise<boolean>
      ptyClose: (id: string) => Promise<boolean>
      onPtyOutput: (id: string, callback: (data: string) => void) => () => void
      onPtyExit: (
        id: string,
        callback: (result: { exitCode: number; signal?: number }) => void
      ) => () => void
      httpGet: (url: string) => Promise<{ ok: boolean; status: number; data: string }>
      showNotification: (options: { title: string; body: string }) => Promise<boolean>
      dispatchNotification: (payload: NotificationPayload) => Promise<NotificationResult>
      minimizeWindow: () => Promise<void>
      maximizeWindow: () => Promise<void>
      closeWindow: () => Promise<void>
      isWindowMaximized: () => Promise<boolean>
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
      adbCheck: (options?: { adbPath?: string }) => Promise<AdbCheckResponse>
      adbListDevices: (options?: { adbPath?: string }) => Promise<ADBDeviceInfo[]>
      adbRunCommand: (options: AdbRunCommandOptions) => Promise<AdbCommandResult>
      adbPush: (options: AdbFileTransferOptions) => Promise<AdbCommandResult>
      adbPull: (options: AdbFileTransferOptions) => Promise<AdbCommandResult>
      adbScreenshot: (options: {
        adbPath?: string
        deviceId: string
        outputDir?: string
      }) => Promise<AdbScreenshotResult>
      adbLogcat: (options: {
        adbPath?: string
        deviceId: string
        filter?: string
      }) => Promise<AdbLogcatResult>
      aiTestConnection: (config: GenericAIConfig) => Promise<AITestConnectionResult>
      aiChatCompletion: (payload: AIChatCompletionPayload) => Promise<AICompletionResult>
      aiLogConversation: (entry: AIConversationLogEntry) => Promise<string>
      openLoginWindow: (options: {
        url: string
        autoDetect?: boolean
      }) => Promise<{
        success: boolean
        cookies?: string
        error?: string
        metadata?: { cookieCount: number; domain: string }
      }>
      webarchiveCrawl: (request: unknown) => Promise<unknown>
      webarchiveCrawlMultiple: (requests: unknown[]) => Promise<unknown>
      webarchiveCheckIn: (request: unknown) => Promise<unknown>
      getResourceUsage: () => Promise<unknown>
      getTopProcesses: (limit?: number) => Promise<unknown>
    }
  }
}
