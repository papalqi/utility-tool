/**
 * Widget 类型定义
 * 定义所有 Widget 的通用接口和元数据
 */

import { ReactNode } from 'react'

/**
 * Widget 元数据
 * 对应 Python BaseWidget 的类属性
 */
export interface WidgetMetadata {
  /** Widget 唯一标识符 */
  id: string
  /** 显示名称 */
  displayName: string
  /** 图标（可以是 emoji 或图标组件） */
  icon: ReactNode
  /** 描述 */
  description: string
  /** 分类 */
  category: 'productivity' | 'tools' | 'development' | 'general'
  /** 排序权重（越小越靠前） */
  order: number
  /** 是否启用 */
  enabled: boolean
  /** 是否需要 Obsidian 集成 */
  requiresObsidian?: boolean
}

/**
 * Widget 生命周期钩子
 */
export interface WidgetLifecycle {
  /** 初始化时调用 */
  onInit?: () => void | Promise<void>
  /** 配置变化时调用 */
  onConfigChange?: () => void | Promise<void>
  /** 主题变化时调用 */
  onThemeChange?: () => void | Promise<void>
  /** 组件挂载时调用 */
  onMount?: () => void | Promise<void>
  /** 组件卸载时调用（清理资源） */
  onUnmount?: () => void | Promise<void>
}

/**
 * Widget 状态
 */
export interface WidgetState {
  /** 是否正在加载 */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 状态消息 */
  statusMessage: string
  /** 是否已初始化 */
  initialized: boolean
}

/**
 * Widget Props
 * 所有 Widget 组件接收的通用 props
 */
export interface WidgetProps {
  /** Widget 元数据 */
  metadata?: WidgetMetadata
  /** 生命周期钩子 */
  lifecycle?: WidgetLifecycle
  /** 额外的类名 */
  className?: string
}

/**
 * Widget 配置段落类型
 * 用于 useWidgetConfig hook
 */
export type WidgetConfigSection =
  | 'scripts'
  | 'quick_access'
  | 'pomodoro'
  | 'todo'
  | 'calendar'
  | 'adb'
  | 'attachment'
  | 'file_transfer'
  | 'terminal'
  | 'theme'
  | 'web_archive'

/**
 * Widget 事件
 */
export interface WidgetEvents {
  /** 状态变化事件 */
  onStatusChange?: (status: string) => void
  /** 错误事件 */
  onError?: (error: Error) => void
  /** 配置变化事件 */
  onConfigChange?: () => void
}

/**
 * Widget 操作接口
 */
export interface WidgetActions {
  /** 刷新数据 */
  refresh?: () => Promise<void>
  /** 保存数据 */
  save?: () => Promise<void>
  /** 重置 */
  reset?: () => void
  /** 导出数据 */
  export?: () => void
}

/**
 * Widget 上下文
 * 通过 Context 提供给所有 Widget
 */
export interface WidgetContext {
  /** 当前激活的 Widget ID */
  activeWidgetId: string
  /** 设置激活的 Widget */
  setActiveWidget: (id: string) => void
  /** 注册 Widget */
  registerWidget: (metadata: WidgetMetadata) => void
  /** 注销 Widget */
  unregisterWidget: (id: string) => void
  /** 获取所有注册的 Widget */
  getWidgets: () => WidgetMetadata[]
}
