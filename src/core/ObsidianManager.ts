/**
 * ObsidianManager - 完整的 Obsidian 集成
 *
 * 功能：
 * - 双向同步 TODO/Calendar/Pomodoro 数据
 * - Markdown 解析和生成
 * - Secrets 管理
 * - 模板路径解析
 * - 错误恢复
 */

import { logger } from './Logger'
import { TodoItem, CalendarEvent, PomodoroSession, SSHProfile } from '../shared/types'

export interface ServiceKeyEntry {
  id: string
  key: string
  url?: string
  note?: string
  name?: string
  provider?: string
  model?: string
  timeout?: number
  enabled?: boolean
}

export interface GenericAIConfig extends ServiceKeyEntry {
  name: string
  provider: string
  model?: string
  timeout?: number
  enabled?: boolean
}

/**
 * Obsidian 配置
 */
interface ObsidianConfig {
  enabled: boolean
  vaultPath: string
  secretsFile: string
}

/**
 * 模板变量
 */
interface TemplateVars {
  year: number
  month: number
  week: number
  day: number
  date: string
}

/**
 * ObsidianManager 类
 */
class ObsidianManager {
  private config: ObsidianConfig = {
    enabled: false,
    vaultPath: '',
    secretsFile: '',
  }
  private readonly DEFAULT_TODO_NOTE_FOLDER = 'TodoNotes'

  private obsidianLogger = logger.createScope('Obsidian')
  private readonly SERVICE_TITLES: Record<string, string> = {
    openai: 'OpenAI',
    cli_anthropic: 'CLI Anthropic',
    gemini: 'Gemini',
  }

  /**
   * 初始化 Obsidian 管理器
   */
  async initialize(vaultPath: string, secretsFile: string): Promise<void> {
    this.config = {
      enabled: true,
      vaultPath,
      secretsFile,
    }

    this.obsidianLogger.info('Obsidian manager initialized', {
      vaultPath,
      secretsFile,
    })

    // 不再预先验证 vault 路径，在实际使用时处理错误
  }

  /**
   * 是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * 获取 vault 路径
   */
  getVaultPath(): string {
    return this.config.vaultPath
  }

  /**
   * 获取 secrets 文件完整路径
   */
  getSecretsFilePath(): string {
    if (!this.config.vaultPath || !this.config.secretsFile) {
      return ''
    }
    return `${this.config.vaultPath}/${this.config.secretsFile}`
  }

  /**
   * 解析模板路径
   *
   * 支持变量：
   * - {year} - 年份 (2025)
   * - {month} - 月份 (01-12)
   * - {week} - 周数 (01-53)
   * - {day} - 日期 (01-31)
   * - {date} - 完整日期 (2025-01-08)
   */
  private resolveTemplatePath(template: string): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const week = this.getWeekNumber(now)
    const date = `${year}-${month}-${day}`

    const vars: TemplateVars = { year, month: Number(month), week, day: Number(day), date }

    let path = template
    path = path.replace(/\{year\}/g, String(vars.year))
    path = path.replace(/\{month\}/g, String(vars.month).padStart(2, '0'))
    path = path.replace(/\{week\}/g, String(vars.week).padStart(2, '0'))
    path = path.replace(/\{day\}/g, String(vars.day).padStart(2, '0'))
    path = path.replace(/\{date\}/g, vars.date)

    return `${this.config.vaultPath}/${path}`
  }

  /**
   * 解析指定日期的模板路径
   */
  private resolveTemplatePathForDate(template: string, targetDate: Date): string {
    const year = targetDate.getFullYear()
    const month = String(targetDate.getMonth() + 1).padStart(2, '0')
    const day = String(targetDate.getDate()).padStart(2, '0')
    const week = this.getWeekNumber(targetDate)
    const date = `${year}-${month}-${day}`

    const vars: TemplateVars = { year, month: Number(month), week, day: Number(day), date }

    let path = template
    path = path.replace(/\{year\}/g, String(vars.year))
    path = path.replace(/\{month\}/g, String(vars.month).padStart(2, '0'))
    path = path.replace(/\{week\}/g, String(vars.week).padStart(2, '0'))
    path = path.replace(/\{day\}/g, String(vars.day).padStart(2, '0'))
    path = path.replace(/\{date\}/g, vars.date)

    return `${this.config.vaultPath}/${path}`
  }

  /**
   * 获取 ISO 周数
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  }

  // ==================== Secrets 管理 ====================

  /**
   * 读取 secrets 文件
   *
   * 格式：
   * ```
   * openai_api_key: sk-xxx
   * deepseek_api_key: sk-xxx
   *
   * projects:
   *   computer-name:
   *     - name: ProjectA
   *       path: /path/to/project
   * ```
   */
  async readSecrets(): Promise<Record<string, string>> {
    if (!this.config.enabled) {
      this.obsidianLogger.warn('Obsidian not enabled, cannot read secrets')
      return {}
    }

    try {
      const secretsPath = `${this.config.vaultPath}/${this.config.secretsFile}`
      this.obsidianLogger.debug('Reading secrets', { path: secretsPath })

      const content = await window.electronAPI.readFile(secretsPath)
      const secrets = this.parseSecretsContent(content)

      this.obsidianLogger.info('Secrets loaded', { count: Object.keys(secrets).length })
      return secrets
    } catch (error) {
      this.obsidianLogger.error('Failed to read secrets', error as Error)
      return {}
    }
  }

  /**
   * 解析类 YAML 格式
   */
  private parseYAMLLike(content: string): any {
    // 简单实现：仅解析 key: value 格式
    const result: any = {}
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const match = trimmed.match(/^(.+?):\s*(.+)$/)
      if (match) {
        result[match[1].trim()] = match[2].trim()
      }
    }

    return result
  }

  /**
   * 格式化为类 YAML 格式
   */
  private formatYAMLLike(data: any): string {
    const lines: string[] = []
    for (const [key, value] of Object.entries(data)) {
      lines.push(`${key}: ${value}`)
    }
    return lines.join('\n')
  }

  /**
   * 读取所有 secrets (包括 projects 等复杂数据)
   */
  async getAllSecrets(): Promise<any> {
    if (!this.config.enabled) {
      return {}
    }

    try {
      const secretsPath = `${this.config.vaultPath}/${this.config.secretsFile}`
      const content = await window.electronAPI.readFile(secretsPath)

      // 使用简单的 YAML 解析（假设格式良好）
      const result = this.parseYAMLLike(content)
      return result
    } catch (error) {
      this.obsidianLogger.error('Failed to read all secrets', error as Error)
      return {}
    }
  }

  /**
   * 写入所有 secrets
   */
  async writeAllSecrets(secrets: any): Promise<boolean> {
    if (!this.config.enabled) {
      return false
    }

    try {
      const secretsPath = `${this.config.vaultPath}/${this.config.secretsFile}`
      const content = this.formatYAMLLike(secrets)

      await window.electronAPI.writeFile(secretsPath, content)
      this.obsidianLogger.info('All secrets written')
      return true
    } catch (error) {
      this.obsidianLogger.error('Failed to write all secrets', error as Error)
      return false
    }
  }

  /**
   * 解析 secrets 内容
   */
  private parseSecretsContent(content: string): Record<string, string> {
    const secrets: Record<string, string> = {}
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const match = trimmed.match(/^(.+?):\s*(.+)$/)
      if (match) {
        const key = match[1].trim()
        const value = match[2].trim()
        secrets[key] = value
      }
    }

    return secrets
  }

  /**
   * 写入 secrets 文件
   */
  async writeSecrets(secrets: Record<string, string>): Promise<void> {
    if (!this.config.enabled) {
      this.obsidianLogger.warn('Obsidian not enabled, cannot write secrets')
      return
    }

    try {
      const secretsPath = `${this.config.vaultPath}/${this.config.secretsFile}`
      const content = this.formatSecretsContent(secrets)

      await window.electronAPI.writeFile(secretsPath, content)
      this.obsidianLogger.info('Secrets written', { count: Object.keys(secrets).length })
    } catch (error) {
      this.obsidianLogger.error('Failed to write secrets', error as Error)
      throw error
    }
  }

  /**
   * 格式化 secrets 内容
   */
  private formatSecretsContent(
    secrets: Record<string, string>,
    options?: { includeHeading?: boolean }
  ): string {
    const lines: string[] = []
    const includeHeading = options?.includeHeading !== false

    if (includeHeading) {
      lines.push('# API Keys and Secrets', '')
    }

    for (const [key, value] of Object.entries(secrets)) {
      lines.push(`${key}: ${value}`)
    }

    return lines.join('\n')
  }

  /**
   * 读取 secrets 原文件
   */
  private async readSecretsFile(): Promise<string | null> {
    if (!this.config.enabled) {
      return null
    }
    const filePath = this.getSecretsFilePath()
    if (!filePath) {
      return null
    }
    try {
      return await window.electronAPI.readFile(filePath)
    } catch (error) {
      this.obsidianLogger.error('Failed to read secrets file', error as Error)
      return null
    }
  }

  /**
   * 写入 secrets 原文件
   */
  private async writeSecretsFile(content: string): Promise<boolean> {
    if (!this.config.enabled) {
      return false
    }
    const filePath = this.getSecretsFilePath()
    if (!filePath) {
      return false
    }
    try {
      const dir = this.config.vaultPath
      if (dir) {
        await window.electronAPI.ensureDir(dir)
      }
      await window.electronAPI.writeFile(filePath, content)
      return true
    } catch (error) {
      this.obsidianLogger.error('Failed to write secrets file', error as Error)
      return false
    }
  }

  /**
   * 更新单个 secret（不覆盖其他内容）
   */
  async updateSecret(key: string, value: string): Promise<boolean> {
    if (!this.config.enabled) {
      this.obsidianLogger.warn('Obsidian not enabled, cannot update secret')
      return false
    }

    try {
      const currentFile = (await this.readSecretsFile()) ?? ''
      const sectionContent = this.extractMarkdownSection(currentFile, 'API Keys and Secrets', 1)
      const secrets = sectionContent ? this.parseSecretsContent(sectionContent) : {}
      const trimmedKey = key.trim()
      const normalizedValue = value.trim()

      if (!trimmedKey) {
        this.obsidianLogger.warn('Empty secret key, skip update')
        return false
      }

      if (!normalizedValue) {
        delete secrets[trimmedKey]
      } else {
        secrets[trimmedKey] = normalizedValue
      }

      const newSection = this.formatSecretsContent(secrets, { includeHeading: false })
      const merged = this.mergeMarkdownSection(currentFile, 'API Keys and Secrets', newSection, 1)
      const success = await this.writeSecretsFile(merged)

      if (success) {
        this.obsidianLogger.info('Secret updated', { key: trimmedKey, removed: !normalizedValue })
      }

      return success
    } catch (error) {
      this.obsidianLogger.error('Failed to update secret', error as Error)
      return false
    }
  }

  /**
   * 提取指定 Markdown 区域
   */
  private extractMarkdownSection(content: string, sectionTag: string, level = 1): string | null {
    const lines = content.split('\n')
    const heading = `${'#'.repeat(level)} ${sectionTag}`.trim()
    let inSection = false
    const collected: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!inSection) {
        if (trimmed === heading) {
          inSection = true
        }
        continue
      }

      if (trimmed.startsWith('#')) {
        const currentLevel = trimmed.match(/^#+/)?.[0].length ?? 0
        if (currentLevel <= level) {
          break
        }
      }

      collected.push(line)
    }

    return inSection ? collected.join('\n').trim() : null
  }

  /**
   * 合并/替换 Markdown 区域
   */
  private mergeMarkdownSection(
    content: string,
    sectionTag: string,
    sectionContent: string,
    level = 1
  ): string {
    const lines = content.split('\n')
    const heading = `${'#'.repeat(level)} ${sectionTag}`.trim()
    const result: string[] = []
    let i = 0
    let replaced = false

    while (i < lines.length) {
      const line = lines[i]
      const trimmed = line.trim()
      if (trimmed === heading) {
        replaced = true
        result.push(heading)
        result.push('')
        if (sectionContent.trim().length > 0) {
          result.push(sectionContent.trim())
          result.push('')
        }

        // Skip until next heading with same or higher level
        i += 1
        while (i < lines.length) {
          const current = lines[i].trim()
          if (current.startsWith('#')) {
            const currentLevel = current.match(/^#+/)?.[0].length ?? 0
            if (currentLevel <= level) {
              break
            }
          }
          i += 1
        }
        continue
      }

      result.push(line)
      i += 1
    }

    if (!replaced) {
      if (result.length && result[result.length - 1].trim() !== '') {
        result.push('')
      }
      result.push(heading)
      result.push('')
      if (sectionContent.trim().length > 0) {
        result.push(sectionContent.trim())
        result.push('')
      }
    }

    return (
      result
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trimEnd() + '\n'
    )
  }

  private getServiceHeading(serviceId: string): string {
    if (this.SERVICE_TITLES[serviceId]) {
      return this.SERVICE_TITLES[serviceId]
    }
    return serviceId
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  private normalizeServiceId(heading: string): string {
    const simplified = heading.replace(/[^\w]+/g, '').toLowerCase()
    if (simplified.includes('openai')) return 'openai'
    if (simplified.includes('anthropic')) return 'cli_anthropic'
    if (simplified.includes('gemini')) return 'gemini'
    return heading.toLowerCase().replace(/\s+/g, '_')
  }

  private buildServiceTable(serviceId: string, keys: ServiceKeyEntry[]): string {
    if (!keys.length) {
      if (serviceId === 'generic_ai') {
        return '| id | name | key | url | provider | model | timeout | enabled |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| · | · | · | · | · | · | · | · |'
      }
      return '| id | key | url |\n| --- | --- | --- |\n| · | · | · |'
    }

    if (serviceId === 'generic_ai') {
      const rows = keys.map((item) => ({
        id: item.id || '',
        name: item.name || item.id || '',
        key: item.key || '',
        url: item.url || '',
        provider: item.provider || 'Custom',
        model: item.model || '',
        timeout: item.timeout?.toString() || '',
        enabled: item.enabled === false ? 'false' : 'true',
      }))
      return this.generateMarkdownTable(
        ['id', 'name', 'key', 'url', 'provider', 'model', 'timeout', 'enabled'],
        rows
      )
    }

    const rows = keys.map((item) => ({
      id: item.id || '',
      key: item.key || '',
      url: item.url || '',
    }))

    return this.generateMarkdownTable(['id', 'key', 'url'], rows)
  }

  private buildApiKeysSection(data: Record<string, ServiceKeyEntry[]>): string {
    const parts: string[] = []
    for (const [serviceId, keys] of Object.entries(data)) {
      const heading = this.getServiceHeading(serviceId)
      const table = this.buildServiceTable(serviceId, keys)
      parts.push(`## ${heading}\n${table}\n`)
    }

    if (!parts.length) {
      parts.push('暂无 API Keys')
    }

    return parts.join('\n').trim()
  }

  /**
   * 解析 Markdown 表格
   */
  private parseMarkdownTable(content: string): Record<string, string>[] {
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('|'))

    if (lines.length < 2) return []

    // 解析表头
    const headerLine = lines[0]
    const headers = headerLine
      .split('|')
      .map((h) => h.trim())
      .filter((h) => h)

    // 跳过分隔符行（第二行）
    const dataLines = lines.slice(2)

    const rows: Record<string, string>[] = []

    for (const line of dataLines) {
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((_, i) => i > 0 && i <= headers.length)
      if (cells.length === 0) continue

      const row: Record<string, string> = {}
      headers.forEach((header, index) => {
        const cellValue = this.normalizeTableCellValue(cells[index] || '')
        // 将 "·" 或 "-" 视为空字符串
        row[header.toLowerCase()] = cellValue === '·' || cellValue === '-' ? '' : cellValue
      })
      rows.push(row)
    }

    return rows
  }

  /**
   * 生成 Markdown 表格
   */
  private generateMarkdownTable(headers: string[], rows: Record<string, any>[]): string {
    const lines: string[] = []

    // 表头
    const headerLine = '| ' + headers.join(' | ') + ' |'
    lines.push(headerLine)

    // 分隔符
    const separator = '|' + headers.map(() => '---').join('|') + '|'
    lines.push(separator)

    // 数据行
    for (const row of rows) {
      const cells = headers.map((header) => {
        const key = header.toLowerCase()
        return row[key] || ''
      })
      lines.push('| ' + cells.join(' | ') + ' |')
    }

    return lines.join('\n')
  }

  private normalizeTableCellValue(value: string): string {
    const trimmed = value.trim()
    if (!trimmed) return ''
    const quotePairs: [string, string][] = [
      ['`', '`'],
      ['"', '"'],
      ["'", "'"],
    ]
    for (const [start, end] of quotePairs) {
      if (trimmed.startsWith(start) && trimmed.endsWith(end) && trimmed.length >= 2) {
        return trimmed.slice(1, -1).trim()
      }
    }
    return trimmed
  }

  private async parseServiceKeyMap(): Promise<Record<string, ServiceKeyEntry[]>> {
    const result: Record<string, ServiceKeyEntry[]> = {}
    const raw = await this.readSecretsFile()
    if (!raw) {
      return result
    }

    const apiSection = this.extractMarkdownSection(raw, 'API Keys', 1)
    if (!apiSection) {
      return result
    }

    const lines = apiSection.split('\n')
    let currentHeading: string | null = null
    let buffer: string[] = []

    const flush = () => {
      if (!currentHeading) return
      const sectionContent = buffer.join('\n').trim()
      if (!sectionContent) return
      const rows = this.parseMarkdownTable(sectionContent)
      if (!rows.length) return
      const serviceId = this.normalizeServiceId(currentHeading)
      result[serviceId] = rows.map((row) => {
        const entry: ServiceKeyEntry = {
          id: row.id || row.ID || '',
          key: row.key || row.Key || '',
          url: row.url || row.URL || '',
          note: row.note || row['备注'] || row.Remark,
        }

        if (row.name || row.Name) {
          entry.name = row.name || row.Name
        }
        if (row.provider || row.Provider) {
          entry.provider = row.provider || row.Provider
        }
        if (row.model || row.Model) {
          entry.model = row.model || row.Model
        }
        if (row.timeout || row.Timeout) {
          const timeoutValue = Number(row.timeout || row.Timeout)
          if (!Number.isNaN(timeoutValue)) {
            entry.timeout = timeoutValue
          }
        }
        if (row.enabled || row.Enabled) {
          const flag = String(row.enabled || row.Enabled).toLowerCase()
          entry.enabled = !(flag === 'false' || flag === '0' || flag === 'no')
        }

        return entry
      })
    }

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('## ')) {
        flush()
        currentHeading = trimmed.replace(/^##\s*/, '')
        buffer = []
        continue
      }
      buffer.push(line)
    }
    flush()

    return result
  }

  async getServiceKeys(serviceId: string): Promise<ServiceKeyEntry[]> {
    try {
      const map = await this.parseServiceKeyMap()
      return map[serviceId] || []
    } catch (error) {
      this.obsidianLogger.error('Failed to get service keys', error as Error)
      return []
    }
  }

  async getAllServiceKeys(serviceIds?: string[]): Promise<Record<string, ServiceKeyEntry[]>> {
    try {
      const map = await this.parseServiceKeyMap()
      if (!serviceIds || serviceIds.length === 0) {
        return map
      }
      const filtered: Record<string, ServiceKeyEntry[]> = {}
      for (const id of serviceIds) {
        if (map[id]?.length) {
          filtered[id] = map[id]
        }
      }
      return filtered
    } catch (error) {
      this.obsidianLogger.error('Failed to get all service keys', error as Error)
      return {}
    }
  }

  async saveServiceKeys(serviceId: string, keys: ServiceKeyEntry[]): Promise<boolean> {
    return this.saveAllServiceKeys({ [serviceId]: keys })
  }

  async saveAllServiceKeys(data: Record<string, ServiceKeyEntry[]>): Promise<boolean> {
    if (!this.config.enabled) {
      return false
    }

    try {
      const existing = await this.parseServiceKeyMap()
      for (const [serviceId, keys] of Object.entries(data)) {
        existing[serviceId] = keys
      }

      const sectionContent = this.buildApiKeysSection(existing)
      const currentFile = (await this.readSecretsFile()) ?? ''
      const merged = this.mergeMarkdownSection(currentFile, 'API Keys', sectionContent, 1)
      return await this.writeSecretsFile(merged)
    } catch (error) {
      this.obsidianLogger.error('Failed to save service keys', error as Error)
      return false
    }
  }

  async getPrimaryServiceKey(serviceId: string): Promise<ServiceKeyEntry | undefined> {
    const keys = await this.getServiceKeys(serviceId)
    if (!keys.length) {
      return undefined
    }
    const preferred = keys.find((item) => /^(main|primary|default)$/i.test(item.id))
    return preferred || keys[0]
  }

  async getGenericAIConfigs(): Promise<GenericAIConfig[]> {
    const entries = await this.getServiceKeys('generic_ai')
    return entries.map((entry) => ({
      id: entry.id,
      name: entry.name || entry.id || '未命名配置',
      key: entry.key,
      url: entry.url || '',
      provider: entry.provider || 'Custom',
      model: entry.model,
      timeout: entry.timeout ?? 30,
      enabled: entry.enabled ?? true,
    }))
  }

  async saveGenericAIConfigs(configs: GenericAIConfig[]): Promise<boolean> {
    const payload: ServiceKeyEntry[] = configs.map((config) => ({
      id: config.id,
      name: config.name,
      key: config.key,
      url: config.url,
      provider: config.provider,
      model: config.model,
      timeout: config.timeout,
      enabled: config.enabled,
    }))
    return this.saveAllServiceKeys({ generic_ai: payload })
  }

  // ==================== SSH Profiles 管理 ====================

  private readonly SSH_PROFILE_HEADERS = [
    'id',
    'name',
    'host',
    'user',
    'port',
    'identity_file',
    'identity_pem',
    'extra_args',
    'description',
    'local_workdir',
  ]

  async readSSHProfiles(): Promise<SSHProfile[]> {
    if (!this.config.enabled) {
      this.obsidianLogger.warn('Obsidian not enabled, cannot read SSH profiles')
      return []
    }

    try {
      const raw = await this.readSecretsFile()
      if (!raw) {
        return []
      }
      const section = this.extractMarkdownSection(raw, 'SSH Profiles', 1)
      if (!section) {
        this.obsidianLogger.info('No SSH Profiles section found')
        return []
      }

      const rows = this.parseMarkdownTable(section)
      const profiles = rows
        .map((row) => this.normalizeSSHProfileRow(row))
        .filter((profile): profile is SSHProfile => Boolean(profile))

      this.obsidianLogger.info('SSH profiles loaded', { count: profiles.length })
      return profiles
    } catch (error) {
      this.obsidianLogger.error('Failed to read SSH profiles', error as Error)
      return []
    }
  }

  private normalizeSSHProfileRow(row: Record<string, string>): SSHProfile | null {
    const host = row.host || row.hostname || ''
    if (!host) {
      return null
    }

    const portValue = row.port ? Number(row.port) : undefined
    const port = portValue && !Number.isNaN(portValue) ? portValue : undefined
    const stripMdCode = (val?: string): string | undefined => {
      if (!val) return undefined
      let t = String(val).trim()
      if (t.startsWith('```')) {
        t = t
          .replace(/^```[a-zA-Z-]*\s*/, '')
          .replace(/\s*```\s*$/, '')
          .trim()
      }
      if (t.startsWith('`') && t.endsWith('`') && t.length >= 2) {
        t = t.slice(1, -1)
      }
      return t
    }

    return {
      id: row.id || this.generateId(),
      name: row.name || host,
      host,
      user: row.user || undefined,
      port,
      identity_file: row.identity_file || row.identity || row['identity file'] || undefined,
      identity_pem: stripMdCode(row.identity_pem || row['identity pem']) || undefined,
      extra_args: row.extra_args || row['extra args'] || undefined,
      description: row.description || row.desc || undefined,
      local_workdir: row.local_workdir || row.cwd || undefined,
    }
  }

  async saveSSHProfiles(profiles: SSHProfile[]): Promise<boolean> {
    if (!this.config.enabled) {
      return false
    }

    try {
      const rows = profiles.map((profile) => ({
        id: profile.id,
        name: profile.name || profile.host,
        host: profile.host,
        user: profile.user || '',
        port: profile.port?.toString() || '',
        identity_file: profile.identity_file || '',
        identity_pem: profile.identity_pem ? `\`${profile.identity_pem}\`` : '',
        extra_args: profile.extra_args || '',
        description: profile.description || '',
        local_workdir: profile.local_workdir || '',
      }))

      const table = this.generateMarkdownTable(this.SSH_PROFILE_HEADERS, rows)
      const currentFile = (await this.readSecretsFile()) ?? ''
      const merged = this.mergeMarkdownSection(currentFile, 'SSH Profiles', table, 1)
      const success = await this.writeSecretsFile(merged)
      if (success) {
        this.obsidianLogger.info('SSH profiles saved', { count: profiles.length })
      }
      return success
    } catch (error) {
      this.obsidianLogger.error('Failed to save SSH profiles', error as Error)
      return false
    }
  }

  // ==================== Projects 管理 ====================

  // 项目字段映射：中文列名 -> 英文字段名
  private readonly PROJECT_FIELD_MAPPING: Record<string, string> = {
    项目名称: 'name',
    路径: 'path',
    P4服务器: 'p4_server',
    P4用户: 'p4_user',
    P4字符集: 'p4_charset',
    P4工作区: 'p4_workspace',
    引擎版本: 'engine_version',
    构建配置: 'build_config',
    平台: 'platform',
  }

  /**
   * 获取指定计算机的项目列表
   */
  async getProjectsForComputer(computerName: string): Promise<import('../shared/types').Project[]> {
    if (!this.config.enabled) {
      return []
    }

    try {
      const secretsPath = `${this.config.vaultPath}/${this.config.secretsFile}`
      const content = await window.electronAPI.readFile(secretsPath)

      // 提取 Projects 章节
      const projectsSection = this.extractSection(content, '# Projects')
      if (!projectsSection) {
        this.obsidianLogger.info('No Projects section found')
        return []
      }

      // 提取该计算机的章节
      const computerSection = this.extractSection(projectsSection, `## ${computerName}`)
      if (!computerSection) {
        this.obsidianLogger.info(`No projects for computer: ${computerName}`)
        return []
      }

      // 解析表格
      const rows = this.parseMarkdownTable(computerSection)
      const projects: import('../shared/types').Project[] = []

      for (const row of rows) {
        const project: any = {}
        // 根据字段映射转换
        for (const [chineseName, englishName] of Object.entries(this.PROJECT_FIELD_MAPPING)) {
          const value = row[chineseName.toLowerCase()]
          // 总是添加字段，包括空值（这样可以正确处理空项目）
          project[englishName] = value || ''
        }
        // 只要有任何一个字段有值，就添加项目（不仅仅检查 name）
        const hasAnyValue = Object.values(project).some((v) => v !== '')
        if (hasAnyValue) {
          projects.push(project as import('../shared/types').Project)
        }
      }

      this.obsidianLogger.info('Projects loaded for computer', {
        computer: computerName,
        count: projects.length,
      })

      return projects
    } catch (error) {
      this.obsidianLogger.error('Failed to get projects', error as Error)
      return []
    }
  }

  /**
   * 保存指定计算机的项目列表
   */
  async saveProjectsForComputer(
    computerName: string,
    projects: import('../shared/types').Project[]
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false
    }

    try {
      const secretsPath = `${this.config.vaultPath}/${this.config.secretsFile}`
      let content = ''

      try {
        content = await window.electronAPI.readFile(secretsPath)
      } catch {
        // 文件不存在，创建新内容
        content = '# API Keys and Secrets\n\n'
      }

      // 生成项目表格
      const headers = Object.keys(this.PROJECT_FIELD_MAPPING)
      const rows = projects.map((project) => {
        const row: Record<string, any> = {}
        for (const [chineseName, englishName] of Object.entries(this.PROJECT_FIELD_MAPPING)) {
          row[chineseName.toLowerCase()] = (project as any)[englishName] || ''
        }
        return row
      })

      const table = this.generateMarkdownTable(headers, rows)

      // 构建该计算机的完整章节内容
      const computerSection = `## ${computerName}\n\n${table}\n`

      // 更新 Projects 章节
      content = this.updateProjectsSection(content, computerName, computerSection)

      // 写入文件
      await window.electronAPI.writeFile(secretsPath, content)

      this.obsidianLogger.info('Projects saved for computer', {
        computer: computerName,
        count: projects.length,
      })

      return true
    } catch (error) {
      this.obsidianLogger.error('Failed to save projects', error as Error)
      return false
    }
  }

  /**
   * 提取 Markdown 章节
   */
  private extractSection(content: string, sectionHeader: string): string {
    const lines = content.split('\n')
    const result: string[] = []
    let inSection = false
    const level = (sectionHeader.match(/^#+/) || ['#'])[0].length

    for (const line of lines) {
      if (line.trim() === sectionHeader) {
        inSection = true
        continue
      }

      if (inSection) {
        // 检查是否遇到同级或更高级标题
        const match = line.trim().match(/^(#+)\s/)
        if (match && match[1].length <= level) {
          break
        }
        result.push(line)
      }
    }

    return result.join('\n')
  }

  /**
   * 更新 Projects 章节中的某个计算机子章节
   */
  private updateProjectsSection(
    content: string,
    computerName: string,
    computerSection: string
  ): string {
    const lines = content.split('\n')
    const result: string[] = []
    let inProjectsSection = false
    let projectsSectionFound = false
    let computerSectionAdded = false // 新增：跟踪是否已添加目标计算机

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      // 检测 Projects 章节
      if (trimmed === '# Projects') {
        inProjectsSection = true
        projectsSectionFound = true
        result.push(line)
        continue
      }

      // 在 Projects 章节内
      if (inProjectsSection) {
        // 检测是否是目标计算机
        if (trimmed === `## ${computerName}`) {
          // 添加新的计算机章节
          result.push(computerSection)
          computerSectionAdded = true
          // 跳过旧的计算机章节内容
          i++
          while (i < lines.length) {
            const nextLine = lines[i].trim()
            if (nextLine.startsWith('## ') || nextLine.startsWith('# ')) {
              i-- // 回退一行，让外层循环处理
              break
            }
            i++
          }
          continue
        }

        // 遇到下一个一级标题，退出 Projects 章节
        if (trimmed.startsWith('# ') && trimmed !== '# Projects') {
          // 如果还没有添加目标计算机，在这里添加
          if (!computerSectionAdded) {
            result.push('')
            result.push(computerSection)
          }
          inProjectsSection = false
        }
      }

      result.push(line)
    }

    // 如果没有找到 Projects 章节，在末尾添加
    if (!projectsSectionFound) {
      result.push('')
      result.push('---')
      result.push('')
      result.push('# Projects')
      result.push('')
      result.push(computerSection)
    } else if (inProjectsSection && !computerSectionAdded) {
      // 在 Projects 章节末尾但没有找到目标计算机，添加新计算机
      result.push('')
      result.push(computerSection)
    }

    return result.join('\n')
  }

  // ==================== TODO 管理 ====================

  /**
   * 从 Obsidian 读取 TODO 项
   *
   * Markdown 格式：
   * ```markdown
   * ## TODO
   * - [ ] Task 1 #work @2025-01-10
   * - [x] Task 2 #personal
   * - [ ] Task 3
   * ```
   */
  async readTodoItems(template: string): Promise<TodoItem[]> {
    if (!this.config.enabled) {
      this.obsidianLogger.warn('Obsidian not enabled, cannot read TODO items')
      return []
    }

    try {
      const filePath = this.resolveTemplatePath(template)
      this.obsidianLogger.debug('Reading TODO items', { path: filePath })

      const content = await this.readFileContent(filePath)
      const todos = this.parseTodoItems(content)

      this.obsidianLogger.info('TODO items loaded', { count: todos.length })
      return todos
    } catch (error) {
      this.obsidianLogger.error('Failed to read TODO items', error as Error)
      return []
    }
  }

  /**
   * 读取指定日期的 TODO 项
   */
  async readTodoItemsForDate(template: string, targetDate: Date): Promise<TodoItem[]> {
    if (!this.config.enabled) {
      this.obsidianLogger.warn('Obsidian not enabled, cannot read TODO items')
      return []
    }

    try {
      const filePath = this.resolveTemplatePathForDate(template, targetDate)
      this.obsidianLogger.debug('Reading TODO items for date', {
        path: filePath,
        date: targetDate.toISOString(),
      })

      const content = await this.readFileContent(filePath)
      const todos = this.parseTodoItems(content)

      this.obsidianLogger.info('TODO items loaded for date', {
        count: todos.length,
        date: targetDate.toISOString(),
      })
      return todos
    } catch (error) {
      this.obsidianLogger.error('Failed to read TODO items for date', error as Error)
      return []
    }
  }

  /**
   * 暴露模板解析后的完整路径，便于提示用户
   */
  getTemplatePath(template: string, targetDate?: Date): string {
    return targetDate
      ? this.resolveTemplatePathForDate(template, targetDate)
      : this.resolveTemplatePath(template)
  }

  /**
   * 确保当前日期对应的 TODO 文件存在
   */
  async ensureTodoFile(template: string, targetDate?: Date): Promise<string> {
    const filePath = this.getTemplatePath(template, targetDate)
    await this.ensureDirForFile(filePath)

    try {
      await window.electronAPI.readFile(filePath)
      return filePath
    } catch (error) {
      this.obsidianLogger.warn('TODO file missing, creating a new one', { path: filePath, error })
    }

    try {
      await window.electronAPI.writeFile(filePath, '')
      this.obsidianLogger.info('Created TODO file on demand', { path: filePath })
      return filePath
    } catch (error) {
      this.obsidianLogger.error('Failed to create TODO file', { path: filePath, error })
      throw error
    }
  }

  /**
   * 解析 TODO 项
   * 格式: - [ ] 🔴 🏷️分类 任务内容 ⏰2025-10-26 23:09
   */
  private parseTodoItems(content: string): TodoItem[] {
    const todos: TodoItem[] = []
    const lines = content.split('\n')
    let inTodoSection = false
    let currentCategory = 'default'
    let currentPriority: 'low' | 'medium' | 'high' = 'medium'
    // 用于构建父子层级的栈（按缩进级别）
    const parentStack: Array<{ id: string; level: number } | null> = []

    for (const rawLine of lines) {
      const trimmed = rawLine.trim()

      // 检测 TODO List 区域开始 (一级标题)
      if (trimmed.startsWith('# TODO List')) {
        inTodoSection = true
        continue
      }

      // 遇到下一个一级标题，退出 TODO 区域
      if (inTodoSection && trimmed.startsWith('# ') && !trimmed.startsWith('# TODO List')) {
        break
      }

      if (!inTodoSection) continue

      // 提取分类 (### 📁 分类名)
      const categoryMatch = trimmed.match(/^###\s+📁\s+(.+)/)
      if (categoryMatch) {
        currentCategory = categoryMatch[1].trim()
        continue
      }

      // 提取优先级 (#### 🔴 高优先级 / #### 📋 普通优先级 / #### 🔵 低优先级)
      const priorityMatch = trimmed.match(/^####\s+(🔴|📋|🔵)\s+(.+)/)
      if (priorityMatch) {
        const icon = priorityMatch[1]
        if (icon === '🔴') currentPriority = 'high'
        else if (icon === '🔵') currentPriority = 'low'
        else currentPriority = 'medium'
        continue
      }

      // 匹配 TODO 项
      // 格式: - [ ] 🔴 🏷️健康 任务内容 ⏰2025-10-26 23:09 📝笔记 ✅结论 📎![name](path)
      // 允许前导 TAB 或空格来标识层级
      const todoMatch = rawLine.match(/^(\s*)-\s+\[([ xX])\]\s+(.+)$/)
      if (todoMatch) {
        const indent = todoMatch[1] || ''
        // 优先计算 TAB 数量作为层级，如果没有 TAB 则按空格计算（兼容老数据：每2个空格为一层）
        const tabCount = (indent.match(/\t/g) || []).length
        const spaceCount = (indent.match(/ /g) || []).length
        const level = tabCount > 0 ? tabCount : Math.floor(spaceCount / 2)
        const done = todoMatch[2].toLowerCase() === 'x'
        let remaining = (todoMatch[3] || '').trim()

        // 移除优先级 emoji（如果有）
        remaining = remaining.replace(/^(🔴|🔵)\s+/, '')

        // 提取分类标签 🏷️
        let itemCategory = currentCategory
        const categoryTagMatch = remaining.match(/^🏷️(\S+)\s+(.+)$/)
        if (categoryTagMatch) {
          itemCategory = categoryTagMatch[1]
          remaining = categoryTagMatch[2]
        }

        // 提取附件 📎![name](path)
        const attachments: import('../shared/types').Attachment[] = []
        const attachmentMatches = remaining.matchAll(/📎!\[([^\]]*)\]\(([^)]+)\)/g)
        for (const match of attachmentMatches) {
          const attName = match[1]
          const attPath = match[2]
          const isImage = /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(attPath)
          attachments.push({
            name: attName,
            path: attPath,
            type: isImage ? 'image' : 'file',
          })
        }
        // 移除附件标记
        remaining = remaining.replace(/\s*📎!\[[^\]]*\]\(([^)]+)\)/g, '')

        // 提取结论 ✅
        let conclusion = ''
        const conclusionMatch = remaining.match(/\s*✅(.+?)(?=\s*📝|\s*⏰|$)/)
        if (conclusionMatch) {
          conclusion = conclusionMatch[1].trim()
          remaining = remaining.replace(conclusionMatch[0], '')
        }

        // 提取笔记 📝
        let note = ''
        const noteMatch = remaining.match(/\s*📝(.+?)(?=\s*✅|\s*⏰|$)/)
        if (noteMatch) {
          note = noteMatch[1].trim()
          remaining = remaining.replace(noteMatch[0], '')
        }

        // 提取创建时间 ⏰
        let createdAt = Date.now()
        const timeMatch = remaining.match(/\s*⏰(.+?)(?=\s*📝|\s*✅|$)/)
        if (timeMatch) {
          const timeStr = timeMatch[1].trim()
          remaining = remaining.replace(timeMatch[0], '')
          // 尝试解析时间
          try {
            createdAt = new Date(timeStr).getTime()
          } catch {
            // 解析失败，使用当前时间
          }
        }

        const text = remaining.trim()

        const id = this.generateId()

        // 计算父任务
        let parentId: string | undefined
        if (level > 0) {
          // 找到最近的上层节点
          const parentLevel = level - 1
          const parentAtLevel = parentStack[parentLevel]
          parentId = parentAtLevel?.id
        } else {
          parentId = undefined
        }

        // 当前层级入栈，并清理更深层级栈
        parentStack[level] = { id, level }
        for (let i = level + 1; i < parentStack.length; i++) parentStack[i] = null

        todos.push({
          id,
          text,
          done,
          category: itemCategory,
          priority: currentPriority,
          dueDate: null,
          createdAt,
          updatedAt: Date.now(),
          note: note || undefined,
          conclusion: conclusion || undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
          parentId,
        })
      }
    }

    return todos
  }

  /**
   * 同步 TODO 项到 Obsidian
   */
  async syncTodoItems(items: TodoItem[], template: string): Promise<void> {
    if (!this.config.enabled) {
      this.obsidianLogger.warn('Obsidian not enabled, cannot sync TODO items')
      return
    }

    try {
      const filePath = this.resolveTemplatePath(template)
      this.obsidianLogger.debug('Syncing TODO items', { path: filePath, count: items.length })

      const content = this.formatTodoItems(items)
      await this.updateFileSection(filePath, '# TODO List', content)

      this.obsidianLogger.info('TODO items synced', { count: items.length })
    } catch (error) {
      this.obsidianLogger.error('Failed to sync TODO items', error as Error)
      throw error
    }
  }

  /**
   * Ϊ TODO ������� Obsidian ��¼
   */
  async createTodoNote(options: {
    title: string
    folder?: string
    todoId: string
    category?: string
    priority?: string
    done?: boolean
    sourceFile?: string
    note?: string
    conclusion?: string
  }): Promise<{ relativePath: string; absolutePath: string; wikiTarget: string }> {
    if (!this.config.enabled) {
      throw new Error('Obsidian not enabled, cannot create TODO note')
    }
    const vaultPath = this.getVaultPath()
    if (!vaultPath) {
      throw new Error('Obsidian vault path not configured')
    }

    const sanitizedTitle = this.prepareFileSlug(options.title)
    const timestamp = this.formatTimestampForFile(new Date())
    const folder = this.normalizeFolderPath(options.folder || this.DEFAULT_TODO_NOTE_FOLDER)
    let relativePath = this.combineRelativePath(folder, `${timestamp}-${sanitizedTitle}.md`)
    let counter = 1
    while (await this.fileExists(`${vaultPath}/${relativePath}`)) {
      relativePath = this.combineRelativePath(
        folder,
        `${timestamp}-${sanitizedTitle}-${counter}.md`
      )
      counter += 1
    }

    const absolutePath = `${vaultPath}/${relativePath}`
    const content = this.buildTodoNoteContent({
      title: options.title || 'TODO 记录',
      todoId: options.todoId,
      category: options.category,
      priority: options.priority,
      done: options.done,
      sourceFile: options.sourceFile,
      note: options.note,
      conclusion: options.conclusion,
    })

    await this.ensureDirForFile(absolutePath)
    await window.electronAPI.writeFile(absolutePath, content)

    const wikiTarget = relativePath.replace(/\.md$/i, '')
    this.obsidianLogger.info('Created TODO note', { relativePath })
    return { relativePath, absolutePath, wikiTarget }
  }

  /**
   * �� Obsidian ��򿪶�Ӧ�ļ�
   */
  async openNoteByLinkTarget(linkTarget: string): Promise<void> {
    if (!this.config.enabled) {
      throw new Error('Obsidian not enabled, cannot open note')
    }
    const vaultPath = this.getVaultPath()
    if (!vaultPath) {
      throw new Error('Obsidian vault path not configured')
    }

    const normalized = this.normalizeLinkTarget(linkTarget)
    const relativePath = normalized.file
    const absolutePath = `${vaultPath}/${relativePath}`
    const uri = this.buildObsidianUri(relativePath)

    try {
      if (typeof window.electronAPI.openExternal === 'function') {
        await window.electronAPI.openExternal(uri)
      } else {
        await window.electronAPI.invoke('shell:openExternal', uri)
      }
      this.obsidianLogger.info('Opened Obsidian note', { relativePath })
    } catch (error) {
      this.obsidianLogger.warn('Failed to open via obsidian:// URI, fallback to file path', {
        error: error instanceof Error ? error.message : String(error),
        relativePath,
      })
      await window.electronAPI.invoke('shell:openPath', absolutePath)
    }
  }

  /**
   * 格式化 TODO 项
   * 格式: - [ ] 🔴 🏷️分类 任务内容 ⏰时间 📝笔记 ✅结论 📎![name](path)
   */
  private formatTodoItems(items: TodoItem[]): string {
    const lines: string[] = []
    const now = new Date()
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

    lines.push('# TODO List')
    lines.push('')
    lines.push(`*最后更新: ${timestamp}*`)
    lines.push('')

    const itemMap = new Map<string, TodoItem>(items.map((item) => [item.id, item]))

    const shouldStartBranch = (item: TodoItem, doneFlag: boolean) => {
      if (!!item.done !== doneFlag) {
        return false
      }
      if (!item.parentId) {
        return true
      }
      const parent = itemMap.get(item.parentId)
      if (!parent) {
        return true
      }
      return !!parent.done !== doneFlag
    }

    const activeRoots = items.filter((item) => shouldStartBranch(item, false))
    const completedRoots = items.filter((item) => shouldStartBranch(item, true))

    // 按分类和优先级组织【未完成的根任务】
    const categories: Record<string, { high: TodoItem[]; medium: TodoItem[]; low: TodoItem[] }> = {}
    
    for (const item of activeRoots) {
      const category = item.category || '默认'
      if (!categories[category]) {
        categories[category] = { high: [], medium: [], low: [] }
      }
      const priority = item.priority || 'medium'
      categories[category][priority].push(item)
    }

    // 生成未完成任务部分（包含所有子任务，无论子任务是否完成）
    lines.push('## 📋 待完成任务')
    lines.push('')

    for (const [category, priorityItems] of Object.entries(categories).sort()) {
      const hasItems =
        priorityItems.high.length > 0 ||
        priorityItems.medium.length > 0 ||
        priorityItems.low.length > 0
      if (hasItems) {
        lines.push(`### 📁 ${category}`)

        // 高优先级
        if (priorityItems.high.length > 0) {
          lines.push('#### 🔴 高优先级')
          for (const item of priorityItems.high) {
            lines.push(...this.formatTodoTreeComplete(item, items, 0))
          }
          lines.push('')
        }

        // 普通优先级
        if (priorityItems.medium.length > 0) {
          lines.push('#### 📋 普通优先级')
          for (const item of priorityItems.medium) {
            lines.push(...this.formatTodoTreeComplete(item, items, 0))
          }
          lines.push('')
        }

        // 低优先级
        if (priorityItems.low.length > 0) {
          lines.push('#### 🔵 低优先级')
          for (const item of priorityItems.low) {
            lines.push(...this.formatTodoTreeComplete(item, items, 0))
          }
          lines.push('')
        }
      }
    }

    // 已完成任务部分（包含所有子任务，无论子任务是否完成）
    if (completedRoots.length > 0) {
      lines.push('## ✅ 已完成任务')
      lines.push('')

      // 按分类组织已完成的分支（包含父任务已完成或缺失的子任务）
      const completedCategories: Record<string, TodoItem[]> = {}
      for (const item of completedRoots) {
        const category = item.category || '默认'
        if (!completedCategories[category]) {
          completedCategories[category] = []
        }
        completedCategories[category].push(item)
      }

      for (const [category, categoryItems] of Object.entries(completedCategories).sort()) {
        lines.push(`### 📁 ${category}`)
        for (const item of categoryItems) {
          // 输出完整的任务树（包括所有子任务）
          lines.push(...this.formatTodoTreeComplete(item, items, 0))
        }
        lines.push('')
      }
    }

    return this.collapseBlankLines(lines.join('\n'))
  }

  /**
   * 格式化单个 TODO 项
   */
  private formatSingleTodoItem(item: TodoItem, indentLevel = 0): string {
    const checkbox = item.done ? '[x]' : '[ ]'

    // 优先级 emoji
    let priorityPrefix = ''
    if (item.priority === 'high') {
      priorityPrefix = '🔴 '
    } else if (item.priority === 'low') {
      priorityPrefix = '🔵 '
    }

    // 分类标签
    const categoryPrefix = item.category && item.category !== '默认' ? `🏷️${item.category} ` : ''

    // 创建时间
    const createdDate = new Date(item.createdAt)
    const createdSuffix = ` ⏰${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}-${String(createdDate.getDate()).padStart(2, '0')} ${String(createdDate.getHours()).padStart(2, '0')}:${String(createdDate.getMinutes()).padStart(2, '0')}`

    // 笔记和结论
    const noteSuffix = item.note ? ` 📝${item.note}` : ''
    const conclusionSuffix = item.conclusion ? ` ✅${item.conclusion}` : ''

    // 附件
    let attachmentSuffix = ''
    if (item.attachments && item.attachments.length > 0) {
      for (const att of item.attachments) {
        attachmentSuffix += ` 📎![${att.name}](${att.path})`
      }
    }

    const indent = '\t'.repeat(indentLevel)
    return `${indent}- ${checkbox} ${priorityPrefix}${categoryPrefix}${item.text}${createdSuffix}${noteSuffix}${conclusionSuffix}${attachmentSuffix}`
  }

  /**
   * 输出一个任务及其所有子任务（完整的树结构）
   * 注意：不管子任务是否完成，都输出
   */
  private formatTodoTreeComplete(root: TodoItem, allItems: TodoItem[], depth: number): string[] {
    const lines: string[] = []
    lines.push(this.formatSingleTodoItem(root, depth))
    // 输出所有子任务（不管是否完成）
    const children = allItems.filter((i) => i.parentId === root.id)
    for (const child of children) {
      lines.push(...this.formatTodoTreeComplete(child, allItems, depth + 1))
    }
    return lines
  }

  /**
   * 压缩连续空行，避免 Markdown 产生过多空白
   */
  private collapseBlankLines(text: string): string {
    const lines = text.split('\n')
    const result: string[] = []
    for (const line of lines) {
      const isBlank = line.trim() === ''
      const prevBlank = result.length > 0 && result[result.length - 1].trim() === ''
      if (isBlank && prevBlank) continue
      result.push(line)
    }
    while (result.length > 0 && result[result.length - 1].trim() === '') {
      result.pop()
    }
    return result.join('\n')
  }

  private prepareFileSlug(rawTitle: string): string {
    const withoutLinks = rawTitle?.replace(/\[\[[^\]]+\]\]/g, ' ') || ''
    const cleaned = withoutLinks.replace(/[\\/:*?"<>|]/g, ' ').trim()
    const slug = cleaned
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
    const normalized = slug || 'todo-note'
    return normalized.slice(0, 80)
  }

  private formatTimestampForFile(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    return `${y}${m}${d}-${h}${min}`
  }

  private normalizeFolderPath(folder?: string): string {
    if (!folder) return ''
    return folder.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
  }

  private combineRelativePath(folder: string, fileName: string): string {
    const normalizedName = fileName.replace(/\\/g, '/').replace(/^\/+/, '')
    if (!folder) {
      return this.normalizeRelativePath(normalizedName)
    }
    const candidate = `${folder}/${normalizedName}`.replace(/\/{2,}/g, '/')
    return this.normalizeRelativePath(candidate)
  }

  private async fileExists(absolutePath: string): Promise<boolean> {
    try {
      if (typeof (window.electronAPI as any).exists === 'function') {
        return await (window.electronAPI as any).exists(absolutePath)
      }
      await window.electronAPI.readFile(absolutePath)
      return true
    } catch {
      return false
    }
  }

  private buildTodoNoteContent(options: {
    title: string
    todoId: string
    category?: string
    priority?: string
    done?: boolean
    sourceFile?: string
    note?: string
    conclusion?: string
  }): string {
    const lines: string[] = []
    const title = options.title?.replace(/\[\[[^\]]+\]\]/g, '').trim() || 'TODO 记录'
    const status = options.done ? 'done' : 'active'
    const created = new Date().toISOString()

    lines.push('---')
    lines.push(`title: ${title}`)
    lines.push(`todo_id: ${options.todoId}`)
    lines.push(`status: ${status}`)
    lines.push(`created: ${created}`)
    if (options.category) {
      lines.push(`category: ${options.category}`)
    }
    if (options.priority) {
      lines.push(`priority: ${options.priority}`)
    }
    lines.push('---', '', `# ${title}`, '')

    if (options.sourceFile) {
      const sourceTarget = options.sourceFile.replace(/\.md$/i, '')
      lines.push(`> 来源: [[${sourceTarget}]]`, '')
    }

    lines.push('## 任务概览', '')
    lines.push(`- 状态: ${options.done ? '✅ 已完成' : '⏳ 进行中'}`)
    lines.push(`- 优先级: ${options.priority || '未设置'}`)
    lines.push(`- 分类: ${options.category || '未设置'}`)

    if (options.note) {
      lines.push('', '## 笔记', '', options.note)
    }

    if (options.conclusion) {
      lines.push('', '## 结论', '', options.conclusion)
    }

    lines.push('', '## 进展', '', '- [ ] ')
    return this.collapseBlankLines(lines.join('\n'))
  }

  private normalizeLinkTarget(linkTarget: string): { file: string } {
    const trimmed = linkTarget?.trim().replace(/^\[\[/, '').replace(/\]\]$/, '')
    if (!trimmed) {
      throw new Error('Invalid link target')
    }
    const withoutAlias = trimmed.split('|')[0]
    const [pathPart] = withoutAlias.split('#')
    const relative = this.normalizeRelativePath(
      pathPart.endsWith('.md') ? pathPart : `${pathPart}.md`
    )
    return { file: relative }
  }

  private normalizeRelativePath(path: string): string {
    return path
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/{2,}/g, '/')
  }

  private buildObsidianUri(relativePath: string): string {
    const vaultName = this.getVaultName()
    const normalized = this.normalizeRelativePath(relativePath)
    return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(normalized)}`
  }

  private getVaultName(): string {
    const vaultPath = this.getVaultPath()
    if (!vaultPath) return 'Vault'
    const normalized = vaultPath.replace(/\\/g, '/').replace(/\/+$/, '')
    const segments = normalized.split('/')
    return segments[segments.length - 1] || 'Vault'
  }

  // ==================== Calendar 管理 ====================

  /**
   * 读取 Calendar 事件
   *
   * 格式：
   * ```markdown
   * ## Calendar
   * - 2025-01-08 10:00 Meeting #work
   * - 2025-01-09 14:30 Dentist #personal
   * ```
   */
  async readCalendarEvents(template: string): Promise<CalendarEvent[]> {
    if (!this.config.enabled) return []

    try {
      const filePath = this.resolveTemplatePath(template)
      const content = await this.readFileContent(filePath)
      const events = this.parseCalendarEvents(content)

      this.obsidianLogger.info('Calendar events loaded', { count: events.length })
      return events
    } catch (error) {
      this.obsidianLogger.error('Failed to read calendar events', error as Error)
      return []
    }
  }

  /**
   * 解析 Calendar 事件
   */
  private parseCalendarEvents(content: string): CalendarEvent[] {
    const events: CalendarEvent[] = []
    const lines = content.split('\n')
    let inCalendarSection = false

    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed.startsWith('## Calendar')) {
        inCalendarSection = true
        continue
      }

      if (inCalendarSection && trimmed.startsWith('##')) {
        break
      }

      if (!inCalendarSection) continue

      // 匹配扩展格式：
      // - 2025-01-08 10:00 Meeting #work
      // - 2025-01-08 10:00-11:00 Meeting :: desc #work
      // - 2025-01-08 全天 Offsite
      const match = trimmed.match(
        /^- ([\d-]+)\s+(?:((?:\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?)|(全天))\s+(.+?)(?:\s+::\s+([^#]+))?(?:\s+#([\w-]+))?$/u
      )
      if (match) {
        const [
          ,
          date,
          timeSegment,
          endTimeSegment,
          allDayMarker,
          titleRaw,
          descriptionRaw,
          categoryRaw,
        ] = match

        const allDay = Boolean(allDayMarker)
        const startTime = allDay ? '00:00' : timeSegment || '00:00'
        const endTime = allDay ? null : endTimeSegment || null
        const durationMinutes =
          !allDay && timeSegment && endTime
            ? this.calculateDurationMinutes(timeSegment, endTime)
            : undefined

        const title = titleRaw.trim()
        const description = descriptionRaw?.trim()
        const category = categoryRaw || 'default'

        events.push({
          id: this.generateId(),
          title,
          date,
          time: startTime,
          endTime,
          durationMinutes,
          allDay,
          category,
          description,
          createdAt: Date.now(),
        })
      }
    }

    return events
  }

  /**
   * 同步 Calendar 事件
   */
  async syncCalendarEvents(events: CalendarEvent[], template: string): Promise<void> {
    if (!this.config.enabled) return

    try {
      const filePath = this.resolveTemplatePath(template)
      const content = this.formatCalendarEvents(events)
      await this.updateFileSection(filePath, '## Calendar', content)

      this.obsidianLogger.info('Calendar events synced', { count: events.length })
    } catch (error) {
      this.obsidianLogger.error('Failed to sync calendar events', error as Error)
      throw error
    }
  }

  /**
   * 格式化 Calendar 事件
   */
  private formatCalendarEvents(events: CalendarEvent[]): string {
    const lines = ['## Calendar', '']

    for (const event of events) {
      let line = `- ${event.date} `
      if (event.allDay) {
        line += '全天 '
      } else {
        const startTime = event.time || '00:00'
        line += startTime
        if (event.endTime) {
          line += `-${event.endTime}`
        }
        line += ' '
      }
      line += event.title
      const sanitizedDescription = event.description?.replace(/\r?\n/g, ' ').trim()
      if (sanitizedDescription) {
        line += ` :: ${sanitizedDescription}`
      }
      if (event.category && event.category !== 'default') {
        line += ` #${event.category}`
      }
      lines.push(line)
    }

    return lines.join('\n')
  }

  /**
   * 计算时间差（分钟）
   */
  private calculateDurationMinutes(start: string, end: string): number | undefined {
    const startMinutes = this.timeStringToMinutes(start)
    const endMinutes = this.timeStringToMinutes(end)
    if (startMinutes === undefined || endMinutes === undefined) return undefined
    const diff = endMinutes - startMinutes
    return diff > 0 ? diff : undefined
  }

  /**
   * HH:mm -> 分钟
   */
  private timeStringToMinutes(value: string): number | undefined {
    const [h, m] = value.split(':').map((num) => Number(num))
    if (Number.isNaN(h) || Number.isNaN(m)) return undefined
    return h * 60 + m
  }

  // ==================== Pomodoro 管理 ====================

  /**
   * 读取 Pomodoro 会话
   *
   * 格式：
   * ```markdown
   * ## Pomodoro
   * - 2025-01-08 09:00-09:25 (25min) Coding #work
   * - 2025-01-08 10:00-10:25 (25min) Meeting prep #work
   * ```
   */
  async readPomodoroSessions(template: string): Promise<PomodoroSession[]> {
    if (!this.config.enabled) return []

    try {
      const filePath = this.resolveTemplatePath(template)
      const content = await this.readFileContent(filePath)
      const sessions = this.parsePomodoroSessions(content)

      this.obsidianLogger.info('Pomodoro sessions loaded', { count: sessions.length })
      return sessions
    } catch (error) {
      this.obsidianLogger.error('Failed to read pomodoro sessions', error as Error)
      return []
    }
  }

  /**
   * 解析 Pomodoro 会话
   */
  private parsePomodoroSessions(content: string): PomodoroSession[] {
    const sessions: PomodoroSession[] = []
    const lines = content.split('\n')
    let inPomodoroSection = false

    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed.startsWith('## Pomodoro')) {
        inPomodoroSection = true
        continue
      }

      if (inPomodoroSection && trimmed.startsWith('##')) {
        break
      }

      if (!inPomodoroSection) continue

      // 匹配: - 2025-01-08 09:00-09:25 (25min) Task #category
      const match = trimmed.match(/^- ([\d-]+) ([\d:]+)-([\d:]+) \((\d+)min\) (.+?)(?:\s+#(\w+))?$/)
      if (match) {
        const date = match[1]
        const startTime = match[2]
        const endTime = match[3]
        const duration = Number(match[4])
        const task = match[5].trim()
        const category = match[6] || 'default'

        sessions.push({
          id: this.generateId(),
          task,
          date,
          startTime,
          endTime,
          duration,
          category,
          completed: true,
          createdAt: Date.now(),
        })
      }
    }

    return sessions
  }

  /**
   * 同步 Pomodoro 会话
   */
  async syncPomodoroSessions(sessions: PomodoroSession[], template: string): Promise<void> {
    if (!this.config.enabled) return

    try {
      const filePath = this.resolveTemplatePath(template)
      const content = this.formatPomodoroSessions(sessions)
      await this.updateFileSection(filePath, '## Pomodoro', content)

      this.obsidianLogger.info('Pomodoro sessions synced', { count: sessions.length })
    } catch (error) {
      this.obsidianLogger.error('Failed to sync pomodoro sessions', error as Error)
      throw error
    }
  }

  /**
   * 格式化 Pomodoro 会话
   */
  private formatPomodoroSessions(sessions: PomodoroSession[]): string {
    const lines = ['## Pomodoro', '']

    for (const session of sessions) {
      let line = `- ${session.date} ${session.startTime}-${session.endTime} (${session.duration}min) ${session.task}`
      if (session.category && session.category !== 'default') {
        line += ` #${session.category}`
      }
      lines.push(line)
    }

    return lines.join('\n')
  }

  // ==================== 文件操作 ====================

  /**
   * 读取文件内容（支持 front matter）
   * 如果文件不存在且路径包含模板变量，则自动创建
   */
  private async readFileContent(filePath: string, autoCreate = true): Promise<string> {
    try {
      const raw = await window.electronAPI.readFile(filePath)
      const { content } = this.parseFrontMatter(raw)
      return content
    } catch (error) {
      // 文件不存在
      if (autoCreate) {
        this.obsidianLogger.info('File does not exist, creating with default structure', {
          path: filePath,
        })
        await this.createDefaultFile(filePath)
        // 创建后再次读取
        try {
          const raw = await window.electronAPI.readFile(filePath)
          const { content } = this.parseFrontMatter(raw)
          return content
        } catch (readError) {
          this.obsidianLogger.error('Failed to read newly created file', readError as Error)
          return ''
        }
      } else {
        this.obsidianLogger.warn('File does not exist, will create on sync', { path: filePath })
        return ''
      }
    }
  }

  /**
   * 确保文件所在目录已存在
   */
  private async ensureDirForFile(filePath: string): Promise<void> {
    const dirPath = filePath.substring(0, filePath.lastIndexOf('/'))
    if (!dirPath) return
    try {
      await window.electronAPI.ensureDir(dirPath)
    } catch (error) {
      this.obsidianLogger.error('Failed to create directory', { path: dirPath, error })
    }
  }

  /**
   * 创建默认的 Markdown 文件
   * 当文件不存在时自动创建一个空文件
   */
  private async createDefaultFile(filePath: string): Promise<void> {
    await this.ensureDirForFile(filePath)

    // 创建空文件
    const defaultContent = ''

    try {
      await window.electronAPI.writeFile(filePath, defaultContent)
      this.obsidianLogger.info('Created default file', { path: filePath })
    } catch (error) {
      this.obsidianLogger.error('Failed to create default file', { path: filePath, error })
      throw error
    }
  }

  /**
   * 解析 front matter（简单实现，避免依赖 gray-matter）
   */
  private parseFrontMatter(raw: string): { frontMatter: string; content: string } {
    const lines = raw.split('\n')

    // 检查是否以 --- 开头
    if (lines[0]?.trim() === '---') {
      // 查找结束的 ---
      for (let i = 1; i < lines.length; i++) {
        if (lines[i]?.trim() === '---') {
          // 找到了 front matter 的结束位置
          const frontMatter = lines.slice(1, i).join('\n')
          const content = lines.slice(i + 1).join('\n')
          return { frontMatter, content }
        }
      }
    }

    // 没有 front matter
    return { frontMatter: '', content: raw }
  }

  /**
   * 更新文件的特定段落
   */
  private async updateFileSection(
    filePath: string,
    sectionHeader: string,
    newContent: string
  ): Promise<void> {
    let raw = ''
    let frontMatter = ''

    await this.ensureDirForFile(filePath)

    try {
      raw = await window.electronAPI.readFile(filePath)
      const parsed = this.parseFrontMatter(raw)
      frontMatter = parsed.frontMatter ? `---\n${parsed.frontMatter}\n---\n\n` : ''
    } catch {
      // 文件不存在，创建新文件
      this.obsidianLogger.info('Creating new file', { path: filePath })
    }

    const { content: existingContent } = this.parseFrontMatter(raw)
    const updatedContent = this.replaceSectionContent(existingContent, sectionHeader, newContent)
    const finalContent = frontMatter + updatedContent

    await window.electronAPI.writeFile(filePath, finalContent)
  }

  /**
   * 追加内容到文件的特定段落
   */
  async appendToSection(filePath: string, sectionTitle: string, content: string): Promise<void> {
    let raw = ''
    let frontMatter = ''

    await this.ensureDirForFile(filePath)

    try {
      raw = await window.electronAPI.readFile(filePath)
      const parsed = this.parseFrontMatter(raw)
      frontMatter = parsed.frontMatter ? `---\n${parsed.frontMatter}\n---\n\n` : ''
    } catch {
      // 文件不存在，创建新文件
      this.obsidianLogger.info('Creating new file', { path: filePath })
    }

    const { content: existingContent } = this.parseFrontMatter(raw)
    const updatedContent = this.appendToSectionContent(existingContent, sectionTitle, content)
    const finalContent = frontMatter + updatedContent

    await window.electronAPI.writeFile(filePath, finalContent)
    this.obsidianLogger.info('Appended to section', { path: filePath, section: sectionTitle })
  }

  /**
   * 追加内容到指定 section
   */
  private appendToSectionContent(
    existingContent: string,
    sectionTitle: string,
    newContent: string
  ): string {
    const lines = existingContent.split('\n')
    const sectionHeaderRegex = new RegExp(`^# ${sectionTitle}$`)

    let sectionIndex = -1
    let nextSectionIndex = -1

    // 查找目标 section
    for (let i = 0; i < lines.length; i++) {
      if (sectionHeaderRegex.test(lines[i].trim())) {
        sectionIndex = i
      } else if (sectionIndex >= 0 && lines[i].trim().startsWith('# ')) {
        // 找到下一个一级标题
        nextSectionIndex = i
        break
      }
    }

    if (sectionIndex >= 0) {
      // Section 存在，追加到该 section 的末尾（下一个 section 之前）
      const insertIndex = nextSectionIndex >= 0 ? nextSectionIndex : lines.length
      lines.splice(insertIndex, 0, newContent)
    } else {
      // Section 不存在，创建新 section 并添加内容
      if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
        lines.push('') // 添加空行
      }
      lines.push(`# ${sectionTitle}`)
      lines.push('')
      lines.push(newContent)
    }

    return lines.join('\n')
  }

  /**
   * 替换段落内容
   */
  private replaceSectionContent(
    content: string,
    sectionHeader: string,
    newSectionContent: string
  ): string {
    const lines = content.split('\n')
    const result: string[] = []
    let inTargetSection = false
    let sectionFound = false

    // 确定section的级别（# 或 ## 或 ###）
    const sectionLevel = sectionHeader.match(/^#+/)?.[0].length || 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      if (line === sectionHeader) {
        // 找到目标段落
        inTargetSection = true
        sectionFound = true
        result.push(newSectionContent)
        continue
      }

      if (inTargetSection) {
        // 检查是否遇到同级或更高级的标题（退出当前section）
        const currentLevelMatch = line.match(/^#+/)
        if (currentLevelMatch) {
          const currentLevel = currentLevelMatch[0].length
          if (currentLevel <= sectionLevel) {
            // 遇到同级或更高级标题，退出目标段落
            inTargetSection = false
          }
        }
      }

      if (!inTargetSection) {
        result.push(lines[i])
      }
    }

    // 如果段落不存在，添加到末尾
    if (!sectionFound) {
      result.push('')
      result.push(newSectionContent)
    }

    return result.join('\n')
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

// 导出单例
export const obsidianManager = new ObsidianManager()
export default ObsidianManager
