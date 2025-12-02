/**
 * Obsidian 服务
 * 管理 Obsidian Vault 的读写操作
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { BaseService } from './base.service'
import { configManager } from '../config'

// ==================== 类型定义 ====================

export interface VaultConfig {
  path: string
  enabled: boolean
}

export interface VaultFile {
  path: string
  content: string
  exists: boolean
}

// ==================== 服务实现 ====================

class ObsidianService extends BaseService {
  private vaultPath: string | null = null

  constructor() {
    super('ObsidianService')
  }

  protected async onInitialize(): Promise<void> {
    this.refreshVaultPath()
  }

  protected async onDestroy(): Promise<void> {
    this.vaultPath = null
  }

  // ==================== Vault 管理 ====================

  /**
   * 刷新 Vault 路径配置
   */
  refreshVaultPath(): void {
    const config = configManager.getObsidianConfig()
    if ('vault_path' in config && config.vault_path) {
      this.vaultPath = config.vault_path
      this.log('Vault path configured', { path: this.vaultPath })
    } else {
      this.vaultPath = null
      this.debug('Vault path not configured')
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
  getVaultPath(): string | null {
    return this.vaultPath
  }

  /**
   * 确保 Vault 路径有效
   */
  private ensureVault(): string {
    if (!this.vaultPath) {
      throw new Error('Obsidian vault not configured')
    }
    if (!existsSync(this.vaultPath)) {
      throw new Error(`Obsidian vault not found: ${this.vaultPath}`)
    }
    return this.vaultPath
  }

  // ==================== 文件操作 ====================

  /**
   * 读取 Vault 中的文件
   */
  readFile(relativePath: string): VaultFile {
    const vaultPath = this.ensureVault()
    const fullPath = join(vaultPath, relativePath)

    if (!existsSync(fullPath)) {
      return { path: relativePath, content: '', exists: false }
    }

    try {
      const content = readFileSync(fullPath, 'utf-8')
      return { path: relativePath, content, exists: true }
    } catch (error) {
      this.error(`Failed to read file: ${relativePath}`, error)
      throw error
    }
  }

  /**
   * 写入 Vault 中的文件
   */
  writeFile(relativePath: string, content: string): void {
    const vaultPath = this.ensureVault()
    const fullPath = join(vaultPath, relativePath)

    try {
      // 确保目录存在
      const dir = dirname(fullPath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      writeFileSync(fullPath, content, 'utf-8')
      this.debug(`File written: ${relativePath}`)
    } catch (error) {
      this.error(`Failed to write file: ${relativePath}`, error)
      throw error
    }
  }

  /**
   * 检查文件是否存在
   */
  fileExists(relativePath: string): boolean {
    const vaultPath = this.ensureVault()
    return existsSync(join(vaultPath, relativePath))
  }

  /**
   * 追加内容到文件
   */
  appendToFile(relativePath: string, content: string): void {
    const vaultPath = this.ensureVault()
    const fullPath = join(vaultPath, relativePath)

    try {
      let existing = ''
      if (existsSync(fullPath)) {
        existing = readFileSync(fullPath, 'utf-8')
      }
      writeFileSync(fullPath, existing + content, 'utf-8')
      this.debug(`Content appended to: ${relativePath}`)
    } catch (error) {
      this.error(`Failed to append to file: ${relativePath}`, error)
      throw error
    }
  }

  // ==================== 便捷方法 ====================

  /**
   * 读取 JSON 文件
   */
  readJson<T>(relativePath: string, defaultValue: T): T {
    const file = this.readFile(relativePath)
    if (!file.exists) {
      return defaultValue
    }

    try {
      return JSON.parse(file.content) as T
    } catch {
      this.error(`Failed to parse JSON: ${relativePath}`)
      return defaultValue
    }
  }

  /**
   * 写入 JSON 文件
   */
  writeJson<T>(relativePath: string, data: T): void {
    const content = JSON.stringify(data, null, 2)
    this.writeFile(relativePath, content)
  }

  /**
   * 读取 Markdown 文件
   */
  readMarkdown(relativePath: string): string {
    const file = this.readFile(relativePath)
    return file.content
  }

  /**
   * 写入 Markdown 文件
   */
  writeMarkdown(relativePath: string, content: string): void {
    this.writeFile(relativePath, content)
  }

  /**
   * 获取今日日记路径
   */
  getDailyNotePath(date: Date = new Date()): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `daily/${year}-${month}-${day}.md`
  }

  /**
   * 追加到今日日记
   */
  appendToDailyNote(content: string, date: Date = new Date()): void {
    const path = this.getDailyNotePath(date)
    this.appendToFile(path, `\n${content}`)
  }
}

export const obsidianService = new ObsidianService()
