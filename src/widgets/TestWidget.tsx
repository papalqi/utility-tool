import React, { useCallback, useMemo, useState } from 'react'
import { App, Button, Card, Space, Typography } from 'antd'
import {
  ExperimentOutlined,
  NotificationOutlined,
  ShareAltOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { WidgetLayout, WidgetSection } from '@/components/widgets'
import { useWidget } from '@/hooks/useWidget'
import useNotifier from '@/hooks/useNotifier'
import type { WidgetMetadata } from '@/shared/widget-types'

const { Paragraph, Text } = Typography

const metadata: WidgetMetadata = {
  id: 'test-widget',
  displayName: 'Dev Test Widget',
  icon: <ExperimentOutlined />,
  description: '仅在开发模式显示，用于验证提示/通知管线',
  category: 'development',
  order: 999,
  enabled: true,
}

const TestWidget: React.FC = () => {
  const isDev = useMemo(() => import.meta.env.DEV, [])
  const { message } = App.useApp()
  const { state, setStatus } = useWidget({ metadata })
  const { notify } = useNotifier()
  const [lastRemotePayload, setLastRemotePayload] = useState<string>('')

  const showLocalToast = useCallback(async () => {
    await notify({
      channel: 'local',
      severity: 'success',
      title: '本地提示',
      message: '本地 message 成功弹出 🎉',
    })
    setStatus('展示本地 toast 成功')
  }, [notify, setStatus])

  const showSystemNotification = useCallback(async () => {
    const result = await notify(
      {
        channel: 'system',
        severity: 'info',
        title: 'PC Utility Tool (Dev)',
        message: '系统级通知示例，可以在三端统一复用。',
      },
      { fallback: ['local'] }
    )
    if (!result.delivered) {
      message.warning(`系统通知失败：${result.error || '未知错误'}`)
    }
    setStatus('系统通知已发送')
  }, [message, notify, setStatus])

  const simulateRemotePush = useCallback(async () => {
    const payload = {
      id: Date.now(),
      title: '远程提示模拟',
      message: '未来可以接入 Webhook/MQTT/QoS 通道',
      sentAt: new Date().toISOString(),
    }
    await notify({
      channel: 'remote',
      severity: 'info',
      title: payload.title,
      message: payload.message,
      metadata: { sentAt: payload.sentAt },
    })
    setLastRemotePayload(JSON.stringify(payload, null, 2))
    message.info('已生成远程提示 payload（仅记录，不实际推送）')
    setStatus('远程提示 payload 就绪')
  }, [message, notify, setStatus])

  if (!isDev) {
    return (
      <WidgetLayout
        title={metadata.displayName}
        icon={metadata.icon}
        loading={state.loading}
        error="该 Widget 仅在开发模式启用"
      >
        <Text type="secondary">请在 dev 模式查看提示调试工具。</Text>
      </WidgetLayout>
    )
  }

  return (
    <WidgetLayout
      title={metadata.displayName}
      icon={metadata.icon}
      loading={state.loading}
      error={state.error}
      showRefresh
      onRefresh={() => {
        setLastRemotePayload('')
        setStatus('已重置状态')
      }}
    >
      <WidgetSection title="本地提示 (Ant Design message)" icon={<ThunderboltOutlined />}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Paragraph>调用 `App.useApp().message` 在 renderer 内统一展示 toast。</Paragraph>
          <Button type="primary" onClick={showLocalToast}>
            触发本地提示
          </Button>
        </Space>
      </WidgetSection>

      <WidgetSection title="系统通知 (Electron)" icon={<NotificationOutlined />}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Paragraph>
            通过 `window.electronAPI.showNotification`
            触发主进程的系统级通知（macOS/Windows/Linux）。
          </Paragraph>
          <Button onClick={() => void showSystemNotification()}>发送系统通知</Button>
        </Space>
      </WidgetSection>

      <WidgetSection title="远程提示模拟" icon={<ShareAltOutlined />}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Paragraph>
            这里模拟未来的远程推送接口：生成 JSON payload，后续可接 Webhook/MQTT/Push Service。
          </Paragraph>
          <Button type="dashed" onClick={() => void simulateRemotePush()}>
            生成远程提示 payload
          </Button>
          {lastRemotePayload ? (
            <Card size="small" style={{ background: '#111', color: '#fefefe' }}>
              <pre style={{ margin: 0 }}>{lastRemotePayload}</pre>
            </Card>
          ) : (
            <Text type="secondary">尚未生成 payload</Text>
          )}
        </Space>
      </WidgetSection>
    </WidgetLayout>
  )
}

export default TestWidget
