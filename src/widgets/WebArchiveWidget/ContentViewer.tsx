/**
 * 内容查看器组件
 */

import React, { useState } from 'react'
import { Tabs, Typography, Space, Image, Tag, Descriptions, Empty } from 'antd'
import {
  FileTextOutlined,
  FileImageOutlined,
  LinkOutlined,
  CodeOutlined,
} from '@ant-design/icons'
import type { WebArchiveContent } from './types'

const { Text, Paragraph } = Typography
const { TabPane } = Tabs

interface ContentViewerProps {
  content?: WebArchiveContent
}

export const ContentViewer: React.FC<ContentViewerProps> = ({ content }) => {
  const [activeTab, setActiveTab] = useState('metadata')

  if (!content) {
    return <Empty description="暂无内容" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }

  const hasText = !!content.text
  const hasHtml = !!content.html
  const hasImages = content.images && content.images.length > 0
  const hasLinks = content.links && content.links.length > 0
  const hasCustomFields = content.customFields && Object.keys(content.customFields).length > 0

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ height: '100%' }}>
        {/* 元数据 */}
        <TabPane tab="元数据" key="metadata" icon={<FileTextOutlined />}>
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="标题">{content.title || '-'}</Descriptions.Item>
            <Descriptions.Item label="描述">{content.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="抓取时间">
              {new Date(content.timestamp).toLocaleString('zh-CN')}
            </Descriptions.Item>
            <Descriptions.Item label="内容大小">
              {(content.size / 1024).toFixed(2)} KB
            </Descriptions.Item>
            {content.images && (
              <Descriptions.Item label="图片数量">{content.images.length}</Descriptions.Item>
            )}
            {content.links && (
              <Descriptions.Item label="链接数量">{content.links.length}</Descriptions.Item>
            )}
          </Descriptions>

          {hasCustomFields && (
            <div style={{ marginTop: 16 }}>
              <Text strong>自定义字段</Text>
              <Descriptions bordered column={1} size="small" style={{ marginTop: 8 }}>
                {Object.entries(content.customFields!).map(([key, value]) => (
                  <Descriptions.Item key={key} label={key}>
                    {value}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </div>
          )}
        </TabPane>

        {/* 文本内容 */}
        {hasText && (
          <TabPane tab="文本" key="text" icon={<FileTextOutlined />}>
            <Paragraph
              style={{
                whiteSpace: 'pre-wrap',
                maxHeight: '500px',
                overflow: 'auto',
                padding: 16,
                background: '#f5f5f5',
                borderRadius: 4,
              }}
            >
              {content.text}
            </Paragraph>
          </TabPane>
        )}

        {/* HTML 源码 */}
        {hasHtml && (
          <TabPane tab="HTML" key="html" icon={<CodeOutlined />}>
            <pre
              style={{
                maxHeight: '500px',
                overflow: 'auto',
                padding: 16,
                background: '#f5f5f5',
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              {content.html}
            </pre>
          </TabPane>
        )}

        {/* 图片 */}
        {hasImages && (
          <TabPane tab={`图片 (${content.images!.length})`} key="images" icon={<FileImageOutlined />}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {content.images!.map((url, index) => (
                <div key={index} style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                    {url}
                  </Text>
                  <Image
                    src={url}
                    alt={`Image ${index + 1}`}
                    style={{ maxWidth: '100%', borderRadius: 4 }}
                    fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                  />
                </div>
              ))}
            </Space>
          </TabPane>
        )}

        {/* 链接 */}
        {hasLinks && (
          <TabPane tab={`链接 (${content.links!.length})`} key="links" icon={<LinkOutlined />}>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              {content.links!.map((url, index) => (
                <div key={index}>
                  <Tag
                    color="blue"
                    style={{ cursor: 'pointer', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    onClick={() => window.electronAPI.openExternal(url)}
                  >
                    <LinkOutlined style={{ marginRight: 4 }} />
                    {url}
                  </Tag>
                </div>
              ))}
            </Space>
          </TabPane>
        )}
      </Tabs>
    </div>
  )
}
