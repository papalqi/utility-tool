/**
 * 附件缩略图组件
 * 用于在 TODO 中显示附件缩略图和文件信息
 */

/* eslint-disable react/prop-types */
import { Space, Image, Tag, Tooltip } from 'antd'
import {
  PaperClipOutlined,
  FileImageOutlined,
  FileOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import type { Attachment } from '../shared/types'
import { configManager } from '../core/ConfigManager'

interface AttachmentThumbnailProps {
  attachments: Attachment[]
  maxDisplay?: number
}

export const AttachmentThumbnail: React.FC<AttachmentThumbnailProps> = ({
  attachments,
  maxDisplay = 3,
}) => {
  const imageAttachments = attachments.filter((att) => att.type === 'image')
  const displayAttachments = imageAttachments.slice(0, maxDisplay)
  const remaining = imageAttachments.length - maxDisplay

  const getAttachmentFullPath = (attachment: Attachment): string => {
    if (attachment.path.startsWith('http://') || attachment.path.startsWith('https://')) {
      return attachment.path
    } else {
      const config = configManager.getConfig()
      const localPath = config.attachment?.local_path || 'data/obsidian_vault/attachments'
      return `${localPath}/${attachment.path}`
    }
  }

  const getFileIcon = (attachment: Attachment) => {
    switch (attachment.type) {
      case 'image':
        return <FileImageOutlined />
      case 'video':
        return <VideoCameraOutlined />
      default:
        return <FileOutlined />
    }
  }

  return (
    <Space size={4}>
      {/* 显示图片缩略图 */}
      {displayAttachments.map((att, index) => (
        <Tooltip key={index} title={att.name}>
          <Image
            src={getAttachmentFullPath(att)}
            alt={att.name}
            width={40}
            height={40}
            style={{
              objectFit: 'cover',
              borderRadius: '3px',
              border: '1px solid #d9d9d9',
              cursor: 'pointer',
            }}
            preview={{
              mask: <div style={{ fontSize: '12px' }}>预览</div>,
            }}
            fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23f5f5f5'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='20'%3E🖼️%3C/text%3E%3C/svg%3E"
          />
        </Tooltip>
      ))}

      {/* 显示剩余数量 */}
      {remaining > 0 && <Tag style={{ marginLeft: '4px', fontSize: '11px' }}>+{remaining}</Tag>}

      {/* 显示非图片附件 */}
      {attachments
        .filter((att) => att.type !== 'image')
        .map((att, index) => (
          <Tooltip key={`file-${index}`} title={att.name}>
            <Tag icon={getFileIcon(att)} style={{ cursor: 'pointer' }}>
              {att.name.length > 10 ? att.name.substring(0, 10) + '...' : att.name}
            </Tag>
          </Tooltip>
        ))}

      {/* 总附件数量 */}
      {attachments.length > 0 && (
        <Tag icon={<PaperClipOutlined />} color="default">
          {attachments.length}
        </Tag>
      )}
    </Space>
  )
}
