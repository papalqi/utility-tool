/**
 * GitHub & Git IPC handlers
 * 使用服务层处理业务逻辑
 */

import { ipcMain } from 'electron'
import { githubService } from '../services'
import type { GitHubRepoEntry } from '../utils/markdown-parser'
import type { IpcContext } from './index'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerGithubIpc(_context: IpcContext): void {
  // ==================== GitHub API ====================

  ipcMain.handle('github:verifyToken', async (_event, token: string) => {
    return githubService.verifyToken(token)
  })

  ipcMain.handle('github:listRepos', async (_event, token: string) => {
    // 设置 token 并列出仓库
    await githubService.setToken(token)
    return githubService.listRemoteRepos()
  })

  ipcMain.handle('github:cloneRepo', async (_event, options: { url: string; targetPath: string }) => {
    return githubService.cloneRepo(options.url, options.targetPath)
  })

  // ==================== Git Operations ====================

  ipcMain.handle('git:getInfo', async (_event, repoPath: string) => {
    return githubService.getRepoInfo(repoPath)
  })

  ipcMain.handle('git:execCommand', async (_event, repoPath: string, command: string) => {
    return githubService.execGitCommand(repoPath, command)
  })

  // ==================== Obsidian GitHub Repos ====================

  ipcMain.handle('github:loadLocalRepos', async (_event, hostname: string) => {
    return githubService.loadLocalRepos(hostname)
  })

  ipcMain.handle('github:saveLocalRepos', async (_event, hostname: string, repos: GitHubRepoEntry[]) => {
    return githubService.saveLocalRepos(hostname, repos)
  })

  ipcMain.handle('github:loadFavorites', async () => {
    return githubService.loadFavorites()
  })

  ipcMain.handle('github:saveFavorites', async (_event, favorites: string[]) => {
    // 清理输入
    const sanitized = Array.from(
      new Set(
        (Array.isArray(favorites) ? favorites : [])
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item) => item.length > 0)
      )
    )
    return githubService.saveFavorites(sanitized)
  })
}
