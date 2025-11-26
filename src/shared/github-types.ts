/**
 * GitHub Widget 类型定义
 */

/**
 * 本地仓库配置
 * 存储在 Obsidian: github-repos.md
 */
export interface LocalRepository {
  id: string // 唯一标识
  name: string // 仓库名称
  path: string // 本地路径
  remoteUrl?: string // Git 远程地址
  branch?: string // 当前分支
  description?: string // 描述
  tags?: string[] // 标签分类
  lastOpened?: number // 最后打开时间（时间戳）
  favorite?: boolean // 是否收藏
}

/**
 * GitHub 仓库信息（从 API 获取）
 */
export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  description: string | null
  clone_url: string
  ssh_url: string
  html_url: string
  private: boolean
  language: string | null
  stargazers_count: number
  updated_at: string
  pushed_at: string | null
  owner: {
    login: string
    avatar_url: string
  }
}

/**
 * Git 仓库状态
 */
export interface GitStatus {
  branch: string // 当前分支
  ahead: number // 领先远程多少提交
  behind: number // 落后远程多少提交
  modified: number // 修改的文件数
  created: number // 新增的文件数
  deleted: number // 删除的文件数
  renamed: number // 重命名的文件数
  conflicted: number // 冲突的文件数
}

/**
 * GitHub Token 配置
 * 存储在 Obsidian: secrets.md
 */
export interface GitHubConfig {
  token?: string // Personal Access Token
  username?: string // GitHub 用户名
  defaultClonePath?: string // 默认克隆路径
  cloneWithSSH?: boolean // 是否使用 SSH 克隆
}

/**
 * 仓库筛选选项
 */
export interface RepositoryFilter {
  searchText?: string // 搜索文本
  language?: string // 编程语言
  type?: 'all' | 'public' | 'private' // 仓库类型
  favoriteOnly?: boolean // 仅显示收藏
  tags?: string[] // 标签筛选
}

/**
 * 仓库排序选项
 */
export type RepositorySortBy = 'name' | 'updated' | 'stars' | 'lastOpened'

/**
 * 克隆选项
 */
export interface CloneOptions {
  targetPath: string // 目标路径
  useSSH: boolean // 是否使用 SSH
  shallow?: boolean // 是否浅克隆
  branch?: string // 指定分支
}
