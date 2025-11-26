/**
 * Widget 工具函数
 * 提供常用的工具方法
 */

import { WidgetMetadata } from '@/shared/widget-types'

/**
 * 格式化时间戳
 */
export function formatTimestamp(
  timestamp: number,
  format: 'date' | 'time' | 'datetime' = 'datetime'
): string {
  const date = new Date(timestamp)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  switch (format) {
    case 'date':
      return `${year}-${month}-${day}`
    case 'time':
      return `${hours}:${minutes}:${seconds}`
    case 'datetime':
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

/**
 * 深拷贝对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as T
  }

  if (obj instanceof Object) {
    const clonedObj = {} as T
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        clonedObj[key] = deepClone(obj[key])
      }
    }
    return clonedObj
  }

  return obj
}

/**
 * 生成唯一 ID
 */
export function generateId(prefix = 'widget'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 文件大小格式化
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * 延迟执行
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 重试函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number
    delay?: number
    onRetry?: (error: Error, attempt: number) => void
  } = {}
): Promise<T> {
  const { retries = 3, delay = 1000, onRetry } = options

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt < retries) {
        onRetry?.(lastError, attempt)
        await sleep(delay * attempt)
      }
    }
  }

  throw lastError
}

/**
 * 安全的 JSON 解析
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return defaultValue
  }
}

/**
 * 检查 Widget 是否需要 Obsidian
 */
export function requiresObsidian(metadata: WidgetMetadata): boolean {
  return metadata.requiresObsidian === true
}

/**
 * 按分类和排序权重排序 Widget
 */
export function sortWidgets(widgets: WidgetMetadata[]): WidgetMetadata[] {
  return [...widgets].sort((a, b) => {
    // 先按分类排序
    if (a.category !== b.category) {
      const categoryOrder = ['productivity', 'tools', 'development', 'general']
      return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
    }
    // 同分类按 order 排序
    return a.order - b.order
  })
}

/**
 * 过滤已启用的 Widget
 */
export function getEnabledWidgets(widgets: WidgetMetadata[]): WidgetMetadata[] {
  return widgets.filter((w) => w.enabled)
}

/**
 * 按 ID 查找 Widget
 */
export function findWidgetById(widgets: WidgetMetadata[], id: string): WidgetMetadata | undefined {
  return widgets.find((w) => w.id === id)
}

/**
 * 截断字符串
 */
export function truncate(str: string, maxLength: number, ellipsis = '...'): string {
  if (str.length <= maxLength) {
    return str
  }
  return str.slice(0, maxLength - ellipsis.length) + ellipsis
}

/**
 * 转义 HTML
 */
export function escapeHtml(str: string): string {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

/**
 * 复制到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  }
}

/**
 * 从剪贴板读取
 */
export async function readFromClipboard(): Promise<string> {
  try {
    return await navigator.clipboard.readText()
  } catch {
    return ''
  }
}

/**
 * 检查是否为有效的 URL
 */
export function isValidUrl(str: string): boolean {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}

/**
 * 高亮搜索关键词
 */
export function highlightText(text: string, search: string): string {
  if (!search) return text

  const regex = new RegExp(`(${search})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}
