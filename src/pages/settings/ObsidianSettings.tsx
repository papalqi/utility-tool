/**
 * Obsidian 设置标签页
 *
 * 对应 Python: settings_dialog.py 的 create_obsidian_tab()
 */

import React, { useState, useEffect } from 'react'
import { Form, Input, Button, Switch, Radio, InputNumber, Space, App, Typography, Alert } from 'antd'
import {
  FolderOpenOutlined,
  FileTextOutlined,
  PlusOutlined,
  ExperimentOutlined,
  DatabaseOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { useConfig } from '@/hooks/useConfig'
import { WidgetSection } from '@/components/widgets'

interface ObsidianSettingsProps {
  formRef: React.MutableRefObject<any>
  onChanged: () => void
}

const { Text } = Typography

export const ObsidianSettings: React.FC<ObsidianSettingsProps> = ({ formRef, onChanged }) => {
  const { message } = App.useApp()
  const config = useConfig()
  const [form] = Form.useForm()

  // Expose form instance to parent
  useEffect(() => {
    formRef.current = form
  }, [form, formRef])
  const [fileMode, setFileMode] = useState<'auto' | 'manual'>('auto')
  const [currentFile, setCurrentFile] = useState('')
  const [obsidianEnabled, setObsidianEnabled] = useState(false)
  const [hostname, setHostname] = useState<string>('')

  // Normalize separators so we can safely compare paths on all platforms
  const normalizePath = (value?: string, trimTrailingSlash = false) => {
    if (!value) return ''
    let normalized = value.replace(/\\/g, '/')
    normalized = normalized.replace(/\/+/g, '/')
    if (trimTrailingSlash) {
      normalized = normalized.replace(/\/$/, '')
    }
    return normalized
  }

  /**
   * 获取当前计算机名称
   */
  useEffect(() => {
    window.electronAPI.getHostname().then(setHostname)
  }, [])

  /**
   * 从配置加载
   */
  useEffect(() => {
    if (!hostname) return

    const obsidianConfig = config.computer?.[hostname]?.obsidian

    if (obsidianConfig) {
      form.setFieldsValue({
        enabled: obsidianConfig.enabled || false,
        vaultPath: obsidianConfig.vault_path || '',
        secretsFile: obsidianConfig.secrets_file || 'secrets.md',
      })
      setObsidianEnabled(obsidianConfig.enabled || false)
    }

    const contentFiles = config.global?.obsidian?.content_files
    if (contentFiles) {
      const mode = contentFiles.mode || 'auto'
      setFileMode(mode)
      form.setFieldsValue({
        fileMode: mode,
        template: contentFiles.template || '{year}-W{week}.md',
        manualFile: contentFiles.manual_file || '',
      })
      updateCurrentFile(mode, contentFiles.template, contentFiles.manual_file)
    }

    const todoConfig = config.global?.obsidian?.todo
    if (todoConfig) {
      form.setFieldsValue({
        autoSave: todoConfig.auto_save || false,
        saveInterval: todoConfig.save_interval || 200,
      })
    }
  }, [config, form, hostname])

  /**
   * 更新当前文件预览
   */
  const updateCurrentFile = (mode: string, template?: string, manual?: string) => {
    if (mode === 'manual') {
      setCurrentFile(manual || '')
    } else {
      // 解析模板
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const week = getWeekNumber(now)
      const date = `${year}-${month}-${day}`

      let path = template || '{year}-W{week}.md'
      path = path.replace(/\{year\}/g, String(year))
      path = path.replace(/\{month\}/g, month)
      path = path.replace(/\{week\}/g, String(week).padStart(2, '0'))
      path = path.replace(/\{day\}/g, day)
      path = path.replace(/\{date\}/g, date)

      setCurrentFile(path)
    }
  }

  /**
   * 获取 ISO 周数
   */
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  }

  /**
   * 选择 Vault 路径
   */
  const handleSelectVault = async () => {
    console.log('=== 选择 Vault 路径 ===')
    try {
      const path = await window.electronAPI.selectFolder({ title: '选择 Obsidian Vault' })
      console.log('选择的路径:', path)
      if (path) {
        form.setFieldValue('vaultPath', path)
        console.log('已设置表单值:', path)
        onChanged()
      } else {
        console.log('用户取消了选择')
      }
    } catch (error) {
      console.error('选择文件夹失败 - 完整错误:', error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      message.error({
        content: `选择文件夹失败: ${errorMsg}`,
        duration: 5,
      })
    }
  }

  /**
   * 选择 Secrets 文件
   */
  const handleSelectSecrets = async () => {
    const vaultPath = form.getFieldValue('vaultPath')

    const path = await window.electronAPI.selectFile({
      title: '选择 Secrets 文件',
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      defaultPath: vaultPath,
    })

    if (path) {
      const normalizedVault = normalizePath(vaultPath, true)
      const normalizedSelection = normalizePath(path)
      // Windows file pickers return backslashes, normalize before comparison
      if (normalizedVault && normalizedSelection.startsWith(normalizedVault + '/')) {
        const relativePath = normalizedSelection.substring(normalizedVault.length + 1)
        form.setFieldValue('secretsFile', relativePath)
        console.log('使用相对路径:', relativePath)
      } else {
        form.setFieldValue('secretsFile', path)
        console.log('使用绝对路径:', path)
      }
      onChanged()
    }
  }

  /**
   * 创建 Secrets 文件
   */
  const handleCreateSecrets = async () => {
    const vaultPath = form.getFieldValue('vaultPath')
    if (!vaultPath) {
      message.warning('请先选择 Vault 路径')
      return
    }

    const secretsFile = form.getFieldValue('secretsFile') || 'secrets.md'
    const fullPath = `${vaultPath}/${secretsFile}`

    const template = `# API Keys and Secrets

openai_api_key: your-key-here
deepseek_api_key: your-key-here
`

    try {
      await window.electronAPI.writeFile(fullPath, template)
      message.success(`Secrets 文件已创建: ${fullPath}`)
    } catch (error) {
      message.error('创建失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  /**
   * 选择手动文件
   */
  const handleSelectManualFile = async () => {
    const path = await window.electronAPI.selectFile({
      title: '选择内容文件',
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (path) {
      form.setFieldValue('manualFile', path)
      updateCurrentFile('manual', undefined, path)
      onChanged()
    }
  }

  /**
   * 测试 Obsidian 配置
   */
  const handleTestConfig = async () => {
    const vaultPath = form.getFieldValue('vaultPath')
    const secretsFile = form.getFieldValue('secretsFile') || 'secrets.md'

    if (!vaultPath) {
      message.warning('请先配置 Vault 路径')
      return
    }

    try {
      const fullPath = `${vaultPath}/${secretsFile}`
      console.log('测试路径:', fullPath)
      await window.electronAPI.readFile(fullPath)
      message.success(`配置测试成功！\n文件路径: ${fullPath}`)
    } catch (error) {
      console.error('测试失败:', error)
      message.error(
        `配置测试失败\n尝试的路径: ${vaultPath}/${secretsFile}\n错误: ${error instanceof Error ? error.message : '文件不存在或无法访问'}`
      )
    }
  }

  /**
   * 文件模式变化
   */
  const handleFileModeChange = (e: any) => {
    const mode = e.target.value
    form.setFieldValue('fileMode', mode)
    setFileMode(mode)
    const template = form.getFieldValue('template')
    const manual = form.getFieldValue('manualFile')
    updateCurrentFile(mode, template, manual)
    onChanged()
  }

  /**
   * 模板变化
   */
  const handleTemplateChange = (e: any) => {
    const template = e.target.value
    form.setFieldValue('template', template)
    updateCurrentFile('auto', template)
    onChanged()
  }

  return (
    <div style={{ padding: 0 }}>
      <Form form={form} layout="vertical">
        {/* Obsidian 库设置 */}
        <WidgetSection title="Obsidian 连接" icon={<DatabaseOutlined />} defaultCollapsed={false}>
          <Alert
            type="info"
            message="配置 Obsidian Vault 路径以启用双向同步功能"
            style={{ marginBottom: 24 }}
          />

          <Form.Item label="启用集成" name="enabled" valuePropName="checked" style={{ marginBottom: 24 }}>
            <Switch
              onChange={(checked) => {
                form.setFieldValue('enabled', checked)
                setObsidianEnabled(checked)
                onChanged()
              }}
            />
          </Form.Item>

          <Form.Item label="Vault 路径">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="vaultPath" noStyle>
                <Input placeholder="/path/to/obsidian/vault" disabled={!obsidianEnabled} />
              </Form.Item>
              <Button
                icon={<FolderOpenOutlined />}
                onClick={handleSelectVault}
                disabled={!obsidianEnabled}
              >
                浏览
              </Button>
            </Space.Compact>
          </Form.Item>

          <Form.Item label="Secrets 文件">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="secretsFile" noStyle>
                <Input placeholder="secrets.md" disabled={!obsidianEnabled} />
              </Form.Item>
              <Button
                icon={<FileTextOutlined />}
                onClick={handleSelectSecrets}
                disabled={!obsidianEnabled}
              >
                浏览
              </Button>
              <Button
                icon={<PlusOutlined />}
                onClick={handleCreateSecrets}
                disabled={!obsidianEnabled}
              >
                创建
              </Button>
            </Space.Compact>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              icon={<ExperimentOutlined />}
              onClick={handleTestConfig}
              disabled={!obsidianEnabled}
            >
              测试连接
            </Button>
          </Form.Item>
        </WidgetSection>

        {/* 内容文件设置 */}
        <WidgetSection title="内容文件" icon={<FileTextOutlined />} defaultCollapsed={false}>
          <Form.Item label="文件模式" name="fileMode">
            <Radio.Group onChange={handleFileModeChange} disabled={!obsidianEnabled}>
              <Space direction="vertical">
                <Radio value="auto">
                  <strong>自动模式</strong>
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    使用模板自动生成文件名 (e.g. 2023-W45.md)
                  </Text>
                </Radio>
                <Radio value="manual">
                  <strong>手动模式</strong>
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    指定固定的文件路径
                  </Text>
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          {fileMode === 'auto' && (
            <Form.Item
              label="文件名模板"
              name="template"
              help="支持变量: {year} {month} {week} {day} {date}"
            >
              <Input
                placeholder="{year}-W{week}.md"
                onChange={handleTemplateChange}
                disabled={!obsidianEnabled}
              />
            </Form.Item>
          )}

          {fileMode === 'manual' && (
            <Form.Item label="内容文件路径">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="manualFile" noStyle>
                  <Input placeholder="/path/to/content.md" disabled={!obsidianEnabled} />
                </Form.Item>
                <Button
                  icon={<FileTextOutlined />}
                  onClick={handleSelectManualFile}
                  disabled={!obsidianEnabled}
                >
                  浏览
                </Button>
              </Space.Compact>
            </Form.Item>
          )}

          {currentFile && (
            <div style={{ 
              background: 'rgba(0,0,0,0.02)', 
              padding: '8px 12px', 
              borderRadius: 4,
              border: '1px dashed #ccc',
              marginTop: 8 
            }}>
              <Text type="secondary" style={{ fontSize: 12 }}>当前预览: </Text>
              <Text code>{currentFile}</Text>
            </div>
          )}
        </WidgetSection>

        {/* TODO 同步设置 */}
        <WidgetSection title="同步设置" icon={<SyncOutlined />} defaultCollapsed={false}>
          <Form.Item label="自动同步" name="autoSave" valuePropName="checked" style={{ marginBottom: 12 }}>
            <Switch
              onChange={(checked) => {
                form.setFieldValue('autoSave', checked)
                onChanged()
              }}
              disabled={!obsidianEnabled}
            />
          </Form.Item>

          <Form.Item label="同步间隔" name="saveInterval" help="自动保存的时间间隔 (秒)">
            <Space.Compact>
              <InputNumber
                min={5}
                max={300}
                step={5}
                style={{ width: 120 }}
                disabled={!obsidianEnabled}
                onChange={(value) => {
                  form.setFieldValue('saveInterval', value)
                  onChanged()
                }}
              />
              <Input disabled value="秒" style={{ width: 40, textAlign: 'center' }} />
            </Space.Compact>
          </Form.Item>
        </WidgetSection>
      </Form>
    </div>
  )
}

export default ObsidianSettings
