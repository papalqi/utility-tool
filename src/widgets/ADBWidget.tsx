/**
 * ADB Widget - Android 调试工具（重构版）
 */

import React from 'react'
import {
  AndroidOutlined,
  ReloadOutlined,
  FolderOpenOutlined,
  PlayCircleOutlined,
  CloudUploadOutlined,
  CloudDownloadOutlined,
  CameraOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { Button, Divider, Input, List, Space, Tag, Tabs, Typography, message } from 'antd'
import { WidgetLayout, WidgetSection } from '@/components/widgets'
import { useWidget } from '@/hooks/useWidget'
import { useWidgetActions } from '@/hooks/useWidgetActions'
import { useWidgetConfig } from '@/hooks/useWidgetConfig'
import { useWidgetStorage } from '@/hooks/useWidgetStorage'
import type { WidgetMetadata } from '@/shared/widget-types'
import type { ADBConfig } from '@/shared/types'
import { useADBTool } from '@/hooks/api/useADBTool'

const { Text, Paragraph } = Typography

// ==================== Metadata ====================

const metadata: WidgetMetadata = {
  id: 'adb',
  displayName: 'ADB 工具',
  icon: <AndroidOutlined />,
  description: '管理 Android 设备、执行调试命令和文件传输',
  category: 'development',
  order: 6,
  enabled: true,
}

const defaultAdbConfig: ADBConfig = {
  adb_path: 'adb',
  refresh_interval: 10,
  default_download_dir: '',
}

const quickCommandPresets = [
  { label: '设备列表', args: ['devices', '-l'] },
  { label: '重启设备', args: ['reboot'] },
  { label: '查看属性', args: ['shell', 'getprop'] },
  { label: '电量信息', args: ['shell', 'dumpsys', 'battery'] },
  { label: '当前 Activity', args: ['shell', 'dumpsys', 'activity', 'top'] },
]

const statusColorMap: Record<string, string> = {
  device: 'green',
  offline: 'red',
  unauthorized: 'orange',
}

// ==================== 组件实现 ====================

const ADBWidget: React.FC = () => {
  const { config: adbConfig, updateConfig } = useWidgetConfig<ADBConfig>({
    section: 'adb',
    defaultConfig: defaultAdbConfig,
  })

  const { state, widgetLogger } = useWidget({ metadata })

  const { value: commandHistory, setValue: setCommandHistory } = useWidgetStorage<{ commands: string[] }>({
    key: 'adb-command-history',
    defaultValue: { commands: [] },
    persist: true,
  })

  const [activeTab, setActiveTab] = React.useState('devices')

  // 使用重构后的 Hook
  const adb = useADBTool({
    config: adbConfig,
    onMessage: (type, content) => message[type](content),
    onLog: (level, msg, data) => widgetLogger[level](msg, data),
    onConfigUpdate: updateConfig,
  })

  const { refresh, isActionInProgress } = useWidgetActions({
    widgetId: metadata.id,
    onRefresh: async () => {
      await adb.checkAdb()
      await adb.fetchDevices()
    },
  })

  // 更新命令历史
  const updateCommandHistory = (command: string) => {
    if (!command.trim()) return
    setCommandHistory((prev) => {
      const uniqueCommands = [command.trim(), ...prev.commands.filter((item) => item !== command.trim())]
      return { commands: uniqueCommands.slice(0, 10) }
    })
  }

  const handleRunCommand = async () => {
    updateCommandHistory(adb.commandInput)
    await adb.runCommand()
  }

  const layoutLoading = adb.loading || adb.devicesLoading

  const tabContentStyle = { display: 'flex', flexDirection: 'column', gap: 16 } as const

  // ========== Tab 内容 ==========

  const deviceTab = (
    <div style={tabContentStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Space size="small">
          <Text type="secondary">ADB 状态</Text>
          {adb.adbStatus ? <Tag color={adb.adbStatus.ok ? 'green' : 'red'}>{adb.adbStatus.message}</Tag> : <Tag>未检测</Tag>}
        </Space>
        <Button icon={<ReloadOutlined />} onClick={adb.fetchDevices} loading={adb.devicesLoading}>刷新设备</Button>
      </div>
      <List
        rowKey={(device) => device.id}
        dataSource={adb.devices}
        locale={{ emptyText: adb.adbStatus?.ok ? '尚未检测到设备' : '请先检查 ADB 状态' }}
        renderItem={(device) => (
          <List.Item
            onClick={() => adb.selectDevice(device.id)}
            style={{
              cursor: 'pointer',
              border: adb.selectedDeviceId === device.id ? '1px solid #1677ff' : '1px solid transparent',
              borderRadius: 8,
              padding: 12,
            }}
          >
            <Space direction="vertical" size={4}>
              <Space>
                <Text strong>{device.id}</Text>
                <Tag color={statusColorMap[device.status] || 'cyan'}>{device.status}</Tag>
              </Space>
              <Text type="secondary">{device.manufacturer || 'Unknown'} {device.model || ''}</Text>
              {device.androidVersion && <Text type="secondary">Android {device.androidVersion}</Text>}
            </Space>
          </List.Item>
        )}
      />
    </div>
  )

  const commandTab = (
    <div style={tabContentStyle}>
      <Space.Compact style={{ width: '100%' }}>
        <Input value={adb.commandInput} onChange={(e) => adb.setCommandInput(e.target.value)} placeholder="shell getprop ro.product.model" />
        <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleRunCommand}>执行</Button>
      </Space.Compact>

      <Space wrap>
        {quickCommandPresets.map((preset) => (
          <Button
            key={preset.label}
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() => {
              const command = preset.args.join(' ')
              adb.setCommandInput(command)
              message.success(`自动填充命令: ${command}`)
            }}
          >
            {preset.label}
          </Button>
        ))}
      </Space>

      {commandHistory.commands.length > 0 && (
        <>
          <Divider orientation="left" plain>历史命令</Divider>
          <Space wrap>
            {commandHistory.commands.map((command) => (
              <Tag key={command} color="geekblue" style={{ cursor: 'pointer' }} onClick={() => adb.setCommandInput(command)}>{command}</Tag>
            ))}
          </Space>
        </>
      )}

      <Divider orientation="left" plain>输出</Divider>
      <div style={{ background: '#0b1522', color: '#c5f4ff', minHeight: 200, maxHeight: 320, overflowY: 'auto', borderRadius: 8, padding: 12, fontFamily: 'Consolas, monospace', fontSize: 13 }}>
        {adb.outputLines.length === 0 ? (
          <Text type="secondary">等待命令执行...</Text>
        ) : (
          adb.outputLines.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)
        )}
      </div>
    </div>
  )

  const fileTab = (
    <div style={tabContentStyle}>
      <div>
        <Text strong>上传文件</Text>
        <Space.Compact style={{ width: '100%', marginTop: 8 }}>
          <Input value={adb.transferState.uploadLocalPath} placeholder="选择本地文件" onChange={(e) => adb.setTransferState((prev) => ({ ...prev, uploadLocalPath: e.target.value }))} />
          <Button onClick={adb.selectUploadFile}>选择</Button>
        </Space.Compact>
        <Input style={{ marginTop: 8 }} value={adb.transferState.uploadRemotePath} placeholder="/sdcard/Download/" onChange={(e) => adb.setTransferState((prev) => ({ ...prev, uploadRemotePath: e.target.value }))} />
        <Button type="primary" icon={<CloudUploadOutlined />} style={{ marginTop: 8 }} onClick={adb.pushFile}>上传</Button>
      </div>

      <Divider />

      <div>
        <Text strong>下载文件</Text>
        <Input style={{ marginTop: 8 }} value={adb.transferState.downloadRemotePath} placeholder="/sdcard/Download/example.txt" onChange={(e) => adb.setTransferState((prev) => ({ ...prev, downloadRemotePath: e.target.value }))} />
        <Space.Compact style={{ width: '100%', marginTop: 8 }}>
          <Input value={adb.transferState.downloadDir} placeholder="本地保存目录" onChange={(e) => adb.setTransferState((prev) => ({ ...prev, downloadDir: e.target.value }))} />
          <Button onClick={adb.selectDownloadDir}>选择目录</Button>
        </Space.Compact>
        <Button icon={<CloudDownloadOutlined />} style={{ marginTop: 8 }} onClick={adb.pullFile}>下载</Button>
      </div>
    </div>
  )

  const quickActionsTab = (
    <div style={tabContentStyle}>
      <Space wrap>
        <Button icon={<CloudUploadOutlined />} onClick={adb.installApk} loading={adb.isInstallingApk}>安装 APK</Button>
        <Button icon={<CameraOutlined />} onClick={adb.screenshot}>截图</Button>
        <Button icon={<PlayCircleOutlined />} onClick={adb.screenRecord} loading={adb.isRecording}>屏幕录制</Button>
        <Button icon={<FileTextOutlined />} onClick={adb.logcat}>导出 Logcat</Button>
        <Button icon={<FolderOpenOutlined />} onClick={() => setActiveTab('files')}>文件传输</Button>
        <Button icon={<AndroidOutlined />} onClick={adb.getDeviceInfo}>设备信息</Button>
      </Space>

      {adb.lastScreenshotPath && <Paragraph copyable ellipsis={{ rows: 2 }}>最近截图：{adb.lastScreenshotPath}</Paragraph>}

      {adb.lastLogcat && (
        <Paragraph copyable style={{ marginTop: 8, maxHeight: 150, overflow: 'auto', background: '#111', color: '#9ef', padding: 12, borderRadius: 6, fontFamily: 'Consolas, monospace' }}>
          {adb.lastLogcat.slice(0, 500)} {adb.lastLogcat.length > 500 ? '...' : ''}
        </Paragraph>
      )}
    </div>
  )

  const tabItems = [
    { key: 'devices', label: '设备管理', children: deviceTab },
    { key: 'commands', label: 'Shell 命令', children: commandTab },
    { key: 'files', label: '文件传输', children: fileTab },
    { key: 'quick', label: '快捷操作', children: quickActionsTab },
  ]

  // ========== UI 渲染 ==========

  return (
    <WidgetLayout title={metadata.displayName} icon={metadata.icon} loading={layoutLoading} error={state.error} showRefresh onRefresh={refresh} actionInProgress={isActionInProgress}>
      <WidgetSection title="ADB 配置" icon={<AndroidOutlined />}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input value={adb.pendingAdbPath} onChange={(e) => adb.setPendingAdbPath(e.target.value)} placeholder="adb 或完整路径" />
            <Button icon={<FolderOpenOutlined />} onClick={adb.selectAdbPath}>浏览</Button>
            <Button type="primary" onClick={adb.saveAdbPath}>保存</Button>
          </Space.Compact>

          <Space>
            <Button icon={<ReloadOutlined />} onClick={adb.checkAdb} loading={adb.isCheckingAdb}>检查 ADB</Button>
            {adb.adbStatus && <Tag color={adb.adbStatus.ok ? 'green' : 'red'}>{adb.adbStatus.message}</Tag>}
          </Space>
        </Space>
      </WidgetSection>

      <WidgetSection title="ADB 控制台" icon={<ThunderboltOutlined />}>
        <Tabs type="card" destroyOnHidden={false} items={tabItems} style={{ width: '100%' }} activeKey={activeTab} onChange={setActiveTab} />
      </WidgetSection>
    </WidgetLayout>
  )
}

export default ADBWidget
