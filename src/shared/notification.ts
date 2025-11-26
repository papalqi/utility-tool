export type NotificationChannel = 'local' | 'system' | 'remote' | 'auto'

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'

export interface NotificationPayload {
  id?: string
  channel?: NotificationChannel
  severity?: NotificationSeverity
  title: string
  message: string
  timestamp?: number
  metadata?: Record<string, unknown>
}

export interface NotificationResult {
  requestedChannel: NotificationChannel
  deliveredChannel: NotificationChannel
  delivered: boolean
  error?: string
}
