import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button, Space, App, Layout, Typography, Divider, Drawer, Modal } from 'antd'
import {
  SaveOutlined,
  UndoOutlined,
  GlobalOutlined,
  DeploymentUnitOutlined,
  PaperClipOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'
import { useConfig, useConfigUpdate } from '../../hooks/useConfig'
import { useTheme } from '../../contexts/ThemeContext'
import { useAppContext } from '../../context/AppContext'
import GeneralSettings from '../../pages/settings/GeneralSettings'
import ObsidianSettings from '../../pages/settings/ObsidianSettings'
import AttachmentSettings from '../../pages/settings/AttachmentSettings'
import AboutSettings from '../../pages/settings/AboutSettings'

const { Sider, Content } = Layout
const { Text } = Typography

export const GlobalSettingsDrawer: React.FC = () => {
  const { message } = App.useApp()
  const { colors, mode } = useTheme()
  const { isSettingsOpen, setIsSettingsOpen } = useAppContext()
  const config = useConfig()
  const { updateConfig } = useConfigUpdate()
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hostname, setHostname] = useState<string>('')
  const [activeKey, setActiveKey] = useState('obsidian')
  const [formInstanceKey, setFormInstanceKey] = useState(0)

  // Form instances for each tab
  const generalFormRef = useRef<any>(null)
  const obsidianFormRef = useRef<any>(null)
  const attachmentFormRef = useRef<any>(null)

  // Get hostname on mount
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getHostname().then(setHostname)
    }
  }, [])

  const resolveTargetHostname = useCallback(() => {
    if (hostname) {
      return hostname
    }
    const computerConfig = config.computer || {}
    const fallbackKey = Object.keys(computerConfig).find((key) => Boolean(key))
    return fallbackKey ?? null
  }, [hostname, config.computer])

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

      // Construct updated config
      const targetHostname = resolveTargetHostname()
      if (!targetHostname) {
        // Fallback or error?
        // message.error('无法获取主机名')
        // Maybe running in browser, just skip hostname check or use default
        message.error('无法获取主机信息，暂时无法保存设置')
        return
      }

      const markdownLogConfig = config.markdown_log || {}
      const computerConfig = config.computer?.[targetHostname] || {}
      const globalConfig = config.global || {}
      const globalObsidian = globalConfig.obsidian || {}
      const globalContentFiles = globalObsidian.content_files || {}
      const globalTodo = globalObsidian.todo || {}
      const attachmentConfig = config.attachment || {}

      const updatedConfig = {
        ...config,
        // 更新 Markdown log 配置
        markdown_log: {
          ...markdownLogConfig,
          file_path: generalValues?.logFilePath || '',
        },
        computer: {
          ...config.computer,
          [targetHostname]: {
            ...computerConfig,
            obsidian: {
              ...computerConfig.obsidian,
              enabled: obsidianValues?.enabled || false,
              vault_path: obsidianValues?.vaultPath || '',
              secrets_file: obsidianValues?.secretsFile || 'secrets.md',
            },
          },
        },
        global: {
          ...globalConfig,
          obsidian: {
            ...globalObsidian,
            content_files: {
              ...globalContentFiles,
              mode: obsidianValues?.fileMode || 'auto',
              template: obsidianValues?.template || '{year}-W{week}.md',
              manual_file: obsidianValues?.manualFile || '',
            },
            todo: {
              ...globalTodo,
              auto_save: obsidianValues?.autoSave || false,
              save_interval: obsidianValues?.saveInterval || 200,
            },
          },
        },
        attachment: {
          ...attachmentConfig,
          storage_mode: attachmentValues?.storageMode || 'local',
          local_path: attachmentValues?.localPath || '',
          picgo_mode: attachmentValues?.picgoMode || 'server',
          // 保持与 Python 版本兼容：use_picgo_server = (picgo_mode == 'server')
          use_picgo_server: (attachmentValues?.picgoMode || 'server') === 'server',
          picgo_server_url: attachmentValues?.picgoServerUrl || 'http://127.0.0.1:36677',
          picgo_path: attachmentValues?.picgoCliPath || 'picgo',
        },
      }

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
    generalFormRef.current = null
    obsidianFormRef.current = null
    attachmentFormRef.current = null
    setFormInstanceKey((key) => key + 1)
    setHasChanges(false)
    message.info('设置已恢复为当前配置')
  }

  const handleClose = () => {
    if (hasChanges) {
      Modal.confirm({
        title: '存在未保存的修改',
        content: '关闭设置抽屉将丢弃当前修改，确定要关闭吗？',
        okText: '放弃修改',
        cancelText: '继续编辑',
        okType: 'danger',
        centered: true,
        onOk: () => {
          setHasChanges(false)
          setIsSettingsOpen(false)
        },
      })
      return
    }
    setIsSettingsOpen(false)
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
    <Drawer
      title="应用设置"
      placement="right"
      onClose={handleClose}
      open={isSettingsOpen}
      width={800}
      closable={false}
      maskClosable
      keyboard
      zIndex={2000}
      styles={{
        body: { padding: 0, overflow: 'hidden' },
        header: { borderBottom: `1px solid ${colors.borderPrimary}`, background: colors.bgSecondary }
      }}
      extra={
        <Space>
          <Button onClick={handleClose}>完成</Button>
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
            保存
          </Button>
        </Space>
      }
    >
      <Layout style={{ height: '100%', background: 'transparent' }}>
        <Sider
          width={220}
          theme={mode}
          style={{
            background: colors.bgSecondary,
            borderRight: `1px solid ${colors.borderPrimary}`,
            height: '100%',
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: '12px 8px' }}>
            <Text type="secondary" style={{ fontSize: 12, paddingLeft: 12, marginBottom: 8, display: 'block' }}>
              PREFERENCES
            </Text>
            <Space direction="vertical" style={{ width: '100%' }} size={2}>
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
          <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
            <div style={{ marginBottom: 24 }}>
              <Text strong style={{ fontSize: 20 }}>
                {menuItems.find((i) => i.key === activeKey)?.label}
              </Text>
              <div style={{ marginTop: 4 }}>
                <Text type="secondary">
                  {activeKey === 'general' && '管理应用的全局外观和行为设置。'}
                  {activeKey === 'obsidian' && '配置 Obsidian 仓库路径及数据同步规则。'}
                  {activeKey === 'attachment' && '设置截图和文件的存储方式，支持本地存储和 PicGo 图床。'}
                  {activeKey === 'about' && '查看应用信息、版本详情和开源许可。'}
                </Text>
              </div>
            </div>
            <Divider style={{ margin: '0 0 24px 0' }} />
            
            <div style={{ display: activeKey === 'general' ? 'block' : 'none' }}>
              <GeneralSettings
                key={`general-${formInstanceKey}`}
                formRef={generalFormRef}
                onChanged={() => setHasChanges(true)}
              />
            </div>
            <div style={{ display: activeKey === 'obsidian' ? 'block' : 'none' }}>
              <ObsidianSettings
                key={`obsidian-${formInstanceKey}`}
                formRef={obsidianFormRef}
                onChanged={() => setHasChanges(true)}
              />
            </div>
            <div style={{ display: activeKey === 'attachment' ? 'block' : 'none' }}>
              <AttachmentSettings
                key={`attachment-${formInstanceKey}`}
                formRef={attachmentFormRef}
                onChanged={() => setHasChanges(true)}
              />
            </div>
            <div style={{ display: activeKey === 'about' ? 'block' : 'none' }}>
              <AboutSettings />
            </div>
          </div>
        </Content>
      </Layout>
    </Drawer>
  )
}
