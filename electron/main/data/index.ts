/**
 * 数据访问层入口
 * 统一导出所有数据访问相关模块
 */

// 类型定义
export type {
  GitHubRepoData,
  TodoItemData,
  CalendarEventData,
  PomodoroRecordData,
  AIConversationData,
  CacheEntry,
  CacheOptions,
  StoreOptions,
} from './types'

// 缓存管理器
import { cacheManager } from './cache.manager'
export { cacheManager }

// Obsidian DAO
import { obsidianDAO } from './obsidian.dao'
export { obsidianDAO }

// 本地存储
import { appStore, windowStore, tempStore, LocalStore } from './store'
export { appStore, windowStore, tempStore, LocalStore }

/**
 * 初始化数据层
 */
export function initializeDataLayer(): void {
  // 初始化 Obsidian DAO
  obsidianDAO.initialize()
}

/**
 * 清理数据层
 */
export function cleanupDataLayer(): void {
  // 清理缓存
  cacheManager.clear()

  // 刷新存储
  appStore.flush()
  windowStore.flush()
  tempStore.flush()
}
