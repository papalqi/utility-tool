/**
 * GitHub 仓库管理 Hook
 * 封装所有 GitHub 仓库相关的 IPC 调用
 */

import { useState, useCallback, useEffect } from 'react'
import { ipc } from '@/core/ipc-client'

// ==================== 类型定义 ====================

export interface GitHubRepo {
  name: string
  path: string
  url: string
  branch?: string
  ahead?: number
  behind?: number
  modified?: number
  lastSync?: number
}

export interface GitHubRepoInfo {
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

interface UseGitHubReposReturn {
  repos: GitHubRepo[]
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
  syncStatus: () => Promise<void>
  addRepo: (repo: GitHubRepo) => Promise<void>
  removeRepo: (name: string) => Promise<void>
  getRepoInfo: (path: string) => Promise<GitHubRepoInfo>
}

// ==================== Hook 实现 ====================

/**
 * GitHub 仓库管理 Hook
 * 
 * @param hostname 当前主机名
 * 
 * @example
 * ```tsx
 * function GitHubWidget() {
 *   const { repos, loading, error, refresh, syncStatus } = useGitHubRepos('my-pc')
 *   
 *   useEffect(() => {
 *     refresh()
 *   }, [refresh])
 *   
 *   if (loading) return <Spin />
 *   if (error) return <Alert type="error" message={error.message} />
 *   
 *   return (
 *     <List dataSource={repos} renderItem={repo => (
 *       <RepoItem repo={repo} onSync={() => syncStatus()} />
 *     )} />
 *   )
 * }
 * ```
 */
export function useGitHubRepos(hostname: string): UseGitHubReposReturn {
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // 加载仓库列表
  const refresh = useCallback(async () => {
    if (!hostname) return

    setLoading(true)
    setError(null)

    try {
      const data = await ipc.invoke('github:loadLocalRepos', hostname)
      setRepos(data as GitHubRepo[])
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [hostname])

  // 同步仓库状态
  const syncStatus = useCallback(async () => {
    if (repos.length === 0) return

    setLoading(true)
    try {
      const updatedRepos = await Promise.all(
        repos.map(async (repo) => {
          try {
            const info = await ipc.invoke('git:getInfo', repo.path)
            const repoInfo = info as GitHubRepoInfo
            return {
              ...repo,
              branch: repoInfo.branch,
              ahead: repoInfo.ahead,
              behind: repoInfo.behind,
              modified: repoInfo.modified,
              lastSync: Date.now(),
            }
          } catch {
            return repo
          }
        })
      )
      setRepos(updatedRepos)

      // 保存更新后的状态
      await ipc.invoke('github:saveLocalRepos', hostname, updatedRepos)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [repos, hostname])

  // 添加仓库
  const addRepo = useCallback(
    async (repo: GitHubRepo) => {
      const newRepos = [...repos, repo]
      setRepos(newRepos)
      await ipc.invoke('github:saveLocalRepos', hostname, newRepos)
    },
    [repos, hostname]
  )

  // 移除仓库
  const removeRepo = useCallback(
    async (name: string) => {
      const newRepos = repos.filter((r) => r.name !== name)
      setRepos(newRepos)
      await ipc.invoke('github:saveLocalRepos', hostname, newRepos)
    },
    [repos, hostname]
  )

  // 获取仓库信息
  const getRepoInfo = useCallback(async (path: string): Promise<GitHubRepoInfo> => {
    const info = await ipc.invoke('git:getInfo', path)
    return info as GitHubRepoInfo
  }, [])

  // 初始加载
  useEffect(() => {
    if (hostname) {
      refresh()
    }
  }, [hostname, refresh])

  return {
    repos,
    loading,
    error,
    refresh,
    syncStatus,
    addRepo,
    removeRepo,
    getRepoInfo,
  }
}
