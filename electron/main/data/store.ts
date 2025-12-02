/**
 * 本地持久化存储
 * 用于存储不适合放在 Obsidian Vault 的数据（如临时状态、敏感信息等）
 */

import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import log from '../logger'

interface StoreData {
  [key: string]: unknown
}

class LocalStore {
  private data: StoreData = {}
  private filePath: string
  private saveTimeout: NodeJS.Timeout | null = null
  private readonly saveDebounce = 1000 // 1秒防抖

  constructor(name: string) {
    // 存储在用户数据目录
    const userDataPath = app.getPath('userData')
    this.filePath = join(userDataPath, `${name}.json`)
    this.load()
  }

  /**
   * 获取值
   */
  get<T>(key: string, defaultValue?: T): T | undefined {
    const keys = key.split('.')
    let value: unknown = this.data

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k]
      } else {
        return defaultValue
      }
    }

    return (value as T) ?? defaultValue
  }

  /**
   * 设置值
   */
  set<T>(key: string, value: T): void {
    const keys = key.split('.')
    let current = this.data

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i]
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {}
      }
      current = current[k] as StoreData
    }

    current[keys[keys.length - 1]] = value
    this.scheduleSave()
  }

  /**
   * 删除值
   */
  delete(key: string): boolean {
    const keys = key.split('.')
    let current = this.data

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i]
      if (!(k in current)) {
        return false
      }
      current = current[k] as StoreData
    }

    const lastKey = keys[keys.length - 1]
    if (lastKey in current) {
      delete current[lastKey]
      this.scheduleSave()
      return true
    }
    return false
  }

  /**
   * 检查是否存在
   */
  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  /**
   * 获取所有数据
   */
  getAll(): StoreData {
    return { ...this.data }
  }

  /**
   * 清除所有数据
   */
  clear(): void {
    this.data = {}
    this.scheduleSave()
  }

  /**
   * 立即保存
   */
  flush(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }
    this.save()
  }

  // ==================== 私有方法 ====================

  private load(): void {
    try {
      if (existsSync(this.filePath)) {
        const content = readFileSync(this.filePath, 'utf-8')
        this.data = JSON.parse(content)
        log.debug('[LocalStore] Loaded data', { path: this.filePath })
      }
    } catch (error) {
      log.error('[LocalStore] Failed to load data', error)
      this.data = {}
    }
  }

  private save(): void {
    try {
      const dir = dirname(this.filePath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
      log.debug('[LocalStore] Saved data', { path: this.filePath })
    } catch (error) {
      log.error('[LocalStore] Failed to save data', error)
    }
  }

  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }
    this.saveTimeout = setTimeout(() => {
      this.save()
      this.saveTimeout = null
    }, this.saveDebounce)
  }
}

// ==================== 预定义存储实例 ====================

/** 应用状态存储 */
export const appStore = new LocalStore('app-state')

/** 窗口状态存储 */
export const windowStore = new LocalStore('window-state')

/** 临时数据存储 */
export const tempStore = new LocalStore('temp-data')

// 导出类以便创建自定义存储
export { LocalStore }
