/**
 * 缓存管理器
 * 提供内存缓存，支持 TTL 和命名空间
 */

import type { CacheEntry, CacheOptions } from './types'
import log from '../logger'

class CacheManager {
  private cache = new Map<string, CacheEntry<unknown>>()
  private defaultTTL = 5 * 60 * 1000 // 5分钟

  /**
   * 获取缓存
   */
  get<T>(key: string, namespace?: string): T | null {
    const fullKey = this.buildKey(key, namespace)
    const entry = this.cache.get(fullKey) as CacheEntry<T> | undefined

    if (!entry) {
      return null
    }

    // 检查是否过期
    if (this.isExpired(entry)) {
      this.cache.delete(fullKey)
      log.debug(`[CacheManager] Cache expired: ${fullKey}`)
      return null
    }

    log.debug(`[CacheManager] Cache hit: ${fullKey}`)
    return entry.data
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, options?: CacheOptions): void {
    const fullKey = this.buildKey(key, options?.namespace)
    const ttl = options?.ttl ?? this.defaultTTL

    this.cache.set(fullKey, {
      data,
      timestamp: Date.now(),
      ttl,
    })

    log.debug(`[CacheManager] Cache set: ${fullKey}, TTL: ${ttl}ms`)
  }

  /**
   * 检查缓存是否存在且有效
   */
  has(key: string, namespace?: string): boolean {
    const fullKey = this.buildKey(key, namespace)
    const entry = this.cache.get(fullKey)
    return entry !== undefined && !this.isExpired(entry)
  }

  /**
   * 删除缓存
   */
  delete(key: string, namespace?: string): boolean {
    const fullKey = this.buildKey(key, namespace)
    return this.cache.delete(fullKey)
  }

  /**
   * 使匹配的缓存失效
   */
  invalidate(pattern: string | RegExp): number {
    let count = 0
    for (const key of this.cache.keys()) {
      const matches =
        typeof pattern === 'string' ? key.startsWith(pattern) : pattern.test(key)
      if (matches) {
        this.cache.delete(key)
        count++
      }
    }
    if (count > 0) {
      log.debug(`[CacheManager] Invalidated ${count} entries matching: ${pattern}`)
    }
    return count
  }

  /**
   * 使命名空间下的所有缓存失效
   */
  invalidateNamespace(namespace: string): number {
    return this.invalidate(new RegExp(`^${namespace}:`))
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    const count = this.cache.size
    this.cache.clear()
    log.debug(`[CacheManager] Cleared ${count} entries`)
  }

  /**
   * 获取缓存统计
   */
  getStats(): { size: number; namespaces: string[] } {
    const namespaces = new Set<string>()
    for (const key of this.cache.keys()) {
      const parts = key.split(':')
      if (parts.length > 1) {
        namespaces.add(parts[0])
      }
    }
    return {
      size: this.cache.size,
      namespaces: Array.from(namespaces),
    }
  }

  /**
   * 清理过期缓存
   */
  cleanup(): number {
    let count = 0
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key)
        count++
      }
    }
    if (count > 0) {
      log.debug(`[CacheManager] Cleaned up ${count} expired entries`)
    }
    return count
  }

  /**
   * 设置默认 TTL
   */
  setDefaultTTL(ttl: number): void {
    this.defaultTTL = ttl
  }

  // ==================== 私有方法 ====================

  private buildKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }
}

export const cacheManager = new CacheManager()
