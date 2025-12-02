/**
 * GitHub 服务
 * 管理 GitHub API 调用、本地仓库信息和 Git 操作
 */

import { Octokit } from '@octokit/rest'
import simpleGit, { SimpleGit, type RemoteWithRefs } from 'simple-git'
import { BaseService } from './base.service'
import { configManager } from '../config'
import { obsidianDAO } from '../data'
import type { GitHubRepoEntry } from '../utils/markdown-parser'

// ==================== 类型定义 ====================

export interface GitHubUser {
  login: string
  name?: string
  avatarUrl?: string
}

export interface GitHubRepository {
  id: number
  name: string
  fullName: string
  description?: string
  htmlUrl: string
  cloneUrl: string
  sshUrl: string
  private: boolean
  fork: boolean
  stargazersCount: number
  language?: string
  updatedAt: string
  pushedAt: string
}

export interface LocalRepoInfo {
  path: string
  isRepo: boolean
  branch?: string
  remoteUrl?: string
  ahead?: number
  behind?: number
  modified?: number
  created?: number
  deleted?: number
  renamed?: number
  conflicted?: number
}

export interface CloneResult {
  success: boolean
  path?: string
  error?: string
}

// ==================== 服务实现 ====================

class GitHubService extends BaseService {
  private octokit: Octokit | null = null
  private currentUser: GitHubUser | null = null
  private repoCache: Map<string, GitHubRepoEntry[]> = new Map()

  constructor() {
    super('GitHubService')
  }

  protected async onInitialize(): Promise<void> {
    // 从配置加载 token 并初始化 Octokit
    const config = configManager.getConfig() as unknown as Record<string, unknown> | null
    const github = config?.github as Record<string, unknown> | undefined
    const token = github?.token as string | undefined
    if (token) {
      await this.setToken(token)
    }
  }

  protected async onDestroy(): Promise<void> {
    this.octokit = null
    this.currentUser = null
    this.repoCache.clear()
  }

  // ==================== Token 管理 ====================

  /**
   * 设置 GitHub Token
   */
  async setToken(token: string): Promise<{ valid: boolean; user?: GitHubUser; error?: string }> {
    try {
      this.octokit = new Octokit({ auth: token })
      const { data: user } = await this.octokit.rest.users.getAuthenticated()

      this.currentUser = {
        login: user.login,
        name: user.name ?? undefined,
        avatarUrl: user.avatar_url,
      }

      this.log('Token set successfully', { username: user.login })
      this.emitEvent('token:validated', this.currentUser)

      return { valid: true, user: this.currentUser }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Token validation failed'
      this.error('Token validation failed', error)
      this.octokit = null
      this.currentUser = null
      return { valid: false, error: message }
    }
  }

  /**
   * 验证 Token
   */
  async verifyToken(token: string): Promise<{ valid: boolean; user?: string; error?: string }> {
    try {
      const octokit = new Octokit({ auth: token })
      const { data: user } = await octokit.rest.users.getAuthenticated()
      return { valid: true, user: user.login }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Verification failed'
      return { valid: false, error: message }
    }
  }

  /**
   * 获取当前用户
   */
  getCurrentUser(): GitHubUser | null {
    return this.currentUser
  }

  // ==================== 远程仓库操作 ====================

  /**
   * 列出用户的所有远程仓库
   */
  async listRemoteRepos(): Promise<GitHubRepository[]> {
    if (!this.octokit) {
      throw new Error('GitHub token not set')
    }

    const repos: GitHubRepository[] = []
    let page = 1

    let hasMore = true
    while (hasMore) {
      const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
        per_page: 100,
        page,
        sort: 'updated',
        direction: 'desc',
      })

      if (data.length === 0) {
        hasMore = false
        break
      }

      repos.push(
        ...data.map((repo) => ({
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description ?? undefined,
          htmlUrl: repo.html_url,
          cloneUrl: repo.clone_url,
          sshUrl: repo.ssh_url,
          private: repo.private,
          fork: repo.fork,
          stargazersCount: repo.stargazers_count,
          language: repo.language ?? undefined,
          updatedAt: repo.updated_at ?? '',
          pushedAt: repo.pushed_at ?? '',
        }))
      )

      page++
      if (repos.length >= 500) break
    }

    this.log('Listed remote repositories', { count: repos.length })
    return repos
  }

  /**
   * 克隆仓库
   */
  async cloneRepo(url: string, targetPath: string): Promise<CloneResult> {
    try {
      this.log('Cloning repository', { url, targetPath })
      const git: SimpleGit = simpleGit()
      await git.clone(url, targetPath)
      this.log('Repository cloned successfully')
      this.emitEvent('repo:cloned', { url, path: targetPath })
      return { success: true, path: targetPath }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Clone failed'
      this.error('Clone failed', error)
      return { success: false, error: message }
    }
  }

  // ==================== 本地仓库操作 ====================

  /**
   * 获取本地 Git 仓库信息
   */
  async getRepoInfo(repoPath: string): Promise<LocalRepoInfo> {
    try {
      const git: SimpleGit = simpleGit(repoPath)

      const isRepo = await git.checkIsRepo()
      if (!isRepo) {
        return { path: repoPath, isRepo: false }
      }

      const branch = await git.branchLocal()
      const remotes = await git.getRemotes(true)
      const originRemote = remotes.find((r: RemoteWithRefs) => r.name === 'origin')
      const status = await git.status()

      return {
        path: repoPath,
        isRepo: true,
        branch: branch.current,
        remoteUrl: originRemote?.refs?.fetch || originRemote?.refs?.push,
        ahead: status.ahead,
        behind: status.behind,
        modified: status.modified.length,
        created: status.created.length,
        deleted: status.deleted.length,
        renamed: status.renamed.length,
        conflicted: status.conflicted.length,
      }
    } catch (error: unknown) {
      this.error('Failed to get repo info', error)
      throw error
    }
  }

  /**
   * 批量同步仓库状态
   */
  async syncRepoStatus(repos: GitHubRepoEntry[]): Promise<GitHubRepoEntry[]> {
    const results = await Promise.all(
      repos.map(async (repo) => {
        try {
          const info = await this.getRepoInfo(repo.path)
          return {
            ...repo,
            branch: info.branch,
            ahead: info.ahead,
            behind: info.behind,
            modified: info.modified,
          }
        } catch {
          return repo
        }
      })
    )
    return results
  }

  /**
   * 执行 Git 命令
   */
  async execGitCommand(repoPath: string, command: string): Promise<string> {
    try {
      const git: SimpleGit = simpleGit(repoPath)
      const result = await git.raw(command.split(' '))
      return result
    } catch (error: unknown) {
      this.error('Git command failed', error)
      throw error
    }
  }

  // ==================== Obsidian 存储 ====================

  /**
   * 从 Obsidian Vault 加载本地仓库列表
   */
  async loadLocalRepos(hostname: string): Promise<GitHubRepoEntry[]> {
    // 检查内存缓存
    if (this.repoCache.has(hostname)) {
      return this.repoCache.get(hostname)!
    }

    if (!obsidianDAO.isAvailable()) {
      this.debug('Obsidian vault not available')
      return []
    }

    try {
      const repos = obsidianDAO.readGitHubRepos(hostname)
      this.repoCache.set(hostname, repos)
      return repos
    } catch (error) {
      this.error('Failed to load local repos', error)
      return []
    }
  }

  /**
   * 保存本地仓库列表到 Obsidian Vault
   */
  async saveLocalRepos(hostname: string, repos: GitHubRepoEntry[]): Promise<boolean> {
    if (!obsidianDAO.isAvailable()) {
      throw new Error('Obsidian vault not available')
    }

    try {
      obsidianDAO.writeGitHubRepos(hostname, repos)
      this.repoCache.set(hostname, repos)
      this.emitEvent('repos:saved', { hostname, count: repos.length })
      return true
    } catch (error) {
      this.error('Failed to save local repos', error)
      throw error
    }
  }

  /**
   * 加载收藏仓库列表
   */
  async loadFavorites(): Promise<string[]> {
    if (!obsidianDAO.isAvailable()) {
      return []
    }

    try {
      return obsidianDAO.readGitHubFavorites()
    } catch {
      return []
    }
  }

  /**
   * 保存收藏仓库列表
   */
  async saveFavorites(favorites: string[]): Promise<boolean> {
    if (!obsidianDAO.isAvailable()) {
      throw new Error('Obsidian vault not available')
    }

    try {
      obsidianDAO.writeGitHubFavorites(favorites)
      return true
    } catch (error) {
      this.error('Failed to save favorites', error)
      throw error
    }
  }

  /**
   * 使缓存失效
   */
  invalidateCache(hostname?: string): void {
    if (hostname) {
      this.repoCache.delete(hostname)
    } else {
      this.repoCache.clear()
    }
  }
}

export const githubService = new GitHubService()
