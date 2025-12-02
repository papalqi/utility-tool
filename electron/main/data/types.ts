/**
 * 数据访问层类型定义
 */

// ==================== GitHub ====================

export interface GitHubRepoData {
  name: string
  path: string
  url: string
  branch?: string
  ahead?: number
  behind?: number
  modified?: number
  lastSync?: number
}

// ==================== Todo ====================

export interface TodoItemData {
  id: string
  title: string
  description?: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
  tags?: string[]
  createdAt: number
  updatedAt: number
}

// ==================== Calendar ====================

export interface CalendarEventData {
  id: string
  title: string
  description?: string
  date: string // YYYY-MM-DD
  time?: string // HH:mm
  duration?: number // 分钟
  type: 'event' | 'task' | 'reminder'
  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
    until?: string
  }
}

// ==================== Pomodoro ====================

export interface PomodoroRecordData {
  id: string
  taskName: string
  startTime: number
  endTime: number
  duration: number // 分钟
  completed: boolean
  tags?: string[]
}

// ==================== AI Conversation ====================

export interface AIConversationData {
  id: string
  feature: string
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  timestamp: number
  metadata?: Record<string, unknown>
}

// ==================== 缓存类型 ====================

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export interface CacheOptions {
  ttl?: number
  namespace?: string
}

// ==================== 存储类型 ====================

export interface StoreOptions {
  name: string
  defaults?: Record<string, unknown>
}
