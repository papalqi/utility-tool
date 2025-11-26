/**
 * 网页存档 Widget 的类型定义
 */

/**
 * 抓取状态
 */
export type CrawlStatus = 'idle' | 'crawling' | 'success' | 'error'

/**
 * 抓取模式
 */
export type CrawlMode = 'full' | 'metadata' | 'text' | 'custom'

/**
 * 网页存档配置项（存储在 config.toml 中的静态配置）
 */
export interface WebArchiveConfigItem {
  /** 唯一标识符 */
  id: string
  /** 网页 URL */
  url: string
  /** 网页标题 */
  title?: string
  /** 描述或备注 */
  description?: string
  /** 标签 */
  tags?: string[]
  /** 抓取模式 */
  crawlMode: CrawlMode
  /** 是否启用自动抓取 */
  autoRefresh: boolean
  /** 自动抓取间隔（分钟） */
  refreshInterval: number
  /** 自定义 HTTP Headers（用于身份验证） */
  headers?: Record<string, string>
  /** 签到脚本路径（相对于 scripts/ 目录） */
  checkInScriptPath?: string
  /** 是否启用自动签到 */
  autoCheckIn?: boolean
  /** 创建时间 */
  createdAt: number
}

/**
 * 网页存档运行时数据（存储在 localStorage 中）
 */
export interface WebArchiveRuntimeData {
  /** 项目 ID */
  id: string
  /** 最后抓取时间 */
  lastCrawled?: number
  /** 抓取状态 */
  status: CrawlStatus
  /** 错误信息 */
  error?: string
  /** 抓取的内容 */
  content?: WebArchiveContent
  /** 最后签到时间 */
  lastCheckIn?: number
  /** 签到结果 */
  checkInResult?: CheckInResult
  /** 更新时间 */
  updatedAt: number
}

/**
 * 网页存档完整项（配置 + 运行时数据的合并视图）
 */
export interface WebArchiveItem extends WebArchiveConfigItem {
  /** 最后抓取时间 */
  lastCrawled?: number
  /** 抓取状态 */
  status: CrawlStatus
  /** 错误信息 */
  error?: string
  /** 抓取的内容 */
  content?: WebArchiveContent
  /** 最后签到时间 */
  lastCheckIn?: number
  /** 签到结果 */
  checkInResult?: CheckInResult
  /** 更新时间 */
  updatedAt: number
}

/**
 * 网页抓取内容
 */
export interface WebArchiveContent {
  /** 原始 HTML */
  html?: string
  /** 提取的文本内容 */
  text?: string
  /** 网页标题 */
  title?: string
  /** Meta 描述 */
  description?: string
  /** 图片 URLs */
  images?: string[]
  /** 链接 URLs */
  links?: string[]
  /** 自定义字段（CSS 选择器提取） */
  customFields?: Record<string, string>
  /** 抓取时间戳 */
  timestamp: number
  /** 内容大小（bytes） */
  size: number
}

/**
 * 抓取配置
 */
export interface CrawlConfig {
  /** 抓取模式 */
  mode: CrawlMode
  /** 请求超时（毫秒） */
  timeout: number
  /** User-Agent */
  userAgent: string
  /** 自定义 Headers */
  headers?: Record<string, string>
  /** 自定义 CSS 选择器（用于 custom 模式） */
  selectors?: Record<string, string>
  /** 是否跟随重定向 */
  followRedirects: boolean
  /** 最大重定向次数 */
  maxRedirects: number
  /** 是否提取图片 */
  extractImages: boolean
  /** 是否提取链接 */
  extractLinks: boolean
}

/**
 * 抓取请求
 */
export interface CrawlRequest {
  /** 目标 URL */
  url: string
  /** 抓取配置 */
  config?: Partial<CrawlConfig>
}

/**
 * 抓取结果
 */
export interface CrawlResult {
  /** 是否成功 */
  success: boolean
  /** 抓取的内容 */
  content?: WebArchiveContent
  /** 错误信息 */
  error?: string
  /** 抓取耗时（毫秒） */
  duration: number
}

/**
 * WebArchive Widget 配置（存储在 config.toml 中）
 */
export interface WebArchiveConfig {
  /** 网址列表 */
  items: WebArchiveConfigItem[]
}

/**
 * 定时任务配置
 */
export interface ScheduledTask {
  /** 任务 ID */
  id: string
  /** 关联的存档项 ID */
  archiveId: string
  /** 是否启用 */
  enabled: boolean
  /** 间隔（分钟） */
  interval: number
  /** 下次执行时间 */
  nextRunAt: number
  /** 最后执行时间 */
  lastRunAt?: number
}

/**
 * 签到结果
 */
export interface CheckInResult {
  /** 是否成功 */
  success: boolean
  /** 签到消息 */
  message?: string
  /** 签到数据（由脚本返回） */
  data?: unknown
  /** 执行时间戳 */
  timestamp: number
  /** 错误信息 */
  error?: string
}

/**
 * 签到请求
 */
export interface CheckInRequest {
  /** 目标 URL */
  url: string
  /** 签到脚本 */
  script: string
  /** 自定义 Headers */
  headers?: Record<string, string>
  /** 抓取配置 */
  config?: Partial<CrawlConfig>
}
