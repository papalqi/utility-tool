/**
 * 设置页面 - 统一的应用设置界面
 *
 * 对应 Python: src/dialogs/settings_dialog.py
 */

import React, { useState, useRef, useEffect } from 'react'
import { Button, Space, App, Layout, Typography, Divider } from 'antd'
import {
  SettingOutlined,
  SaveOutlined,
  UndoOutlined,
  GlobalOutlined,
  DeploymentUnitOutlined,
  PaperClipOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import { WidgetLayout } from '@/components/widgets'
import { useConfig, useConfigUpdate } from '@/hooks/useConfig'
import { useTheme } from '@/contexts/ThemeContext'
import GeneralSettings from './settings/GeneralSettings'
import ObsidianSettings from './settings/ObsidianSettings'
import AttachmentSettings from './settings/AttachmentSettings'
import UpdateChecker from '@/components/widgets/UpdateChecker'

const { Sider, Content } = Layout
const { Text } = Typography

export const SettingsPage: React.FC = () => {
  const { message } = App.useApp()
  const { colors, mode } = useTheme()
  const config = useConfig()
  const { updateConfig } = useConfigUpdate()
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hostname, setHostname] = useState<string>('')
  const [activeKey, setActiveKey] = useState('obsidian')

  // Form instances for each tab
  const generalFormRef = useRef<any>(null)
  const obsidianFormRef = useRef<any>(null)
  const attachmentFormRef = useRef<any>(null)

  // Get hostname on mount
  useEffect(() => {
    window.electronAPI.getHostname().then(setHostname)
  }, [])

  /**
   * 保存所有设置
   */
  const handleSave = async () => {
    try {
      setSaving(true)

      // Collect all form values
      const generalValues = generalFormRef.current?.getFieldsValue()
      const obsidianValues = obsidianFormRef.current?.getFieldsValue()
      const attachmentValues = attachmentFormRef.current?.getFieldsValue()

      console.log('=== 表单值 ===')
      console.log('General:', generalValues)
      console.log('Obsidian:', obsidianValues)
      console.log('Attachment:', attachmentValues)
      console.log('Hostname:', hostname)

      // Construct updated config
      if (!hostname) {
        message.error('无法获取主机名')
        return
      }
      const updatedConfig = {
        ...config,
        // 更新 Markdown log 配置
        markdown_log: {
          ...config.markdown_log,
          file_path: generalValues?.logFilePath || '',
        },
        computer: {
          ...config.computer,
          [hostname]: {
            ...config.computer?.[hostname],
            obsidian: {
              ...config.computer?.[hostname]?.obsidian,
              enabled: obsidianValues?.enabled || false,
              vault_path: obsidianValues?.vaultPath || '',
              secrets_file: obsidianValues?.secretsFile || 'secrets.md',
            },
          },
        },
        global: {
          ...config.global,
          obsidian: {
            ...config.global.obsidian,
            content_files: {
              mode: obsidianValues?.fileMode || 'auto',
              template: obsidianValues?.template || '{year}-W{week}.md',
              manual_file: obsidianValues?.manualFile || '',
            },
            todo: {
              ...config.global.obsidian.todo,
              auto_save: obsidianValues?.autoSave || false,
              save_interval: obsidianValues?.saveInterval || 200,
            },
          },
        },
        attachment: {
          ...config.attachment,
          storage_mode: attachmentValues?.storageMode || 'local',
          local_path: attachmentValues?.localPath || '',
          picgo_mode: attachmentValues?.picgoMode || 'server',
          // 保持与 Python 版本兼容：use_picgo_server = (picgo_mode == 'server')
          use_picgo_server: (attachmentValues?.picgoMode || 'server') === 'server',
          picgo_server_url: attachmentValues?.picgoServerUrl || 'http://127.0.0.1:36677',
          picgo_path: attachmentValues?.picgoCliPath || 'picgo',
        },
      }

      console.log('=== 更新后的配置 ===')
      console.log('Updated Config:', JSON.stringify(updatedConfig, null, 2))

      await updateConfig(updatedConfig)
      setHasChanges(false)
      message.success('设置已保存')
    } catch (error) {
      message.error('保存失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setSaving(false)
    }
  }

  /**
   * 重置设置
   */
  const handleReset = () => {
    // Reset all forms to original config values
    generalFormRef.current?.resetFields()
    obsidianFormRef.current?.resetFields()
    attachmentFormRef.current?.resetFields()
    setHasChanges(false)
    message.info('设置已重置')
  }

  const menuItems = [
    {
      key: 'general',
      label: '通用设置',
      icon: <GlobalOutlined />,
      description: '主题与外观',
    },
    {
      key: 'obsidian',
      label: 'Obsidian',
      icon: <DeploymentUnitOutlined />,
      description: '集成与同步',
    },
    {
      key: 'attachment',
      label: '附件管理',
      icon: <PaperClipOutlined />,
      description: '存储与图床',
    },
    {
      key: 'about',
      label: '关于',
      icon: <InfoCircleOutlined />,
      description: '版本与更新',
    },
  ]

  return (
    <WidgetLayout
      title="设置"
      icon={<SettingOutlined />}
      extra={
        <Space>
          <Button icon={<UndoOutlined />} onClick={handleReset} disabled={saving}>
            重置
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={!hasChanges}
          >
            保存设置
          </Button>
        </Space>
      }
    >
      <Layout style={{ height: '100%', background: 'transparent' }}>
        <Sider
          width={260}
          theme={mode}
          style={{
            background: colors.bgSecondary,
            borderRight: `1px solid ${colors.borderPrimary}`,
            height: '100%',
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: '16px 12px' }}>
            <Text type="secondary" style={{ fontSize: 12, paddingLeft: 12, marginBottom: 8, display: 'block' }}>
              PREFERENCES
            </Text>
            <Space direction="vertical" style={{ width: '100%' }} size={4}>
              {menuItems.map((item) => (
                <div
                  key={item.key}
                  onClick={() => setActiveKey(item.key)}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    borderRadius: 6,
                    background: activeKey === item.key ? colors.bgTertiary : 'transparent',
                    color: activeKey === item.key ? colors.primary : colors.textPrimary,
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 500 }}>{item.label}</span>
                    <span style={{ fontSize: 11, opacity: 0.7, color: colors.textSecondary }}>{item.description}</span>
                  </div>
                </div>
              ))}
            </Space>
          </div>
        </Sider>
        <Content
          style={{
            height: '100%',
            overflowY: 'auto',
            padding: 0,
            background: colors.bgPrimary,
          }}
        >
          <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
            <div style={{ marginBottom: 24 }}>
              <Text strong style={{ fontSize: 24 }}>
                {menuItems.find((i) => i.key === activeKey)?.label}
              </Text>
              <div style={{ marginTop: 4 }}>
                <Text type="secondary">
                  {activeKey === 'general' && '管理应用的全局外观和行为设置。'}
                  {activeKey === 'obsidian' && '配置 Obsidian 仓库路径及数据同步规则。'}
                  {activeKey === 'attachment' && '设置截图和文件的存储方式，支持本地存储和 PicGo 图床。'}
                  {activeKey === 'about' && '查看应用版本信息并检查更新。'}
                </Text>
              </div>
            </div>
            <Divider style={{ margin: '0 0 24px 0' }} />
            
            <div style={{ display: activeKey === 'general' ? 'block' : 'none' }}>
              <GeneralSettings formRef={generalFormRef} onChanged={() => setHasChanges(true)} />
            </div>
            <div style={{ display: activeKey === 'obsidian' ? 'block' : 'none' }}>
              <ObsidianSettings formRef={obsidianFormRef} onChanged={() => setHasChanges(true)} />
            </div>
            <div style={{ display: activeKey === 'attachment' ? 'block' : 'none' }}>
              <AttachmentSettings formRef={attachmentFormRef} onChanged={() => setHasChanges(true)} />
            </div>
            <div style={{ display: activeKey === 'about' ? 'block' : 'none' }}>
              <UpdateChecker />
            </div>
          </div>
        </Content>
      </Layout>
    </WidgetLayout>
  )
}

export default SettingsPage
