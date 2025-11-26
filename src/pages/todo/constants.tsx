import { CheckSquareOutlined } from '@ant-design/icons'
import type { WidgetMetadata } from '@/shared/widget-types'

export const DEFAULT_TEMPLATE = '{year}-W{week}.md'
export const DEFAULT_CATEGORIES = ['默认', '工作', '学习', '生活', '娱乐', '其他']

export const TODO_WIDGET_METADATA: WidgetMetadata = {
  id: 'todo',
  displayName: 'TODO 清单',
  icon: <CheckSquareOutlined />,
  description: 'Obsidian 双向同步的待办管理器',
  category: 'productivity',
  order: 1,
  enabled: true,
  requiresObsidian: true,
}

const DOUBLE_LINK_REGEX = /\[\[(.+?)\]\]/

export const extractObsidianLinkTarget = (
  text?: string
): { target: string; alias?: string } | null => {
  if (!text) return null
  const match = text.match(DOUBLE_LINK_REGEX)
  if (!match) return null
  const inner = match[1]
  const [targetPart, aliasPart] = inner.split('|')
  const target = targetPart?.trim()
  if (!target) {
    return null
  }
  return {
    target,
    alias: aliasPart?.trim(),
  }
}

export const stripObsidianLinks = (text: string): string => {
  return text.replace(/\[\[(.+?)\]\]/g, '').trim()
}
