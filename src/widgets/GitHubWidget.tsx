/**
 * GitHub Widget - GitHub 仓库管理
 *
 * 功能：
 * 1. GitHub Token 配置（存储到 Obsidian secrets）
 * 2. 本地仓库管理（添加、删除、打开、查看状态）
 * 3. 远程仓库浏览和克隆
 */

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  App,
  Tabs,
  Button,
  Input,
  Tag,
  Space,
  Empty,
  Modal,
  Form,
  Select,
  Alert,
  Tooltip,
  Typography,
  Spin,
  Dropdown,
  Card,
  Row,
  Col,
  Avatar,
} from 'antd'
import type { MenuProps } from 'antd'
import {
  GithubOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  DeleteOutlined,
  FolderOutlined,
  StarOutlined,
  StarFilled,
  ReloadOutlined,
  DownloadOutlined,
  LinkOutlined,
  BranchesOutlined,
  SettingOutlined,
  MoreOutlined,
  GlobalOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'
import type { WidgetMetadata } from '@/shared/widget-types'
import type { LocalRepository, GitHubRepository } from '@/shared/github-types'
import { useWidget } from '@/hooks/useWidget'
import { useWidgetStorage } from '@/hooks/useWidgetStorage'
import { WidgetLayout, WidgetSection } from '@/components/widgets'
import { useObsidian } from '@/hooks/useObsidian'

const { Text, Paragraph } = Typography
const { Search } = Input

// Metadata
const metadata: WidgetMetadata = {
  id: 'github',
  displayName: 'GitHub 管理',
  icon: <GithubOutlined />,
  description: '管理 GitHub 仓库，克隆远程仓库，管理本地仓库集合',
  category: 'tools',
  order: 9,
  enabled: true,
}

type GitHubTokenVerifyResult = {
  success: boolean
  username?: string
  error?: string
}

type GitCloneResult = {
  success: boolean
  error?: string
}

type GitInfoResult = {
  remoteUrl?: string
  branch?: string
}

type GitAction = 'status' | 'pull' | 'push' | 'fetch'

type FavoriteEntry = {
  remoteUrl: string
  fullName: string
  htmlUrl: string
  repo?: GitHubRepository
}

type CloneRequest = {
  cloneUrl: string
  repoName?: string
  description?: string
}

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
  if (!slug) {
    return 'repository'
  }
  const parts = slug.split('/')
  return parts[parts.length - 1] || slug
}

const getRepoHtmlUrlFromRemote = (remoteUrl: string) => {
  const normalized = normalizeGitRemote(remoteUrl).replace(/\.git$/i, '')
  if (!normalized) return 'https://github.com'
  if (normalized.startsWith('http')) {
    return normalized
  }
  const slug = getRepoSlugFromRemote(normalized)
  return slug ? `https://github.com/${slug.replace(/^\/+/, '')}` : 'https://github.com'
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

const GitHubWidget = () => {
  const { message, modal } = App.useApp()
  const { colors } = useTheme()
  const { state, widgetLogger } = useWidget({
    metadata,
    lifecycle: {
      onInit: async () => {
        widgetLogger.info('GitHub Widget initialized')
        await loadLocalRepositories()
        await loadGitHubToken()
        await loadFavoriteRemotes()
      },
    },
  })

  const { isEnabled: obsidianEnabled, readSecrets, updateSecret } = useObsidian()

  // ========== 状态管理 ==========
  const [activeTab, setActiveTab] = useState<'local' | 'remote' | 'favorites'>('local')
  const [githubToken, setGitHubToken] = useState<string>('')
  const [tokenVerified, setTokenVerified] = useState(false)
  const [localRepos, setLocalRepos] = useState<LocalRepository[]>([])
  const [remoteRepos, setRemoteRepos] = useState<GitHubRepository[]>([])
  const [favoriteRemotes, setFavoriteRemotes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [newFavoriteUrl, setNewFavoriteUrl] = useState('')
  const [searchText, setSearchText] = useState('')
  const [tokenModalVisible, setTokenModalVisible] = useState(false)
  const [addRepoModalVisible, setAddRepoModalVisible] = useState(false)
  const [hostname, setHostname] = useState('')
  const [gitActionState, setGitActionState] = useState<{
    repoId: string
    action: GitAction
  } | null>(null)

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

  const remoteRepoMap = useMemo(() => {
    const map = new Map<string, GitHubRepository>()
    remoteRepos.forEach((repo) => {
      const normalized = normalizeGitRemote(repo.clone_url)
      if (normalized && !map.has(normalized)) {
        map.set(normalized, repo)
      }
    })
    return map
  }, [remoteRepos])

  const [tokenForm] = Form.useForm()
  const [addRepoForm] = Form.useForm()

  // 使用 localStorage 存储 UI 状态
  const { value: uiState } = useWidgetStorage({
    key: 'github-ui-state',
    defaultValue: { sortBy: 'name', favoriteOnly: false },
  })

  useEffect(() => {
    const initHostname = async () => {
      try {
        const current = await window.electronAPI.getHostname()
        setHostname(current)
      } catch (error) {
        widgetLogger.error('Failed to load hostname', error as Error)
      }
    }
    initHostname()
  }, [widgetLogger])

  const resolveHostname = async () => {
    if (hostname) {
      return hostname
    }
    const current = await window.electronAPI.getHostname()
    setHostname(current)
    return current
  }

  // ========== Obsidian 数据操作 ==========

  /**
   * 从 Obsidian secrets 加载 GitHub Token
   */
  const loadGitHubToken = async () => {
    if (!obsidianEnabled) {
      widgetLogger.warn('Obsidian not enabled, cannot load GitHub token')
      return
    }

    try {
      const secrets = await readSecrets()
      const token = secrets?.github_token || ''
      setGitHubToken(token)
      if (token) {
        setTokenVerified(true)
      }
      widgetLogger.info('GitHub token loaded', { hasToken: !!token })
    } catch (error) {
      widgetLogger.error('Failed to load GitHub token', error as Error)
    }
  }

  /**
   * 保存 GitHub Token 到 Obsidian secrets（只更新 github_token，不覆盖其他 secrets）
   */
  const saveGitHubToken = async (token: string) => {
    if (!obsidianEnabled) {
      message.warning('Obsidian 未启用，Token 仅在当前会话有效')
      setGitHubToken(token)
      return
    }

    try {
      // 使用 updateSecret 只更新 github_token，不覆盖其他内容
      const success = await updateSecret('github_token', token)
      if (success) {
        setGitHubToken(token)
        message.success('GitHub Token 已保存到 Obsidian')
        widgetLogger.info('GitHub token saved')
      } else {
        throw new Error('updateSecret returned false')
      }
    } catch (error) {
      message.error('保存 Token 失败')
      widgetLogger.error('Failed to save GitHub token', error as Error)
      throw error
    }
  }

  /**
   * 从 Obsidian 加载本地仓库列表
   */
  const loadLocalRepositories = async () => {
    if (!obsidianEnabled) {
      setLocalRepos([])
      return
    }

    try {
      const currentHostname = await resolveHostname()
      if (!currentHostname) {
        widgetLogger.warn('Hostname not resolved, skip loading local repositories')
        return
      }
      const repos = (await window.electronAPI.invoke(
        'github:loadLocalRepos',
        currentHostname
      )) as unknown

      const repoList = Array.isArray(repos) ? (repos as LocalRepository[]) : []
      setLocalRepos(repoList)
      widgetLogger.info('Local repositories loaded', {
        count: repoList.length,
        hostname: currentHostname,
      })
    } catch (error) {
      widgetLogger.error('Failed to load local repositories', error as Error)
      setLocalRepos([])
    }
  }

  /**
   * 保存本地仓库列表到 Obsidian
   */
  const saveLocalRepositories = async (repos: LocalRepository[]) => {
    if (!obsidianEnabled) {
      message.warning('Obsidian 未启用，仓库列表仅在当前会话有效')
      setLocalRepos(repos)
      return
    }

    try {
      const currentHostname = await resolveHostname()
      if (!currentHostname) {
        message.error('未能获取当前计算机名称，无法保存仓库列表')
        return
      }
      await window.electronAPI.invoke('github:saveLocalRepos', currentHostname, repos)
      setLocalRepos(repos)
      widgetLogger.info('Local repositories saved', {
        count: repos.length,
        hostname: currentHostname,
      })
    } catch (error) {
      message.error('保存仓库列表失败')
      widgetLogger.error('Failed to save local repositories', error as Error)
      throw error
    }
  }

  /**
   * 加载收藏的远程仓库
   */
  const loadFavoriteRemotes = useCallback(async () => {
    if (!obsidianEnabled) {
      setFavoriteRemotes([])
      return
    }

    try {
      const favorites = (await window.electronAPI.invoke('github:loadFavorites')) as unknown
      const list = Array.isArray(favorites)
        ? (favorites as unknown[])
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter(Boolean)
        : []
      const deduped = dedupeFavoriteUrls(list)
      setFavoriteRemotes(deduped)
      widgetLogger.info('Favorite repositories loaded', { count: deduped.length })
    } catch (error) {
      widgetLogger.error('Failed to load favorite repositories', error as Error)
      setFavoriteRemotes([])
    }
  }, [obsidianEnabled, widgetLogger])

  /**
   * 保存收藏的远程仓库
   */
  const saveFavoriteRemotes = useCallback(
    async (favorites: string[]) => {
      const unique = dedupeFavoriteUrls(favorites)

      if (!obsidianEnabled) {
        if (unique.length > 0) {
          message.warning('Obsidian 未启用，收藏仅在当前会话有效')
        }
        setFavoriteRemotes(unique)
        return
      }

      try {
        await window.electronAPI.invoke('github:saveFavorites', unique)
        setFavoriteRemotes(unique)
        widgetLogger.info('Favorite repositories saved', { count: unique.length })
      } catch (error) {
        widgetLogger.error('Failed to save favorite repositories', error as Error)
        message.error('保存收藏失败')
        throw error
      }
    },
    [message, obsidianEnabled, widgetLogger]
  )

  useEffect(() => {
    if (obsidianEnabled) {
      loadFavoriteRemotes()
    } else {
      setFavoriteRemotes([])
    }
  }, [loadFavoriteRemotes, obsidianEnabled])

  // ========== 本地仓库操作 ==========

  /**
   * 添加本地仓库
   */
  const handleAddLocalRepo = async () => {
    try {
      const values = await addRepoForm.validateFields()
      const path = values.path.trim()

      // 检查路径是否已存在
      if (localRepos.some((repo) => repo.path === path)) {
        message.warning('该路径已存在于列表中')
        return
      }

      // 尝试检测 Git 信息
      let gitInfo: GitInfoResult = {}
      try {
        gitInfo = ((await window.electronAPI.invoke('git:getInfo', path)) as GitInfoResult) || {}
      } catch (error) {
        widgetLogger.warn('Failed to detect git info', { path, error })
      }

      const newRepo: LocalRepository = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: values.name || path.split('/').pop() || 'Unknown',
        path,
        remoteUrl: gitInfo.remoteUrl,
        branch: gitInfo.branch,
        description: values.description,
        tags: values.tags || [],
        lastOpened: Date.now(),
      }

      await saveLocalRepositories([...localRepos, newRepo])
      message.success('仓库已添加')
      setAddRepoModalVisible(false)
      addRepoForm.resetFields()
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return
      }
      const errorMessage = error instanceof Error ? error.message : String(error)
      message.error(`添加仓库失败：${errorMessage}`)
    }
  }

  /**
   * 删除本地仓库
   */
  const handleDeleteLocalRepo = (repo: LocalRepository) => {
    modal.confirm({
      title: `确定要从列表中移除仓库「${repo.name}」？`,
      content: '这不会删除本地文件，仅从列表中移除',
      okText: '移除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        const newRepos = localRepos.filter((r) => r.id !== repo.id)
        await saveLocalRepositories(newRepos)
        message.success('仓库已移除')
      },
    })
  }

  /**
   * 打开仓库目录
   */
  const handleOpenRepoDir = async (repo: LocalRepository) => {
    try {
      await window.electronAPI.invoke('shell:openPath', repo.path)

      // 更新最后打开时间
      const updatedRepos = localRepos.map((r) =>
        r.id === repo.id ? { ...r, lastOpened: Date.now() } : r
      )
      await saveLocalRepositories(updatedRepos)
    } catch (error) {
      message.error('打开目录失败')
      widgetLogger.error('Failed to open repo directory', error as Error)
    }
  }

  /**
   * 切换本地仓库收藏（基于远程地址）
   */
  const handleToggleLocalFavorite = async (repo: LocalRepository) => {
    if (!repo.remoteUrl) {
      message.warning('该仓库没有远程地址，无法收藏')
      return
    }
    await handleToggleRemoteFavorite(repo.remoteUrl, repo.name)
  }

  /**
   * 选择目录
   */
  const handleSelectDirectory = async () => {
    try {
      const path = await window.electronAPI.selectFolder({
        title: '选择仓库目录',
        properties: ['openDirectory'],
      })
      if (path) {
        addRepoForm.setFieldsValue({ path })
      }
    } catch (error) {
      message.error('选择目录失败')
    }
  }

  /**
   * Git 操作集合
   */
  const handleGitAction = async (repo: LocalRepository, action: GitAction) => {
    if (!repo.path) {
      message.error('该仓库缺少路径信息')
      return
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
          return
      }

      const output = (await window.electronAPI.invoke(
        'git:execCommand',
        repo.path,
        command
      )) as string

      if (action === 'status') {
        modal.info({
          title: `${repo.name} - Git 状态`,
          content: (
            <pre style={{ maxHeight: 300, overflow: 'auto', marginBottom: 0 }}>{output}</pre>
          ),
          width: 520,
        })
      } else {
        message.success(successMessage || '操作成功')
        if (output?.trim()) {
          widgetLogger.info('Git action output', { action, repo: repo.name, output })
        }
        await loadLocalRepositories()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      message.error(`Git 操作失败：${errorMessage}`)
      widgetLogger.error('Git action failed', { action, repo: repo.name, error })
    } finally {
      setGitActionState(null)
    }
  }

  // ========== GitHub API 操作 ==========

  /**
   * 验证 GitHub Token
   */
  const handleVerifyToken = async (token: string) => {
    setLoading(true)
    try {
      const result = (await window.electronAPI.invoke(
        'github:verifyToken',
        token
      )) as GitHubTokenVerifyResult
      if (result.success) {
        setTokenVerified(true)
        await saveGitHubToken(token)
        message.success(`Token 验证成功！用户：${result.username}`)
        setTokenModalVisible(false)
        return true
      } else {
        message.error('Token 验证失败，请检查 Token 是否正确')
        return false
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      message.error(`验证失败：${errorMessage}`)
      widgetLogger.error('Token verification failed', error)
      return false
    } finally {
      setLoading(false)
    }
  }

  /**
   * 加载远程仓库列表
   */
  const handleLoadRemoteRepos = async () => {
    if (!tokenVerified || !githubToken) {
      message.warning('请先配置并验证 GitHub Token')
      setTokenModalVisible(true)
      return
    }

    setLoading(true)
    try {
      const repos = (await window.electronAPI.invoke('github:listRepos', githubToken)) as unknown
      const repoList = Array.isArray(repos) ? (repos as GitHubRepository[]) : []
      setRemoteRepos(repoList)
      message.success(`加载了 ${repoList.length} 个仓库`)
      widgetLogger.info('Remote repositories loaded', { count: repoList.length })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      message.error(`加载仓库失败：${errorMessage}`)
      widgetLogger.error('Failed to load remote repositories', error)
    } finally {
      setLoading(false)
    }
  }

  /**
   * 执行克隆逻辑
   */
  const cloneRepositoryToLocal = async ({ cloneUrl, repoName, description }: CloneRequest) => {
    const url = cloneUrl?.trim()
    if (!url) {
      message.error('缺少远程仓库地址')
      return
    }

    try {
      const targetDir = await window.electronAPI.selectFolder({
        title: '选择克隆目标目录',
        properties: ['openDirectory', 'createDirectory'],
      })

      if (!targetDir) {
        return
      }

      const safeName = repoName?.trim() || getRepoNameFromRemote(url)
      const clonePath = `${targetDir}/${safeName}`

      setLoading(true)
      message.loading({ content: `正在克隆 ${safeName}...`, key: 'clone', duration: 0 })

      const result = (await window.electronAPI.invoke('github:cloneRepo', {
        url,
        targetPath: clonePath,
      })) as GitCloneResult

      if (result?.success) {
        message.success({ content: '克隆成功！', key: 'clone' })

        const newRepo: LocalRepository = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: safeName,
          path: clonePath,
          remoteUrl: url,
          branch: 'main',
          description,
          lastOpened: Date.now(),
        }

        await saveLocalRepositories([...localRepos, newRepo])
        setActiveTab('local')
      } else {
        message.error({ content: `克隆失败：${result?.error || '未知错误'}`, key: 'clone' })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      message.error({ content: `克隆失败：${errorMessage}`, key: 'clone' })
      widgetLogger.error('Clone repository failed', error)
    } finally {
      setLoading(false)
    }
  }

  /**
   * 克隆远程仓库
   */
  const handleCloneRepo = async (repo: GitHubRepository) => {
    await cloneRepositoryToLocal({
      cloneUrl: repo.clone_url,
      repoName: repo.name,
      description: repo.description || undefined,
    })
  }

  /**
   * 从收藏记录克隆仓库
   */
  const handleCloneFavoriteRepo = async (remoteUrl: string) => {
    const normalized = normalizeGitRemote(remoteUrl)
    const repo = normalized ? remoteRepoMap.get(normalized) : undefined
    await cloneRepositoryToLocal({
      cloneUrl: repo?.clone_url || remoteUrl,
      repoName: repo?.name || getRepoNameFromRemote(remoteUrl),
      description: repo?.description || undefined,
    })
  }

  /**
   * 切换远程仓库收藏
   */
  const handleToggleRemoteFavorite = async (remoteUrl: string, label?: string) => {
    const normalized = normalizeGitRemote(remoteUrl)
    if (!normalized) {
      return
    }

    if (!normalized.includes('github.com')) {
      message.warning('目前仅支持收藏 GitHub 仓库')
      return
    }

    const exists = favoriteRemoteSet.has(normalized)
    const updated = exists
      ? favoriteRemotes.filter((url) => normalizeGitRemote(url) !== normalized)
      : [...favoriteRemotes, remoteUrl.trim()]

    try {
      await saveFavoriteRemotes(updated)
      const name = label || getRepoSlugFromRemote(normalized) || normalized
      message.success(`${exists ? '已取消收藏' : '已收藏'} ${name}`)
    } catch {
      // 错误提示在 saveFavoriteRemotes 中统一处理
    }
  }

  /**
   * 通过输入添加收藏仓库
   */
  const handleAddFavoriteUrl = async (value?: string) => {
    const target = (value ?? newFavoriteUrl).trim()
    if (!target) {
      message.warning('请输入 GitHub 仓库地址')
      return
    }

    const normalized = normalizeGitRemote(target)
    if (!normalized || !normalized.includes('github.com')) {
      message.warning('请输入有效的 GitHub 仓库地址')
      return
    }

    if (favoriteRemoteSet.has(normalized)) {
      message.info('该仓库已在收藏列表')
      setNewFavoriteUrl('')
      return
    }

    try {
      await saveFavoriteRemotes([...favoriteRemotes, target])
      message.success('收藏已添加')
      setNewFavoriteUrl('')
    } catch {
      // 错误提示在 saveFavoriteRemotes 中处理
    }
  }

  // ========== 筛选和排序 ==========

  const filteredLocalRepos = useMemo(() => {
    let filtered = [...localRepos]

    // 搜索过滤
    if (searchText) {
      filtered = filtered.filter(
        (repo) =>
          repo.name.toLowerCase().includes(searchText.toLowerCase()) ||
          repo.path.toLowerCase().includes(searchText.toLowerCase()) ||
          repo.description?.toLowerCase().includes(searchText.toLowerCase())
      )
    }

    // 收藏过滤
    if (uiState.favoriteOnly) {
      filtered = filtered.filter((repo) => {
        if (!repo.remoteUrl) return false
        return favoriteRemoteSet.has(normalizeGitRemote(repo.remoteUrl))
      })
    }

    // 排序
    filtered.sort((a, b) => {
      // 收藏的排在前面
      const aFavorited = a.remoteUrl
        ? favoriteRemoteSet.has(normalizeGitRemote(a.remoteUrl))
        : false
      const bFavorited = b.remoteUrl
        ? favoriteRemoteSet.has(normalizeGitRemote(b.remoteUrl))
        : false
      if (aFavorited && !bFavorited) return -1
      if (!aFavorited && bFavorited) return 1

      // 按指定字段排序
      switch (uiState.sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'lastOpened':
          return (b.lastOpened || 0) - (a.lastOpened || 0)
        default:
          return 0
      }
    })

    return filtered
  }, [localRepos, searchText, uiState, favoriteRemoteSet])

  const filteredRemoteRepos = useMemo(() => {
    if (!searchText) return remoteRepos

    return remoteRepos.filter(
      (repo) =>
        repo.name.toLowerCase().includes(searchText.toLowerCase()) ||
        repo.description?.toLowerCase().includes(searchText.toLowerCase()) ||
        repo.full_name.toLowerCase().includes(searchText.toLowerCase())
    )
  }, [remoteRepos, searchText])

  const favoriteEntries = useMemo<FavoriteEntry[]>(() => {
    return favoriteRemotes.map((remoteUrl) => {
      const normalized = normalizeGitRemote(remoteUrl)
      const repo = normalized ? remoteRepoMap.get(normalized) : undefined
      const fullName = repo?.full_name || getRepoSlugFromRemote(remoteUrl) || remoteUrl
      return {
        remoteUrl,
        repo,
        fullName,
        htmlUrl: repo?.html_url || getRepoHtmlUrlFromRemote(remoteUrl),
      }
    })
  }, [favoriteRemotes, remoteRepoMap])

  const filteredFavoriteEntries = useMemo(() => {
    if (!searchText) {
      return favoriteEntries
    }
    const query = searchText.toLowerCase()
    return favoriteEntries.filter(
      (entry) =>
        entry.fullName.toLowerCase().includes(query) ||
        entry.remoteUrl.toLowerCase().includes(query)
    )
  }, [favoriteEntries, searchText])

  const localEmptyDescription = useMemo(() => {
    if (searchText) {
      return '没有匹配的仓库'
    }
    if (!obsidianEnabled) {
      return 'Obsidian 未启用，无法加载已保存的本地仓库。'
    }
    if (!hostname) {
      return '正在读取当前计算机信息...'
    }
    return `Obsidian 中没有 ${hostname} 的仓库记录，可能保存在其他电脑。可使用「远程仓库」快速克隆。`
  }, [searchText, obsidianEnabled, hostname])

  const gitMenuItems: MenuProps['items'] = [
    { key: 'status', label: '查看状态' },
    { key: 'pull', label: '拉取 (git pull)' },
    { key: 'fetch', label: '更新引用 (git fetch)' },
    { key: 'push', label: '推送 (git push)' },
  ]

  // ========== Card Components ==========

  const LocalRepoCard = ({ repo }: { repo: LocalRepository }) => {
    const normalizedRemote = repo.remoteUrl ? normalizeGitRemote(repo.remoteUrl) : ''
    const repoFavorited = normalizedRemote && favoriteRemoteSet.has(normalizedRemote)

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        style={{ height: '100%' }}
      >
        <Card
          size="small"
          style={{
            height: '100%',
            borderRadius: 12,
            border: `1px solid ${colors.borderPrimary}`,
            background: colors.bgSecondary,
          }}
          styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column' } }}
          actions={[
            <Tooltip title={repoFavorited ? '取消收藏' : '收藏'} key="fav">
              <Button
                type="text"
                size="small"
                icon={
                  repoFavorited ? (
                    <StarFilled style={{ color: colors.starYellow }} />
                  ) : (
                    <StarOutlined />
                  )
                }
                onClick={() => handleToggleLocalFavorite(repo)}
              />
            </Tooltip>,
            <Tooltip title="打开文件夹" key="folder">
              <Button
                type="text"
                size="small"
                icon={<FolderOpenOutlined />}
                onClick={() => handleOpenRepoDir(repo)}
              />
            </Tooltip>,
            <Dropdown
              key="more"
              menu={{
                items: gitMenuItems,
                onClick: ({ key }) => handleGitAction(repo, key as GitAction),
              }}
            >
              <Tooltip title="Git 操作">
                <Button
                  type="text"
                  size="small"
                  icon={<MoreOutlined />}
                  loading={gitActionState?.repoId === repo.id}
                />
              </Tooltip>
            </Dropdown>,
            <Tooltip title="移除" key="remove">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteLocalRepo(repo)}
              />
            </Tooltip>,
          ]}
        >
          <Card.Meta
            avatar={
              <Avatar
                shape="square"
                icon={<GithubOutlined />}
                style={{ backgroundColor: colors.bgTertiary, color: colors.textPrimary }}
              />
            }
            title={
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Text strong ellipsis style={{ maxWidth: 140 }} title={repo.name}>
                  {repo.name}
                </Text>
                {repo.branch && (
                  <Tag icon={<BranchesOutlined />} color="blue" style={{ margin: 0, fontSize: 10 }}>
                    {repo.branch}
                  </Tag>
                )}
              </div>
            }
            description={
              <Space direction="vertical" size={0} style={{ width: '100%' }}>
                <Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: repo.path }}>
                  <FolderOutlined style={{ marginRight: 4 }} />
                  {repo.path}
                </Text>
                <Text
                  type="secondary"
                  style={{ fontSize: 12 }}
                  ellipsis={{ tooltip: repo.remoteUrl }}
                >
                  <GlobalOutlined style={{ marginRight: 4 }} />
                  {repo.remoteUrl ? getRepoSlugFromRemote(repo.remoteUrl) : 'No Remote'}
                </Text>
              </Space>
            }
          />
        </Card>
      </motion.div>
    )
  }

  const RemoteRepoCard = ({ repo }: { repo: GitHubRepository }) => {
    const normalizedRemote = normalizeGitRemote(repo.clone_url)
    const repoFavorited = favoriteRemoteSet.has(normalizedRemote)

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        style={{ height: '100%' }}
      >
        <Card
          size="small"
          style={{
            height: '100%',
            borderRadius: 12,
            border: `1px solid ${colors.borderPrimary}`,
            background: colors.bgSecondary,
          }}
          styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column' } }}
          actions={[
            <Tooltip title={repoFavorited ? '取消收藏' : '收藏'} key="fav">
              <Button
                type="text"
                size="small"
                icon={
                  repoFavorited ? (
                    <StarFilled style={{ color: colors.starYellow }} />
                  ) : (
                    <StarOutlined />
                  )
                }
                onClick={() => handleToggleRemoteFavorite(repo.clone_url, repo.name)}
              />
            </Tooltip>,
            <Tooltip title="在浏览器打开" key="browser">
              <Button
                type="text"
                size="small"
                icon={<LinkOutlined />}
                onClick={() => window.electronAPI.openExternal(repo.html_url)}
              />
            </Tooltip>,
            <Tooltip title="克隆到本地" key="clone">
              <Button
                type="text"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => handleCloneRepo(repo)}
              />
            </Tooltip>,
          ]}
        >
          <Card.Meta
            avatar={<Avatar src={repo.owner.avatar_url} icon={<GithubOutlined />} />}
            title={
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Text strong ellipsis style={{ maxWidth: 160 }} title={repo.full_name}>
                  {repo.name}
                </Text>
                <Space size={4}>
                  <StarOutlined style={{ fontSize: 12 }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {repo.stargazers_count}
                  </Text>
                </Space>
              </div>
            }
            description={
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text
                  type="secondary"
                  style={{ fontSize: 12 }}
                  ellipsis={{ tooltip: repo.description }}
                >
                  {repo.description || 'No description'}
                </Text>
                {repo.language && (
                  <Tag color="blue" style={{ margin: 0, alignSelf: 'flex-start' }}>
                    {repo.language}
                  </Tag>
                )}
              </Space>
            }
          />
        </Card>
      </motion.div>
    )
  }

  const FavoriteCard = ({ entry }: { entry: FavoriteEntry }) => {
    const normalizedRemote = normalizeGitRemote(entry.remoteUrl)
    const alreadyCloned = localRepos.some(
      (repo) =>
        repo.remoteUrl &&
        normalizedRemote &&
        normalizeGitRemote(repo.remoteUrl) === normalizedRemote
    )

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        style={{ height: '100%' }}
      >
        <Card
          size="small"
          style={{
            height: '100%',
            borderRadius: 12,
            border: `1px solid ${colors.borderPrimary}`,
            background: colors.bgSecondary,
          }}
          styles={{
            body: {
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              textAlign: 'center',
            },
          }}
          actions={[
            <Tooltip title="移除收藏" key="remove">
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => handleToggleRemoteFavorite(entry.remoteUrl, entry.fullName)}
              />
            </Tooltip>,
            <Tooltip title="在浏览器打开" key="browser">
              <Button
                type="text"
                size="small"
                icon={<LinkOutlined />}
                onClick={() => window.open(entry.htmlUrl, '_blank')}
              />
            </Tooltip>,
            <Tooltip title={alreadyCloned ? '本地已有副本' : '克隆仓库'} key="clone">
              <Button
                type="primary"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => handleCloneFavoriteRepo(entry.remoteUrl)}
                disabled={alreadyCloned}
              />
            </Tooltip>,
          ]}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 12 }}>
              <StarFilled style={{ color: colors.starYellow, fontSize: 24 }} />
            </div>
            <div style={{ marginBottom: 4 }}>
              <Text strong ellipsis style={{ maxWidth: '100%' }} title={entry.fullName}>
                {entry.fullName}
              </Text>
            </div>
            <div style={{ marginBottom: 8 }}>
              <Text
                type="secondary"
                style={{ fontSize: 12 }}
                ellipsis={{ tooltip: entry.remoteUrl }}
              >
                {entry.remoteUrl}
              </Text>
            </div>
            {entry.repo?.description && (
              <div style={{ marginBottom: 4 }}>
                <Text
                  type="secondary"
                  style={{ fontSize: 12 }}
                  ellipsis={{ tooltip: entry.repo.description }}
                >
                  {entry.repo.description}
                </Text>
              </div>
            )}
            {entry.repo?.language && (
              <div>
                <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>
                  {entry.repo.language}
                </Tag>
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    )
  }

  // ========== UI 渲染 ==========

  if (!obsidianEnabled) {
    return (
      <WidgetLayout title={metadata.displayName} icon={metadata.icon} loading={state.loading}>
        <Alert
          type="warning"
          message="需要启用 Obsidian"
          description="GitHub 仓库数据需要存储在 Obsidian Vault 中。请在设置中配置 Obsidian Vault 路径。"
          showIcon
        />
      </WidgetLayout>
    )
  }

  return (
    <>
      <WidgetLayout
        title={metadata.displayName}
        icon={metadata.icon}
        loading={state.loading}
        bordered
        extra={
          <Space>
            <Button
              icon={<SettingOutlined />}
              onClick={() => setTokenModalVisible(true)}
              type={tokenVerified ? 'default' : 'primary'}
            >
              {tokenVerified ? '已配置 Token' : '配置 Token'}
            </Button>
          </Space>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'local' | 'remote' | 'favorites')}
          items={[
            {
              key: 'local',
              label: (
                <span>
                  <FolderOutlined /> 本地仓库 ({localRepos.length})
                </span>
              ),
              children: (
                <WidgetSection
                  title="本地仓库"
                  icon={<FolderOutlined />}
                  extra={
                    <Space>
                      <Search
                        placeholder="搜索仓库..."
                        allowClear
                        style={{ width: 200 }}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                      />
                      <Button
                        icon={<PlusOutlined />}
                        type="primary"
                        onClick={() => setAddRepoModalVisible(true)}
                      >
                        添加仓库
                      </Button>
                      <Button icon={<ReloadOutlined />} onClick={() => loadLocalRepositories()}>
                        刷新
                      </Button>
                    </Space>
                  }
                >
                  <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                    {hostname
                      ? `当前主机：${hostname}。本地仓库记录会存储在 Obsidian，并按计算机隔离。其他电脑将看到「没有本地数据」，可通过远程仓库快速克隆。`
                      : '正在读取当前计算机名称，本地仓库将按照机器隔离存储。'}
                  </Paragraph>
                  {filteredLocalRepos.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={localEmptyDescription}>
                      {!searchText && (
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => setAddRepoModalVisible(true)}
                        >
                          添加第一个仓库
                        </Button>
                      )}
                    </Empty>
                  ) : (
                    <Row gutter={[16, 16]}>
                      {filteredLocalRepos.map((repo) => (
                        <Col xs={24} sm={12} md={8} lg={6} key={repo.id}>
                          <LocalRepoCard repo={repo} />
                        </Col>
                      ))}
                    </Row>
                  )}
                </WidgetSection>
              ),
            },
            {
              key: 'remote',
              label: (
                <span>
                  <GithubOutlined /> 远程仓库 ({remoteRepos.length})
                </span>
              ),
              children: (
                <WidgetSection
                  title="GitHub 仓库"
                  icon={<GithubOutlined />}
                  extra={
                    <Space>
                      <Search
                        placeholder="搜索仓库..."
                        allowClear
                        style={{ width: 200 }}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                      />
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={handleLoadRemoteRepos}
                        loading={loading}
                        disabled={!tokenVerified}
                      >
                        {remoteRepos.length > 0 ? '刷新' : '加载仓库'}
                      </Button>
                    </Space>
                  }
                >
                  <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                    远程仓库列表来自您的 GitHub 账户，可在其他电脑上快速克隆并与 Obsidian
                    中的本地记录保持同步。
                  </Paragraph>
                  {!tokenVerified ? (
                    <Alert
                      type="info"
                      message="需要配置 GitHub Token"
                      description="请先配置 GitHub Personal Access Token 以访问您的仓库"
                      showIcon
                      action={
                        <Button type="primary" onClick={() => setTokenModalVisible(true)}>
                          配置 Token
                        </Button>
                      }
                    />
                  ) : remoteRepos.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="点击「加载仓库」按钮获取您的 GitHub 仓库列表"
                    >
                      <Button
                        type="primary"
                        icon={<ReloadOutlined />}
                        onClick={handleLoadRemoteRepos}
                        loading={loading}
                      >
                        加载仓库
                      </Button>
                    </Empty>
                  ) : (
                    <Spin spinning={loading}>
                      <Row gutter={[16, 16]}>
                        {filteredRemoteRepos.map((repo) => (
                          <Col xs={24} sm={12} md={8} lg={6} key={repo.id}>
                            <RemoteRepoCard repo={repo} />
                          </Col>
                        ))}
                      </Row>
                    </Spin>
                  )}
                </WidgetSection>
              ),
            },
            {
              key: 'favorites',
              label: (
                <span>
                  <StarOutlined /> 收藏 ({favoriteRemotes.length})
                </span>
              ),
              children: (
                <WidgetSection
                  title="收藏仓库"
                  icon={<StarOutlined />}
                  extra={
                    <Space wrap>
                      <Search
                        placeholder="搜索收藏..."
                        allowClear
                        style={{ width: 200 }}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                      />
                      <Search
                        placeholder="粘贴 GitHub 仓库地址"
                        allowClear
                        style={{ width: 320 }}
                        enterButton="添加收藏"
                        value={newFavoriteUrl}
                        onChange={(e) => setNewFavoriteUrl(e.target.value)}
                        onSearch={(value) => handleAddFavoriteUrl(value)}
                      />
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={loadFavoriteRemotes}
                        loading={loading}
                      >
                        刷新
                      </Button>
                    </Space>
                  }
                >
                  <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                    收藏列表只记录远程路径，可在任意设备快速打开浏览或克隆。
                  </Paragraph>
                  {favoriteRemotes.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无收藏记录">
                      <Button
                        type="primary"
                        icon={<StarOutlined />}
                        onClick={() => setActiveTab('remote')}
                      >
                        前往远程仓库收藏
                      </Button>
                    </Empty>
                  ) : filteredFavoriteEntries.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的收藏" />
                  ) : (
                    <Row gutter={[16, 16]}>
                      {filteredFavoriteEntries.map((entry) => (
                        <Col xs={24} sm={12} md={8} lg={6} key={entry.remoteUrl}>
                          <FavoriteCard entry={entry} />
                        </Col>
                      ))}
                    </Row>
                  )}
                </WidgetSection>
              ),
            },
          ]}
        />
      </WidgetLayout>

      {/* Token 配置 Modal */}
      <Modal
        title="配置 GitHub Token"
        open={tokenModalVisible}
        onCancel={() => setTokenModalVisible(false)}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={tokenForm}
          layout="vertical"
          initialValues={{ token: githubToken }}
          onFinish={async (values) => {
            await handleVerifyToken(values.token)
          }}
        >
          <Alert
            type="info"
            message="如何创建 GitHub Personal Access Token？"
            description={
              <ol style={{ paddingLeft: 20, marginTop: 8 }}>
                <li>访问 GitHub Settings → Developer settings → Personal access tokens</li>
                <li>点击 &quot;Generate new token (classic)&quot;</li>
                <li>选择权限：repo (完整访问)</li>
                <li>生成并复制 Token</li>
              </ol>
            }
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            label="Personal Access Token"
            name="token"
            rules={[{ required: true, message: '请输入 Token' }]}
          >
            <Input.Password placeholder="ghp_..." />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setTokenModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                验证并保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加仓库 Modal */}
      <Modal
        title="添加本地仓库"
        open={addRepoModalVisible}
        onCancel={() => {
          setAddRepoModalVisible(false)
          addRepoForm.resetFields()
        }}
        onOk={handleAddLocalRepo}
        confirmLoading={loading}
      >
        <Form form={addRepoForm} layout="vertical">
          <Form.Item
            label="仓库路径"
            name="path"
            rules={[{ required: true, message: '请选择仓库路径' }]}
          >
            <Space.Compact style={{ width: '100%' }}>
              <Input placeholder="ѡ��ֿ�����Ŀ¼" />
              <Button type="default" icon={<FolderOpenOutlined />} onClick={handleSelectDirectory}>
                ���
              </Button>
            </Space.Compact>
          </Form.Item>

          <Form.Item label="仓库名称" name="name">
            <Input placeholder="留空则使用目录名" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>

          <Form.Item label="标签" name="tags">
            <Select mode="tags" placeholder="添加标签，如：work, personal" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default GitHubWidget
