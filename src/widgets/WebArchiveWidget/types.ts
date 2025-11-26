/**
 * WebArchive Widget 内部类型
 */

export * from '@/shared/web-archive-types'

/**
 * Widget UI 状态
 */
export interface WebArchiveUIState {
  /** 当前选中的存档项 ID */
  selectedId: string | null
  /** 搜索关键字 */
  searchText: string
  /** 排序方式 */
  sortBy: 'createdAt' | 'lastCrawled' | 'title' | 'url'
  /** 排序顺序 */
  sortOrder: 'asc' | 'desc'
  /** 视图模式 */
  viewMode: 'list' | 'grid'
}
