/**
 * 附件设置标签页
 *
 * 对应 Python: settings_dialog.py 的 create_attachment_tab()
 */

import React, { useState, useEffect } from 'react'
import { Form, Input, Button, Radio, InputNumber, Select, Space, message, Alert, Typography } from 'antd'
import {
  FolderOpenOutlined,
  ExperimentOutlined,
  HddOutlined,
  CloudUploadOutlined,
  ControlOutlined,
} from '@ant-design/icons'
import { useConfig } from '@/hooks/useConfig'
import { WidgetSection } from '@/components/widgets'

const { Option } = Select
const { Text } = Typography

interface AttachmentSettingsProps {
  formRef: React.MutableRefObject<any>
  onChanged: () => void
}

export const AttachmentSettings: React.FC<AttachmentSettingsProps> = ({ formRef, onChanged }) => {
  const config = useConfig()
  const [form] = Form.useForm()
  const [storageMode, setStorageMode] = useState<'local' | 'picgo'>('local')
  const [picgoMode, setPicgoMode] = useState<'server' | 'cli'>('server')

  // Expose form instance to parent
  useEffect(() => {
    formRef.current = form
  }, [form, formRef])

  /**
   * 从配置加载
   */
  useEffect(() => {
    const attachment = config.attachment
    if (attachment) {
      const mode = attachment.storage_mode || 'local'
      setStorageMode(mode)

      // 移除 URL 末尾的 /upload 路径（如果存在）
      let serverUrl = attachment.picgo_server_url || 'http://127.0.0.1:36677/upload'
      serverUrl = serverUrl.replace(/\/upload$/, '')

      const pgMode = attachment.picgo_mode || (attachment.use_picgo_server ? 'server' : 'cli')
      setPicgoMode(pgMode)

      form.setFieldsValue({
        storageMode: mode,
        localPath: attachment.local_path || '',
        picgoMode: pgMode,
        picgoServerUrl: serverUrl,
        picgoCliPath: attachment.picgo_path || '',
        autoUploadThreshold: Math.floor(
          (attachment.auto_upload_threshold || 5242880) / 1024 / 1024
        ),
        markdownFormat: attachment.markdown_format || 'obsidian',
      })
    }
  }, [config, form])

  /**
   * 选择本地路径
   */
  const handleSelectLocalPath = async () => {
    const path = await window.electronAPI.selectFolder({ title: '选择附件存储路径' })
    if (path) {
      form.setFieldValue('localPath', path)
      onChanged()
    }
  }

  /**
   * 选择 PicGo CLI 路径
   */
  const handleSelectPicGoCli = async () => {
    const path = await window.electronAPI.selectFile({
      title: '选择 PicGo 可执行文件',
    })
    if (path) {
      form.setFieldValue('picgoCliPath', path)
      onChanged()
    }
  }

  /**
   * 测试 PicGo Server 连接
   */
  const handleTestPicGoServer = async () => {
    let url = form.getFieldValue('picgoServerUrl')
    if (!url) {
      url = 'http://127.0.0.1:36677'
    }

    // 移除末尾的斜杠
    url = url.replace(/\/$/, '')

    try {
      // 尝试连接到 PicGo Server
      const response = await window.electronAPI.httpGet(url)

      const statusNote = response.status === 404 ? '（根路径返回 404 是正常的）' : ''
      message.success({
        content: `✅ PicGo Server 连接成功！\n\nURL: ${url}\n状态码: ${response.status} ${statusNote}`,
        duration: 3,
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误'
      message.warning({
        content: `❌ 无法连接到 PicGo Server\n\nURL: ${url}\n\n请检查：\n1. PicGo 是否已启动\n2. Server 功能是否已开启\n3. URL 和端口是否正确\n\n错误: ${errorMsg}`,
        duration: 5,
      })
    }
  }

  return (
    <div style={{ padding: 0 }}>
      <Form form={form} layout="vertical">
        {/* 存储模式 */}
        <WidgetSection title="存储模式" icon={<HddOutlined />} defaultCollapsed={false}>
          <Alert
            message="选择附件存储方式"
            description="决定截图和上传的文件保存在哪里。"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Form.Item name="storageMode" style={{ marginBottom: 0 }}>
            <Radio.Group
              onChange={(e) => {
                const value = e.target.value
                form.setFieldValue('storageMode', value)
                setStorageMode(value)
                onChanged()
              }}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Radio value="local" style={{ marginBottom: 12 }}>
                  <Space direction="vertical" size={0}>
                    <strong>本地存储</strong>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      直接存储在本地硬盘的指定目录中
                    </Text>
                  </Space>
                </Radio>
                <Radio value="picgo">
                  <Space direction="vertical" size={0}>
                    <strong>PicGo 图床</strong>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      通过 PicGo 自动上传到云端图床（如 GitHub, S3, SM.MS 等）
                    </Text>
                  </Space>
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
        </WidgetSection>

        {/* 本地存储配置 */}
        {storageMode === 'local' && (
          <WidgetSection title="本地存储配置" icon={<FolderOpenOutlined />} defaultCollapsed={false}>
            <Form.Item label="存储路径">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="localPath" noStyle>
                  <Input placeholder="/path/to/attachments" />
                </Form.Item>
                <Button icon={<FolderOpenOutlined />} onClick={handleSelectLocalPath}>
                  浏览
                </Button>
              </Space.Compact>
            </Form.Item>
          </WidgetSection>
        )}

        {/* PicGo 配置 */}
        {storageMode === 'picgo' && (
          <WidgetSection title="PicGo 图床配置" icon={<CloudUploadOutlined />} defaultCollapsed={false}>
            <Form.Item label="PicGo 模式" name="picgoMode">
              <Radio.Group
                onChange={(e) => {
                  const value = e.target.value
                  form.setFieldValue('picgoMode', value)
                  setPicgoMode(value)
                  onChanged()
                }}
              >
                <Space direction="vertical">
                  <Radio value="server">
                    <strong>PicGo Server (推荐)</strong>
                    <Text type="secondary" style={{ display: 'block', marginLeft: 24, fontSize: 12 }}>
                      通过 HTTP 端口调用 PicGo (需要先启动 PicGo 客户端)
                    </Text>
                  </Radio>
                  <Radio value="cli">
                    <strong>PicGo CLI</strong>
                    <Text type="secondary" style={{ display: 'block', marginLeft: 24, fontSize: 12 }}>
                      调用 picgo 命令行工具上传
                    </Text>
                  </Radio>
                </Space>
              </Radio.Group>
            </Form.Item>

            {picgoMode === 'server' && (
              <Form.Item label="PicGo Server URL">
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="picgoServerUrl" noStyle>
                    <Input placeholder="http://127.0.0.1:36677" />
                  </Form.Item>
                  <Button icon={<ExperimentOutlined />} onClick={handleTestPicGoServer}>
                    测试连接
                  </Button>
                </Space.Compact>
              </Form.Item>
            )}

            {picgoMode === 'cli' && (
              <Form.Item label="PicGo CLI 路径">
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="picgoCliPath" noStyle>
                    <Input placeholder="/path/to/picgo" />
                  </Form.Item>
                  <Button icon={<FolderOpenOutlined />} onClick={handleSelectPicGoCli}>
                    浏览
                  </Button>
                </Space.Compact>
              </Form.Item>
            )}
          </WidgetSection>
        )}

        {/* 高级选项 */}
        <WidgetSection title="高级选项" icon={<ControlOutlined />} defaultCollapsed={false}>
          <Form.Item
            label="自动上传阈值 (MB)"
            name="autoUploadThreshold"
            help="文件大小超过此阈值时自动上传到图床 (0-100 MB)"
          >
            <Space.Compact>
              <InputNumber min={0} max={100} step={1} style={{ width: 160 }} onChange={onChanged} />
              <Input disabled value="MB" style={{ width: 40, textAlign: 'center' }} />
            </Space.Compact>
          </Form.Item>

          <Form.Item label="Markdown 格式" name="markdownFormat" help="选择生成的 Markdown 链接格式">
            <Select style={{ width: 200 }} onChange={onChanged}>
              <Option value="obsidian">Obsidian 格式</Option>
              <Option value="standard">标准格式</Option>
            </Select>
          </Form.Item>
        </WidgetSection>
      </Form>
    </div>
  )
}

export default AttachmentSettings
