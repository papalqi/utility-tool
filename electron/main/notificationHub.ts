import { Notification } from 'electron'
import log from 'electron-log'
import type { NotificationPayload, NotificationResult, NotificationChannel } from '@shared/notification'

const FALLBACK_CHANNEL: NotificationChannel = 'local'

async function showSystemNotification(payload: NotificationPayload): Promise<NotificationResult> {
  try {
    const notification = new Notification({
      title: payload.title,
      body: payload.message,
      silent: payload.metadata?.silent === true,
      subtitle: payload.metadata?.subtitle as string | undefined,
    })
    notification.show()
    return {
      requestedChannel: payload.channel || 'system',
      deliveredChannel: 'system',
      delivered: true,
    }
  } catch (error) {
    log.error('System notification failed', error)
    return {
      requestedChannel: payload.channel || 'system',
      deliveredChannel: 'system',
      delivered: false,
      error: (error as Error).message,
    }
  }
}

async function forwardRemote(payload: NotificationPayload): Promise<NotificationResult> {
  try {
    // TODO: 实际接入 Webhook/MQTT/FCM 等通道
    log.info('Remote notification payload', payload)
    return {
      requestedChannel: payload.channel || 'remote',
      deliveredChannel: 'remote',
      delivered: true,
    }
  } catch (error) {
    log.error('Remote notification forwarding failed', error)
    return {
      requestedChannel: payload.channel || 'remote',
      deliveredChannel: 'remote',
      delivered: false,
      error: (error as Error).message,
    }
  }
}

export async function dispatchNotification(payload: NotificationPayload): Promise<NotificationResult> {
  const channel = payload.channel || 'local'
  switch (channel) {
    case 'system':
      return showSystemNotification(payload)
    case 'remote':
      return forwardRemote(payload)
    case 'auto': {
      const systemResult = await showSystemNotification({ ...payload, channel: 'system' })
      if (systemResult.delivered) return systemResult
      return {
        requestedChannel: 'auto',
        deliveredChannel: FALLBACK_CHANNEL,
        delivered: false,
        error: systemResult.error,
      }
    }
    default:
      return {
        requestedChannel: channel,
        deliveredChannel: 'local',
        delivered: true,
      }
  }
}

export default {
  dispatchNotification,
}
