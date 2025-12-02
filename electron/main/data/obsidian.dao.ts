/**
 * Obsidian Vault 数据访问对象
 * 封装所有与 Obsidian Vault 的读写操作
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { configManager } from '../config'
import {
  parseGitHubReposMarkdown,
  updateGitHubReposMarkdown,
  parseGitHubFavoritesSection,
  updateGitHubFavoritesSection,
  GitHubRepoEntry,
} from '../utils/markdown-parser'
import { cacheManager } from './cache.manager'
import type { TodoItemData, CalendarEventData, PomodoroRecordData } from './types'
import log from '../logger'

// 缓存命名空间
const CACHE_NS = 'obsidian'

class ObsidianDAO {
  private vaultPath: string | null = null

  /**
   * 初始化 Vault 路径
   */
  initialize(): void {
    this.refreshVaultPath()
  }

  /**
   * 刷新 Vault 路径配置
   */
  refreshVaultPath(): void {
    const config = configManager.getObsidianConfig()
    if ('vault_path' in config && config.vault_path) {
      this.vaultPath = config.vault_path
      log.info('[ObsidianDAO] Vault path configured', { path: this.vaultPath })
    } else {
      this.vaultPath = null
      log.debug('[ObsidianDAO] Vault path not configured')
    }
  }

  /**
   * 检查 Vault 是否可用
   */
  isAvailable(): boolean {
    return this.vaultPath !== null && existsSync(this.vaultPath)
  }

  /**
   * 获取 Vault 路径
   */
  getVaultPath(): string {
    if (!this.vaultPath) {
      throw new Error('Obsidian vault not configured')
    }
    if (!existsSync(this.vaultPath)) {
      throw new Error(`Obsidian vault not found: ${this.vaultPath}`)
    }
    return this.vaultPath
  }

  // ==================== 通用文件操作 ====================

  /**
   * 读取文件
   */
  readFile(relativePath: string): string | null {
    try {
      const fullPath = join(this.getVaultPath(), relativePath)
      if (!existsSync(fullPath)) {
        return null
      }
      return readFileSync(fullPath, 'utf-8')
    } catch (error) {
      log.error(`[ObsidianDAO] Failed to read file: ${relativePath}`, error)
      return null
    }
  }

  /**
   * 写入文件
   */
  writeFile(relativePath: string, content: string): void {
    const fullPath = join(this.getVaultPath(), relativePath)
    const dir = dirname(fullPath)

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    writeFileSync(fullPath, content, 'utf-8')
    log.debug(`[ObsidianDAO] File written: ${relativePath}`)
  }

  /**
   * 文件是否存在
   */
  fileExists(relativePath: string): boolean {
    try {
      return existsSync(join(this.getVaultPath(), relativePath))
    } catch {
      return false
    }
  }

  // ==================== GitHub Repos ====================

  /**
   * 读取 GitHub 仓库列表
   */
  readGitHubRepos(hostname: string): GitHubRepoEntry[] {
    // 检查缓存
    const cacheKey = `github-repos:${hostname}`
    const cached = cacheManager.get<GitHubRepoEntry[]>(cacheKey, CACHE_NS)
    if (cached) {
      return cached
    }

    const content = this.readFile('github-repos.md')
    if (!content) {
      return []
    }

    const repos = parseGitHubReposMarkdown(content, hostname)
    cacheManager.set(cacheKey, repos, { namespace: CACHE_NS, ttl: 60000 }) // 1分钟缓存
    return repos
  }

  /**
   * 写入 GitHub 仓库列表
   */
  writeGitHubRepos(hostname: string, repos: GitHubRepoEntry[]): void {
    let content = this.readFile('github-repos.md') || '# GitHub Local Repositories\n\n'
    content = updateGitHubReposMarkdown(content, hostname, repos)
    this.writeFile('github-repos.md', content)

    // 更新缓存
    cacheManager.set(`github-repos:${hostname}`, repos, { namespace: CACHE_NS })
    log.info('[ObsidianDAO] GitHub repos saved', { hostname, count: repos.length })
  }

  /**
   * 读取 GitHub 收藏
   */
  readGitHubFavorites(): string[] {
    const cacheKey = 'github-favorites'
    const cached = cacheManager.get<string[]>(cacheKey, CACHE_NS)
    if (cached) {
      return cached
    }

    const content = this.readFile('github-repos.md')
    if (!content) {
      return []
    }

    const favorites = parseGitHubFavoritesSection(content)
    cacheManager.set(cacheKey, favorites, { namespace: CACHE_NS })
    return favorites
  }

  /**
   * 写入 GitHub 收藏
   */
  writeGitHubFavorites(favorites: string[]): void {
    let content = this.readFile('github-repos.md') || '# GitHub Local Repositories\n\n'
    content = updateGitHubFavoritesSection(content, favorites)
    this.writeFile('github-repos.md', content)
    cacheManager.set('github-favorites', favorites, { namespace: CACHE_NS })
  }

  // ==================== Todo Items ====================

  /**
   * 读取 Todo 列表
   */
  readTodoItems(): TodoItemData[] {
    const cacheKey = 'todos'
    const cached = cacheManager.get<TodoItemData[]>(cacheKey, CACHE_NS)
    if (cached) {
      return cached
    }

    const content = this.readFile('todo.md')
    if (!content) {
      return []
    }

    const items = this.parseTodoMarkdown(content)
    cacheManager.set(cacheKey, items, { namespace: CACHE_NS })
    return items
  }

  /**
   * 写入 Todo 列表
   */
  writeTodoItems(items: TodoItemData[]): void {
    const content = this.generateTodoMarkdown(items)
    this.writeFile('todo.md', content)
    cacheManager.set('todos', items, { namespace: CACHE_NS })
  }

  // ==================== Calendar Events ====================

  /**
   * 读取日历事件
   */
  readCalendarEvents(year: number, month: number): CalendarEventData[] {
    const cacheKey = `calendar:${year}-${month}`
    const cached = cacheManager.get<CalendarEventData[]>(cacheKey, CACHE_NS)
    if (cached) {
      return cached
    }

    const fileName = `calendar-${year}-${String(month).padStart(2, '0')}.md`
    const content = this.readFile(`calendar/${fileName}`)
    if (!content) {
      return []
    }

    const events = this.parseCalendarMarkdown(content)
    cacheManager.set(cacheKey, events, { namespace: CACHE_NS })
    return events
  }

  /**
   * 写入日历事件
   */
  writeCalendarEvents(year: number, month: number, events: CalendarEventData[]): void {
    const fileName = `calendar-${year}-${String(month).padStart(2, '0')}.md`
    const content = this.generateCalendarMarkdown(events, year, month)
    this.writeFile(`calendar/${fileName}`, content)
    cacheManager.set(`calendar:${year}-${month}`, events, { namespace: CACHE_NS })
  }

  // ==================== Pomodoro Records ====================

  /**
   * 读取番茄钟记录
   */
  readPomodoroRecords(date: string): PomodoroRecordData[] {
    const cacheKey = `pomodoro:${date}`
    const cached = cacheManager.get<PomodoroRecordData[]>(cacheKey, CACHE_NS)
    if (cached) {
      return cached
    }

    const fileName = `pomodoro/${date}.md`
    const content = this.readFile(fileName)
    if (!content) {
      return []
    }

    const records = this.parsePomodoroMarkdown(content)
    cacheManager.set(cacheKey, records, { namespace: CACHE_NS })
    return records
  }

  /**
   * 追加番茄钟记录
   */
  appendPomodoroRecord(record: PomodoroRecordData): void {
    const date = new Date(record.startTime).toISOString().split('T')[0]
    const records = this.readPomodoroRecords(date)
    records.push(record)

    const content = this.generatePomodoroMarkdown(records, date)
    this.writeFile(`pomodoro/${date}.md`, content)
    cacheManager.set(`pomodoro:${date}`, records, { namespace: CACHE_NS })
  }

  // ==================== 缓存管理 ====================

  /**
   * 使所有 Obsidian 缓存失效
   */
  invalidateCache(): void {
    cacheManager.invalidateNamespace(CACHE_NS)
  }

  /**
   * 使特定类型的缓存失效
   */
  invalidateCacheFor(type: 'github' | 'todos' | 'calendar' | 'pomodoro'): void {
    cacheManager.invalidate(new RegExp(`^${CACHE_NS}:${type}`))
  }

  // ==================== 私有解析方法 ====================

  private parseTodoMarkdown(content: string): TodoItemData[] {
    const items: TodoItemData[] = []
    const lines = content.split('\n')
    const now = Date.now()

    for (const line of lines) {
      // 匹配 - [ ] 或 - [x] 格式
      const match = line.match(/^- \[([ x])\] (.+)/)
      if (match) {
        const completed = match[1] === 'x'
        const title = match[2]

        // 提取标签
        const tagMatch = title.match(/#(\w+)/g)
        const tags = tagMatch ? tagMatch.map((t) => t.slice(1)) : []

        // 提取优先级
        let priority: 'low' | 'medium' | 'high' = 'medium'
        if (title.includes('🔴') || title.includes('[high]')) priority = 'high'
        else if (title.includes('🟢') || title.includes('[low]')) priority = 'low'

        items.push({
          id: `todo-${items.length}`,
          title: title.replace(/#\w+/g, '').trim(),
          completed,
          priority,
          tags,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    return items
  }

  private generateTodoMarkdown(items: TodoItemData[]): string {
    const lines = ['# Todo List', '', '']

    for (const item of items) {
      const checkbox = item.completed ? '[x]' : '[ ]'
      const priorityIcon = item.priority === 'high' ? '🔴 ' : item.priority === 'low' ? '🟢 ' : ''
      const tags = item.tags?.length ? ' ' + item.tags.map((t) => `#${t}`).join(' ') : ''
      lines.push(`- ${checkbox} ${priorityIcon}${item.title}${tags}`)
    }

    return lines.join('\n')
  }

  private parseCalendarMarkdown(content: string): CalendarEventData[] {
    const events: CalendarEventData[] = []
    const lines = content.split('\n')
    let currentDate = ''

    for (const line of lines) {
      // 匹配日期标题 ## 2024-01-15
      const dateMatch = line.match(/^## (\d{4}-\d{2}-\d{2})/)
      if (dateMatch) {
        currentDate = dateMatch[1]
        continue
      }

      // 匹配事件 - 09:00 Event Title
      const eventMatch = line.match(/^- (\d{2}:\d{2})?\s*(.+)/)
      if (eventMatch && currentDate) {
        events.push({
          id: `event-${events.length}`,
          title: eventMatch[2],
          date: currentDate,
          time: eventMatch[1],
          type: 'event',
        })
      }
    }

    return events
  }

  private generateCalendarMarkdown(events: CalendarEventData[], year: number, month: number): string {
    const lines = [`# Calendar ${year}-${String(month).padStart(2, '0')}`, '']

    // 按日期分组
    const byDate = new Map<string, CalendarEventData[]>()
    for (const event of events) {
      const list = byDate.get(event.date) || []
      list.push(event)
      byDate.set(event.date, list)
    }

    // 按日期排序输出
    const sortedDates = Array.from(byDate.keys()).sort()
    for (const date of sortedDates) {
      lines.push(`## ${date}`, '')
      for (const event of byDate.get(date)!) {
        const time = event.time ? `${event.time} ` : ''
        lines.push(`- ${time}${event.title}`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  private parsePomodoroMarkdown(content: string): PomodoroRecordData[] {
    const records: PomodoroRecordData[] = []
    const lines = content.split('\n')

    for (const line of lines) {
      // 匹配 | 09:00-09:25 | Task Name | 25 | ✅ |
      const match = line.match(/\|\s*(\d{2}:\d{2})-(\d{2}:\d{2})\s*\|\s*(.+?)\s*\|\s*(\d+)\s*\|\s*(✅|❌)\s*\|/)
      if (match) {
        records.push({
          id: `pomo-${records.length}`,
          taskName: match[3],
          startTime: 0, // 需要结合日期计算
          endTime: 0,
          duration: parseInt(match[4]),
          completed: match[5] === '✅',
        })
      }
    }

    return records
  }

  private generatePomodoroMarkdown(records: PomodoroRecordData[], date: string): string {
    const lines = [
      `# Pomodoro Records - ${date}`,
      '',
      '| Time | Task | Duration | Status |',
      '|------|------|----------|--------|',
    ]

    for (const record of records) {
      const start = new Date(record.startTime).toTimeString().slice(0, 5)
      const end = new Date(record.endTime).toTimeString().slice(0, 5)
      const status = record.completed ? '✅' : '❌'
      lines.push(`| ${start}-${end} | ${record.taskName} | ${record.duration} | ${status} |`)
    }

    return lines.join('\n')
  }
}

export const obsidianDAO = new ObsidianDAO()
