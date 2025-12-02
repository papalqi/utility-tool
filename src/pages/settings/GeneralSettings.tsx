/**
 * 通用设置标签页
 *
 * 对应 Python: settings_dialog.py 的 create_general_tab()
 */

import React, { useEffect } from 'react'
import { Form, Input, Button, Alert, Space, Radio, Switch, Typography } from 'antd'
import { FileTextOutlined, SkinOutlined, ReadOutlined, BugOutlined } from '@ant-design/icons'
import { useConfig } from '@/hooks/useConfig'
import { useTheme } from '@/contexts/ThemeContext'
import { WidgetSection } from '@/components/widgets'
import { useAppContext } from '@/context/AppContext'

interface GeneralSettingsProps {
  formRef: React.MutableRefObject<any>
  onChanged: () => void
}

const { Text } = Typography

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({ formRef, onChanged }) => {
  const config = useConfig()
  const { mode, setTheme, isAutoSwitch, enableAutoSwitch, disableAutoSwitch } = useTheme()
  const { isLogViewerOpen, setIsLogViewerOpen } = useAppContext()
  const [form] = Form.useForm()

  // Expose form instance to parent
  useEffect(() => {
    formRef.current = form
  }, [form, formRef])

  /**
   * 从配置加载
   */
  useEffect(() => {
    const markdownLog = config.markdown_log
    if (markdownLog) {
      form.setFieldsValue({
        logFilePath: markdownLog.file_path || '',
      })
    }
  }, [config, form])

  /**
   * 选择日志文件
   */
  const handleSelectLogFile = async () => {
    const path = await window.electronAPI.selectFile({
      title: '选择 Markdown 日志文件',
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (path) {
      form.setFieldValue('logFilePath', path)
      onChanged()
    }
  }

  const handleThemeChange = (e: any) => {
    setTheme(e.target.value)
  }

  const handleAutoSwitchChange = (checked: boolean) => {
    if (checked) {
      enableAutoSwitch()
    } else {
      disableAutoSwitch()
    }
  }

  return (
    <div style={{ padding: 0 }}>
      <Form form={form} layout="vertical">
        <WidgetSection title="外观设置" icon={<SkinOutlined />} defaultCollapsed={false}>
          <Form.Item label="主题模式" style={{ marginBottom: 16 }}>
            <Radio.Group value={mode} onChange={handleThemeChange} disabled={isAutoSwitch}>
              <Radio.Button value="light">明亮 (Light)</Radio.Button>
              <Radio.Button value="dark">暗黑 (Dark)</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item label="自动切换" style={{ marginBottom: 0 }}>
            <Space>
              <Switch checked={isAutoSwitch} onChange={handleAutoSwitchChange} />
              <Text type="secondary">根据时间自动切换 (Dark: 18:00, Light: 08:00)</Text>
            </Space>
          </Form.Item>
        </WidgetSection>

        <WidgetSection title="Markdown 集成" icon={<ReadOutlined />} defaultCollapsed={false}>
          <Alert
            message="Markdown 日志"
            description="配置共享的 Markdown 日志文件，用于记录各种活动的流水账。"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Form.Item label="共享记录文件路径">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="logFilePath" noStyle>
                <Input placeholder="/path/to/log.md" onChange={onChanged} />
              </Form.Item>
              <Button icon={<FileTextOutlined />} onClick={handleSelectLogFile}>
                浏览
              </Button>
            </Space.Compact>
          </Form.Item>
        </WidgetSection>

        <WidgetSection title="日志与诊断" icon={<BugOutlined />} defaultCollapsed={false}>
          <Form.Item label="实时日志面板" style={{ marginBottom: 0 }}>
            <Space align="center">
              <Switch checked={isLogViewerOpen} onChange={setIsLogViewerOpen} />
              <Text type="secondary">
                {isLogViewerOpen ? '日志面板已在右侧打开' : '用于查看 widgetLogger 与系统事件输出'}
              </Text>
            </Space>
          </Form.Item>
        </WidgetSection>
      </Form>
    </div>
  )
}

export default GeneralSettings
