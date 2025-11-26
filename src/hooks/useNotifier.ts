import { useCallback } from 'react'
import { App } from 'antd'
import type {
  NotificationChannel,
  NotificationPayload,
  NotificationResult,
} from '@/shared/notification'

const severityMethodMap = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info',
} as const

type MessageApiMethod = (content: string, duration?: number) => void

async function dispatchViaIPC(payload: NotificationPayload): Promise<NotificationResult | null> {
  if (!window.electronAPI?.dispatchNotification) return null
  try {
    return await window.electronAPI.dispatchNotification(payload)
  } catch (error) {
    console.error('dispatchNotification failed', error)
    return {
      requestedChannel: payload.channel || 'system',
      deliveredChannel: payload.channel || 'system',
      delivered: false,
      error: (error as Error).message,
    }
  }
}

export function useNotifier() {
  const { message } = App.useApp()

  const showLocal = useCallback(
    (payload: NotificationPayload): NotificationResult => {
      const methodKey = severityMethodMap[payload.severity || 'info'] || 'info'
      const handler = message[methodKey as keyof typeof message] as MessageApiMethod | undefined
      const title = payload.title ? `${payload.title}: ` : ''
      if (handler) {
        handler(`${title}${payload.message}`)
      } else {
        message.info(`${title}${payload.message}`)
      }
      return {
        requestedChannel: payload.channel || 'local',
        deliveredChannel: 'local',
        delivered: true,
      }
    },
    [message]
  )

  const showSystem = useCallback(async (payload: NotificationPayload) => {
    const result = await dispatchViaIPC({
      ...payload,
      channel: 'system',
    })
    return (
      result ?? {
        requestedChannel: 'system',
        deliveredChannel: 'system',
        delivered: false,
        error: 'IPC unavailable',
      }
    )
  }, [])

  const sendRemote = useCallback(async (payload: NotificationPayload) => {
    const result = await dispatchViaIPC({
      ...payload,
      channel: 'remote',
    })
    return (
      result ?? {
        requestedChannel: 'remote',
        deliveredChannel: 'remote',
        delivered: false,
        error: 'IPC unavailable',
      }
    )
  }, [])

  const notify = useCallback(
    async (
      payload: NotificationPayload,
      options?: { fallback?: NotificationChannel[] }
    ): Promise<NotificationResult> => {
      const primaryChannel = payload.channel || 'local'

      const attempt = async (channel: NotificationChannel) => {
        switch (channel) {
          case 'local':
            return showLocal({ ...payload, channel: 'local' })
          case 'system':
            return showSystem(payload)
          case 'remote':
            return sendRemote(payload)
          case 'auto': {
            const autoResult = await showSystem(payload)
            if (autoResult.delivered) return autoResult
            return showLocal({ ...payload, channel: 'local' })
          }
          default:
            return showLocal({ ...payload, channel: 'local' })
        }
      }

      let result = await attempt(primaryChannel)
      if (result.delivered) {
        return result
      }

      const fallbacks = options?.fallback || (primaryChannel === 'system' ? ['local'] : [])
      for (const fallbackChannel of fallbacks) {
        result = await attempt(fallbackChannel)
        if (result.delivered) {
          return result
        }
      }
      return result
    },
    [sendRemote, showLocal, showSystem]
  )

  return {
    notify,
    showLocal,
    showSystem,
    sendRemote,
  }
}

export default useNotifier
