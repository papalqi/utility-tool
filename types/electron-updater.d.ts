declare module 'electron-updater' {
  export interface UpdateInfo {
    version: string
    releaseNotes?: string | string[] | null
    releaseDate?: string
  }

  export interface ProgressInfo {
    percent: number
    bytesPerSecond: number
    transferred: number
    total: number
  }

  export interface UpdateDownloadedEvent extends UpdateInfo {}

  export interface UpdateNotAvailableEvent {
    version: string
  }

  export interface AutoUpdater {
    autoDownload: boolean
    autoInstallOnAppQuit: boolean
    allowDowngrade: boolean
    allowPrerelease: boolean
    logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void }

    checkForUpdates(): Promise<void>
    downloadUpdate(): Promise<void>
    quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void

    on(event: 'checking-for-update', listener: () => void): this
    on(event: 'update-available', listener: (info: UpdateInfo) => void): this
    on(event: 'update-not-available', listener: (info: UpdateNotAvailableEvent) => void): this
    on(event: 'download-progress', listener: (progress: ProgressInfo) => void): this
    on(event: 'update-downloaded', listener: (info: UpdateDownloadedEvent) => void): this
    on(event: 'error', listener: (error: Error) => void): this
  }

  export const autoUpdater: AutoUpdater
}
