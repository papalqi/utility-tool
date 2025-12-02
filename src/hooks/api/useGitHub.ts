/**
 * GitHub 完整功能 Hook
 * 封装 GitHub Widget 的所有业务逻辑
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { ipc } from '@/core/ipc-client'
import { useObsidian } from '@/hooks/useObsidian'
import type { LocalRepository, GitHubRepository } from '@/shared/github-types'

// ==================== 类型定义 ====================

export type GitAction = 'status' | 'pull' | 'push' | 'fetch'

export interface GitHubTokenVerifyResult {
  success: boolean
  username?: string
  error?: string
}

export interface GitCloneResult {
  success: boolean
  error?: string
}

export interface GitInfoResult {
  remoteUrl?: string
  branch?: string
}

export interface UseGitHubOptions {
  onMessage?: (type: 'success' | 'error' | 'warning' | 'info', content: string) => void
  onLog?: (level: 'info' | 'warn' | 'error', message: string, data?: unknown) => void
}

interface UseGitHubReturn {
  // 状态
  hostname: string
  githubToken: string
  tokenVerified: boolean
  localRepos: LocalRepository[]
  remoteRepos: GitHubRepository[]
  favoriteRemotes: string[]
  loading: boolean
  gitActionState: { repoId: string; action: GitAction } | null

  // 计算属性
  favoriteRemoteSet: Set<string>
  isRepoFavorited: (remoteUrl?: string) => boolean

  // Token 操作
  loadGitHubToken: () => Promise<void>
  saveGitHubToken: (token: string) => Promise<void>
  verifyToken: (token: string) => Promise<boolean>

  // 本地仓库操作
  loadLocalRepos: () => Promise<void>
  saveLocalRepos: (repos: LocalRepository[]) => Promise<void>
  addLocalRepo: (repo: Omit<LocalRepository, 'id'>) => Promise<void>
  removeLocalRepo: (repoId: string) => Promise<void>
  openRepoDir: (repo: LocalRepository) => Promise<void>
  getGitInfo: (path: string) => Promise<GitInfoResult>

  // 远程仓库操作
  loadRemoteRepos: () => Promise<void>
  cloneRepo: (url: string, repoName?: string, description?: string) => Promise<boolean>

  // 收藏操作
  loadFavorites: () => Promise<void>
  saveFavorites: (favorites: string[]) => Promise<void>
  toggleFavorite: (remoteUrl: string) => Promise<void>
  addFavoriteUrl: (url: string) => Promise<void>

  // Git 操作
  execGitAction: (repo: LocalRepository, action: GitAction) => Promise<string | null>

  // 工具函数
  normalizeGitRemote: (url?: string) => string
  getRepoSlugFromRemote: (url: string) => string
  getRepoNameFromRemote: (url: string) => string
}

// ==================== 工具函数 ====================

const normalizeGitRemote = (remoteUrl?: string) => (remoteUrl || '').trim()

const getRepoSlugFromRemote = (remoteUrl: string) => {
  const normalized = normalizeGitRemote(remoteUrl).replace(/\.git$/i, '')
  if (!normalized) return ''

  const githubMatch = normalized.match(/github\.com[:/](.+)$/i)
  if (githubMatch?.[1]) {
    return githubMatch[1].replace(/^\/+/, '')
  }

  if (normalized.includes(':')) {
    const [, slug] = normalized.split(':')
    return slug?.replace(/^\/+/, '') || normalized
  }

  const segments = normalized.split('/').filter(Boolean)
  if (segments.length >= 2) {
    return segments.slice(-2).join('/')
  }

  return normalized
}

const getRepoNameFromRemote = (remoteUrl: string) => {
  const slug = getRepoSlugFromRemote(remoteUrl)
  if (!slug) return 'repository'
  const parts = slug.split('/')
  return parts[parts.length - 1] || slug
}

const dedupeFavoriteUrls = (items: string[]) => {
  const normalizedMap = new Map<string, string>()
  for (const item of items) {
    const trimmed = (item || '').trim()
    const normalized = normalizeGitRemote(trimmed)
    if (normalized && normalized.includes('github.com') && !normalizedMap.has(normalized)) {
      normalizedMap.set(normalized, trimmed)
    }
  }
  return Array.from(normalizedMap.values())
}

// ==================== Hook 实现 ====================

export function useGitHub(options: UseGitHubOptions = {}): UseGitHubReturn {
  const { onMessage, onLog } = options
  const { isEnabled: obsidianEnabled, readSecrets, updateSecret } = useObsidian()

  // 状态
  const [hostname, setHostname] = useState('')
  const [githubToken, setGitHubToken] = useState('')
  const [tokenVerified, setTokenVerified] = useState(false)
  const [localRepos, setLocalRepos] = useState<LocalRepository[]>([])
  const [remoteRepos, setRemoteRepos] = useState<GitHubRepository[]>([])
  const [favoriteRemotes, setFavoriteRemotes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [gitActionState, setGitActionState] = useState<{ repoId: string; action: GitAction } | null>(null)

  // 计算属性
  const favoriteRemoteSet = useMemo(() => {
    const set = new Set<string>()
    favoriteRemotes.forEach((url) => {
      const normalized = normalizeGitRemote(url)
      if (normalized && normalized.includes('github.com')) {
        set.add(normalized)
      }
    })
    return set
  }, [favoriteRemotes])

  const isRepoFavorited = useCallback(
    (remoteUrl?: string) => {
      if (!remoteUrl) return false
      return favoriteRemoteSet.has(normalizeGitRemote(remoteUrl))
    },
    [favoriteRemoteSet]
  )

  // 初始化 hostname
  useEffect(() => {
    const init = async () => {
      try {
        const current = await window.electronAPI.getHostname()
        setHostname(current)
      } catch (error) {
        onLog?.('error', 'Failed to load hostname', error)
      }
    }
    init()
  }, [onLog])

  // ========== Token 操作 ==========

  const loadGitHubToken = useCallback(async () => {
    if (!obsidianEnabled) {
      onLog?.('warn', 'Obsidian not enabled, cannot load GitHub token')
      return
    }

    try {
      const secrets = await readSecrets()
      const token = secrets?.github_token || ''
      setGitHubToken(token)
      if (token) {
        setTokenVerified(true)
      }
      onLog?.('info', 'GitHub token loaded', { hasToken: !!token })
    } catch (error) {
      onLog?.('error', 'Failed to load GitHub token', error)
    }
  }, [obsidianEnabled, readSecrets, onLog])

  const saveGitHubToken = useCallback(
    async (token: string) => {
      if (!obsidianEnabled) {
        onMessage?.('warning', 'Obsidian 未启用，Token 仅在当前会话有效')
        setGitHubToken(token)
        return
      }

      try {
        const success = await updateSecret('github_token', token)
        if (success) {
          setGitHubToken(token)
          onMessage?.('success', 'GitHub Token 已保存到 Obsidian')
          onLog?.('info', 'GitHub token saved')
        } else {
          throw new Error('updateSecret returned false')
        }
      } catch (error) {
        onMessage?.('error', '保存 Token 失败')
        onLog?.('error', 'Failed to save GitHub token', error)
        throw error
      }
    },
    [obsidianEnabled, updateSecret, onMessage, onLog]
  )

  const verifyToken = useCallback(
    async (token: string): Promise<boolean> => {
      setLoading(true)
      try {
        const result = (await ipc.invoke('github:verifyToken', token)) as unknown as GitHubTokenVerifyResult
        if (result.success) {
          setTokenVerified(true)
          await saveGitHubToken(token)
          onMessage?.('success', `Token 验证成功！用户：${result.username}`)
          return true
        } else {
          onMessage?.('error', 'Token 验证失败，请检查 Token 是否正确')
          return false
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        onMessage?.('error', `验证失败：${errorMessage}`)
        onLog?.('error', 'Token verification failed', error)
        return false
      } finally {
        setLoading(false)
      }
    },
    [saveGitHubToken, onMessage, onLog]
  )

  // ========== 本地仓库操作 ==========

  const loadLocalRepos = useCallback(async () => {
    if (!obsidianEnabled || !hostname) {
      setLocalRepos([])
      return
    }

    try {
      const repos = (await ipc.invoke('github:loadLocalRepos', hostname)) as unknown
      const repoList = Array.isArray(repos) ? (repos as LocalRepository[]) : []
      setLocalRepos(repoList)
      onLog?.('info', 'Local repositories loaded', { count: repoList.length, hostname })
    } catch (error) {
      onLog?.('error', 'Failed to load local repositories', error)
      setLocalRepos([])
    }
  }, [obsidianEnabled, hostname, onLog])

  const saveLocalRepos = useCallback(
    async (repos: LocalRepository[]) => {
      if (!obsidianEnabled) {
        onMessage?.('warning', 'Obsidian 未启用，仓库列表仅在当前会话有效')
        setLocalRepos(repos)
        return
      }

      if (!hostname) {
        onMessage?.('error', '未能获取当前计算机名称，无法保存仓库列表')
        return
      }

      try {
        await ipc.invoke('github:saveLocalRepos', hostname, repos)
        setLocalRepos(repos)
        onLog?.('info', 'Local repositories saved', { count: repos.length, hostname })
      } catch (error) {
        onMessage?.('error', '保存仓库列表失败')
        onLog?.('error', 'Failed to save local repositories', error)
        throw error
      }
    },
    [obsidianEnabled, hostname, onMessage, onLog]
  )

  const addLocalRepo = useCallback(
    async (repo: Omit<LocalRepository, 'id'>) => {
      const newRepo: LocalRepository = {
        ...repo,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }
      await saveLocalRepos([...localRepos, newRepo])
      onMessage?.('success', '仓库已添加')
    },
    [localRepos, saveLocalRepos, onMessage]
  )

  const removeLocalRepo = useCallback(
    async (repoId: string) => {
      const newRepos = localRepos.filter((r) => r.id !== repoId)
      await saveLocalRepos(newRepos)
      onMessage?.('success', '仓库已移除')
    },
    [localRepos, saveLocalRepos, onMessage]
  )

  const openRepoDir = useCallback(
    async (repo: LocalRepository) => {
      try {
        await ipc.invoke('shell:openPath', repo.path)
        // 更新最后打开时间
        const updatedRepos = localRepos.map((r) =>
          r.id === repo.id ? { ...r, lastOpened: Date.now() } : r
        )
        await saveLocalRepos(updatedRepos)
      } catch (error) {
        onMessage?.('error', '打开目录失败')
        onLog?.('error', 'Failed to open repo directory', error)
      }
    },
    [localRepos, saveLocalRepos, onMessage, onLog]
  )

  const getGitInfo = useCallback(async (path: string): Promise<GitInfoResult> => {
    try {
      return ((await ipc.invoke('git:getInfo', path)) as GitInfoResult) || {}
    } catch {
      return {}
    }
  }, [])

  // ========== 远程仓库操作 ==========

  const loadRemoteRepos = useCallback(async () => {
    if (!tokenVerified || !githubToken) {
      onMessage?.('warning', '请先配置并验证 GitHub Token')
      return
    }

    setLoading(true)
    try {
      const repos = (await ipc.invoke('github:listRepos', githubToken)) as unknown
      const repoList = Array.isArray(repos) ? (repos as GitHubRepository[]) : []
      setRemoteRepos(repoList)
      onMessage?.('success', `加载了 ${repoList.length} 个仓库`)
      onLog?.('info', 'Remote repositories loaded', { count: repoList.length })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      onMessage?.('error', `加载仓库失败：${errorMessage}`)
      onLog?.('error', 'Failed to load remote repositories', error)
    } finally {
      setLoading(false)
    }
  }, [tokenVerified, githubToken, onMessage, onLog])

  const cloneRepo = useCallback(
    async (url: string, repoName?: string, description?: string): Promise<boolean> => {
      const trimmedUrl = url?.trim()
      if (!trimmedUrl) {
        onMessage?.('error', '缺少远程仓库地址')
        return false
      }

      try {
        const targetDir = await window.electronAPI.selectFolder({
          title: '选择克隆目标目录',
          properties: ['openDirectory', 'createDirectory'],
        })

        if (!targetDir) return false

        const safeName = repoName?.trim() || getRepoNameFromRemote(trimmedUrl)
        const clonePath = `${targetDir}/${safeName}`

        setLoading(true)

        const result = (await ipc.invoke('github:cloneRepo', {
          url: trimmedUrl,
          targetPath: clonePath,
        })) as GitCloneResult

        if (result?.success) {
          onMessage?.('success', '克隆成功！')

          const newRepo: LocalRepository = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: safeName,
            path: clonePath,
            remoteUrl: trimmedUrl,
            branch: 'main',
            description,
            lastOpened: Date.now(),
          }

          await saveLocalRepos([...localRepos, newRepo])
          return true
        } else {
          onMessage?.('error', `克隆失败：${result?.error || '未知错误'}`)
          return false
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        onMessage?.('error', `克隆失败：${errorMessage}`)
        onLog?.('error', 'Clone repository failed', error)
        return false
      } finally {
        setLoading(false)
      }
    },
    [localRepos, saveLocalRepos, onMessage, onLog]
  )

  // ========== 收藏操作 ==========

  const loadFavorites = useCallback(async () => {
    if (!obsidianEnabled) {
      setFavoriteRemotes([])
      return
    }

    try {
      const favorites = (await ipc.invoke('github:loadFavorites')) as unknown
      const list = Array.isArray(favorites)
        ? (favorites as unknown[])
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter(Boolean)
        : []
      const deduped = dedupeFavoriteUrls(list)
      setFavoriteRemotes(deduped)
      onLog?.('info', 'Favorite repositories loaded', { count: deduped.length })
    } catch (error) {
      onLog?.('error', 'Failed to load favorite repositories', error)
      setFavoriteRemotes([])
    }
  }, [obsidianEnabled, onLog])

  const saveFavorites = useCallback(
    async (favorites: string[]) => {
      const unique = dedupeFavoriteUrls(favorites)

      if (!obsidianEnabled) {
        if (unique.length > 0) {
          onMessage?.('warning', 'Obsidian 未启用，收藏仅在当前会话有效')
        }
        setFavoriteRemotes(unique)
        return
      }

      try {
        await ipc.invoke('github:saveFavorites', unique)
        setFavoriteRemotes(unique)
        onLog?.('info', 'Favorite repositories saved', { count: unique.length })
      } catch (error) {
        onLog?.('error', 'Failed to save favorite repositories', error)
        onMessage?.('error', '保存收藏失败')
        throw error
      }
    },
    [obsidianEnabled, onMessage, onLog]
  )

  const toggleFavorite = useCallback(
    async (remoteUrl: string) => {
      const normalized = normalizeGitRemote(remoteUrl)
      if (!normalized) return

      if (!normalized.includes('github.com')) {
        onMessage?.('warning', '目前仅支持收藏 GitHub 仓库')
        return
      }

      const exists = favoriteRemoteSet.has(normalized)
      const updated = exists
        ? favoriteRemotes.filter((url) => normalizeGitRemote(url) !== normalized)
        : [...favoriteRemotes, remoteUrl.trim()]

      try {
        await saveFavorites(updated)
        const name = getRepoSlugFromRemote(normalized) || normalized
        onMessage?.('success', `${exists ? '已取消收藏' : '已收藏'} ${name}`)
      } catch {
        // 错误提示已在 saveFavorites 中处理
      }
    },
    [favoriteRemotes, favoriteRemoteSet, saveFavorites, onMessage]
  )

  const addFavoriteUrl = useCallback(
    async (url: string) => {
      const target = url.trim()
      if (!target) {
        onMessage?.('warning', '请输入 GitHub 仓库地址')
        return
      }

      const normalized = normalizeGitRemote(target)
      if (!normalized || !normalized.includes('github.com')) {
        onMessage?.('warning', '请输入有效的 GitHub 仓库地址')
        return
      }

      if (favoriteRemoteSet.has(normalized)) {
        onMessage?.('info', '该仓库已在收藏列表')
        return
      }

      try {
        await saveFavorites([...favoriteRemotes, target])
        onMessage?.('success', '收藏已添加')
      } catch {
        // 错误提示已在 saveFavorites 中处理
      }
    },
    [favoriteRemotes, favoriteRemoteSet, saveFavorites, onMessage]
  )

  // ========== Git 操作 ==========

  const execGitAction = useCallback(
    async (repo: LocalRepository, action: GitAction): Promise<string | null> => {
      if (!repo.path) {
        onMessage?.('error', '该仓库缺少路径信息')
        return null
      }

      setGitActionState({ repoId: repo.id, action })
      try {
        let command = ''
        let successMessage = ''

        switch (action) {
          case 'status':
            command = 'git status -sb'
            break
          case 'pull':
            command = 'git pull'
            successMessage = '已拉取最新代码'
            break
          case 'push':
            command = 'git push'
            successMessage = '已推送到远程'
            break
          case 'fetch':
            command = 'git fetch'
            successMessage = '已获取最新引用'
            break
          default:
            return null
        }

        const output = (await ipc.invoke('git:execCommand', repo.path, command)) as string

        if (action !== 'status' && successMessage) {
          onMessage?.('success', successMessage)
          await loadLocalRepos()
        }

        return output
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        onMessage?.('error', `Git 操作失败：${errorMessage}`)
        onLog?.('error', 'Git action failed', { action, repo: repo.name, error })
        return null
      } finally {
        setGitActionState(null)
      }
    },
    [loadLocalRepos, onMessage, onLog]
  )

  // ========== 初始化 ==========

  useEffect(() => {
    if (hostname && obsidianEnabled) {
      loadLocalRepos()
      loadGitHubToken()
      loadFavorites()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostname, obsidianEnabled])

  return {
    // 状态
    hostname,
    githubToken,
    tokenVerified,
    localRepos,
    remoteRepos,
    favoriteRemotes,
    loading,
    gitActionState,

    // 计算属性
    favoriteRemoteSet,
    isRepoFavorited,

    // Token 操作
    loadGitHubToken,
    saveGitHubToken,
    verifyToken,

    // 本地仓库操作
    loadLocalRepos,
    saveLocalRepos,
    addLocalRepo,
    removeLocalRepo,
    openRepoDir,
    getGitInfo,

    // 远程仓库操作
    loadRemoteRepos,
    cloneRepo,

    // 收藏操作
    loadFavorites,
    saveFavorites,
    toggleFavorite,
    addFavoriteUrl,

    // Git 操作
    execGitAction,

    // 工具函数
    normalizeGitRemote,
    getRepoSlugFromRemote,
    getRepoNameFromRemote,
  }
}
