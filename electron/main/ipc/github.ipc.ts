/**
 * GitHub & Git IPC handlers
 */

import { ipcMain } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import log from '../logger'
import { configManager } from '../config'
import * as githubService from '../github-service'
import {
  parseGitHubReposMarkdown,
  updateGitHubReposMarkdown,
  parseGitHubFavoritesSection,
  updateGitHubFavoritesSection,
  GitHubRepoEntry,
} from '../utils/markdown-parser'
import type { IpcContext } from './index'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerGithubIpc(_context: IpcContext): void {
  // ==================== GitHub API ====================

  ipcMain.handle('github:verifyToken', async (_event, token: string) => {
    return githubService.verifyGitHubToken(token)
  })

  ipcMain.handle('github:listRepos', async (_event, token: string) => {
    return githubService.listUserRepositories(token)
  })

  ipcMain.handle('github:cloneRepo', async (_event, options: { url: string; targetPath: string }) => {
    return githubService.cloneRepository(options.url, options.targetPath)
  })

  // ==================== Git Operations ====================

  ipcMain.handle('git:getInfo', async (_event, repoPath: string) => {
    return githubService.getGitInfo(repoPath)
  })

  ipcMain.handle('git:execCommand', async (_event, repoPath: string, command: string) => {
    return githubService.execGitCommand(repoPath, command)
  })

  // ==================== Obsidian GitHub Repos ====================

  ipcMain.handle('github:loadLocalRepos', async (_event, hostname: string) => {
    try {
      const obsidianConfig = configManager.getObsidianConfig()
      if (!('vault_path' in obsidianConfig) || !obsidianConfig.vault_path) {
        throw new Error('Obsidian vault path not configured')
      }

      const content = readFileSync(`${obsidianConfig.vault_path}/github-repos.md`, 'utf-8')
      // 简单解析 Markdown 表格（需要更完善的实现）
      return parseGitHubReposMarkdown(content, hostname)
    } catch (error) {
      log.debug('Failed to load GitHub repos, file may not exist yet')
      return []
    }
  })

  ipcMain.handle('github:saveLocalRepos', async (_event, hostname: string, repos: GitHubRepoEntry[]) => {
    try {
      const obsidianConfig = configManager.getObsidianConfig()
      if (!('vault_path' in obsidianConfig) || !obsidianConfig.vault_path) {
        throw new Error('Obsidian vault path not configured')
      }
      const vaultPath = obsidianConfig.vault_path
      if (!vaultPath) {
        throw new Error('Obsidian vault path not configured')
      }

      const filePath = `${vaultPath}/github-repos.md`

      // 读取现有内容
      let content = ''
      try {
        content = readFileSync(filePath, 'utf-8')
      } catch {
        content = '# GitHub Local Repositories\n\n'
      }

      // 更新指定计算机的仓库列表
      content = updateGitHubReposMarkdown(content, hostname, repos)

      // 写回文件
      writeFileSync(filePath, content, 'utf-8')
      log.info('GitHub repos saved', { hostname, count: repos.length })
      return true
    } catch (error) {
      log.error('Failed to save GitHub repos', error)
      throw error
    }
  })

  ipcMain.handle('github:loadFavorites', async () => {
    try {
      const obsidianConfig = configManager.getObsidianConfig()
      if (!('vault_path' in obsidianConfig) || !obsidianConfig.vault_path) {
        throw new Error('Obsidian vault path not configured')
      }

      const vaultPath = obsidianConfig.vault_path
      const filePath = `${vaultPath}/github-repos.md`

      if (!existsSync(filePath)) {
        return []
      }

      const content = readFileSync(filePath, 'utf-8')
      return parseGitHubFavoritesSection(content)
    } catch (error) {
      log.debug('Failed to load GitHub favorites, section may not exist yet')
      return []
    }
  })

  ipcMain.handle('github:saveFavorites', async (_event, favorites: string[]) => {
    try {
      const obsidianConfig = configManager.getObsidianConfig()
      if (!('vault_path' in obsidianConfig) || !obsidianConfig.vault_path) {
        throw new Error('Obsidian vault path not configured')
      }
      const vaultPath = obsidianConfig.vault_path
      const filePath = `${vaultPath}/github-repos.md`

      const sanitized = Array.from(
        new Set(
          (Array.isArray(favorites) ? favorites : [])
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter((item) => item.length > 0)
        )
      )

      let content = ''
      try {
        content = readFileSync(filePath, 'utf-8')
      } catch {
        content = '# GitHub Local Repositories\n\n'
      }

      const updatedContent = updateGitHubFavoritesSection(content, sanitized)
      writeFileSync(filePath, updatedContent, 'utf-8')
      log.info('GitHub favorites saved', { count: sanitized.length })
      return true
    } catch (error) {
      log.error('Failed to save GitHub favorites', error)
      throw error
    }
  })
}
