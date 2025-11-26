/**
 * Web Scraper Service
 * 提供网页抓取和内容提取功能
 */

import log from './logger'
import { readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type {
  CrawlConfig,
  CrawlRequest,
  CrawlResult,
  WebArchiveContent,
  CheckInRequest,
  CheckInResult,
} from '@shared/web-archive-types'

/**
 * 默认抓取配置
 */
const DEFAULT_CRAWL_CONFIG: CrawlConfig = {
  mode: 'metadata',
  timeout: 30000,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  followRedirects: true,
  maxRedirects: 5,
  extractImages: true,
  extractLinks: false,
}

/**
 * HTML 转文本（移除标签）
 */
function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 提取图片 URLs
 */
function extractImages(html: string, baseUrl: string): string[] {
  const images: string[] = []
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi
  let match

  while ((match = imgRegex.exec(html)) !== null) {
    try {
      const imgUrl = new URL(match[1], baseUrl).href
      images.push(imgUrl)
    } catch {
      // 忽略无效 URL
    }
  }

  return [...new Set(images)]
}

/**
 * 提取链接 URLs
 */
function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = []
  const linkRegex = /<a[^>]+href=["']([^"']+)["']/gi
  let match

  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const linkUrl = new URL(match[1], baseUrl).href
      links.push(linkUrl)
    } catch {
      // 忽略无效 URL
    }
  }

  return [...new Set(links)]
}

/**
 * 提取 Meta 标签内容
 */
function extractMeta(html: string, name: string): string | undefined {
  const patterns = [
    new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta\\s+content=["']([^"']+)["']\\s+name=["']${name}["']`, 'i'),
    new RegExp(`<meta\\s+property=["']og:${name}["']\\s+content=["']([^"']+)["']`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }

  return undefined
}

/**
 * 提取标题
 */
function extractTitle(html: string): string | undefined {
  // 优先使用 og:title
  const ogTitle = extractMeta(html, 'title')
  if (ogTitle) return ogTitle

  // 使用 <title> 标签
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch?.[1]) {
    return titleMatch[1].trim()
  }

  return undefined
}

/**
 * 应用自定义选择器（简化版本，仅支持基本标签匹配）
 */
function applySelectors(html: string, selectors: Record<string, string>): Record<string, string> {
  const results: Record<string, string> = {}

  for (const [key, selector] of Object.entries(selectors)) {
    // 简单的 CSS 选择器支持（仅标签名、类名、ID）
    let pattern: RegExp

    if (selector.startsWith('#')) {
      // ID 选择器
      const id = selector.slice(1)
      pattern = new RegExp(`<[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i')
    } else if (selector.startsWith('.')) {
      // 类选择器
      const className = selector.slice(1)
      pattern = new RegExp(`<[^>]+class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i')
    } else {
      // 标签选择器
      pattern = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'i')
    }

    const match = html.match(pattern)
    if (match?.[1]) {
      results[key] = htmlToText(match[1])
    }
  }

  return results
}

/**
 * 抓取网页内容
 */
export async function crawlWebPage(request: CrawlRequest): Promise<CrawlResult> {
  const startTime = Date.now()
  const config: CrawlConfig = { ...DEFAULT_CRAWL_CONFIG, ...request.config }

  try {
    log.info(`Starting web crawl: ${request.url}`)

    // 使用 fetch 抓取网页
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.timeout)

    const response = await fetch(request.url, {
      method: 'GET',
      headers: {
        'User-Agent': config.userAgent,
        ...config.headers,
      },
      redirect: config.followRedirects ? 'follow' : 'manual',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    const finalUrl = response.url

    // 根据模式提取内容
    const content: WebArchiveContent = {
      timestamp: Date.now(),
      size: html.length,
    }

    // 提取标题和描述（所有模式都提取）
    content.title = extractTitle(html)
    content.description = extractMeta(html, 'description')

    switch (config.mode) {
      case 'full':
        // 完整 HTML
        content.html = html
        content.text = htmlToText(html)
        if (config.extractImages) content.images = extractImages(html, finalUrl)
        if (config.extractLinks) content.links = extractLinks(html, finalUrl)
        break

      case 'metadata':
        // 仅元数据
        if (config.extractImages) content.images = extractImages(html, finalUrl)
        break

      case 'text':
        // 文本内容
        content.text = htmlToText(html)
        break

      case 'custom':
        // 自定义选择器
        if (config.selectors) {
          content.customFields = applySelectors(html, config.selectors)
        }
        break
    }

    const duration = Date.now() - startTime
    log.info(`Web crawl completed: ${request.url} (${duration}ms)`)

    return {
      success: true,
      content,
      duration,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Web crawl failed: ${request.url}`, error)

    return {
      success: false,
      error: errorMessage,
      duration,
    }
  }
}

/**
 * 批量抓取网页
 */
export async function crawlMultiplePages(
  requests: CrawlRequest[]
): Promise<Map<string, CrawlResult>> {
  const results = new Map<string, CrawlResult>()

  // 顺序抓取（避免同时发起大量请求）
  for (const request of requests) {
    const result = await crawlWebPage(request)
    results.set(request.url, result)

    // 请求间隔 500ms，避免被封禁
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  return results
}

/**
 * 执行签到脚本
 * 
 * 签到脚本格式说明：
 * - 脚本会在一个沙箱环境中执行
 * - 可以访问以下变量：
 *   - url: 目标网址
 *   - html: 网页 HTML 内容
 *   - fetch: 用于发起 HTTP 请求的函数
 * - 脚本必须返回一个对象：{ success: boolean, message?: string, data?: any }
 * 
 * 示例脚本：
 * ```javascript
 * // 简单的 POST 请求签到
 * const response = await fetch(url + '/checkin', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' }
 * });
 * const data = await response.json();
 * return { success: data.success, message: data.message, data };
 * ```
 */
export async function executeCheckIn(request: CheckInRequest): Promise<CheckInResult> {
  try {
    log.info(`Starting check-in: ${request.url}`)

    // 读取签到脚本文件
    let scriptContent = request.script
    if (!scriptContent) {
      return {
        success: false,
        error: '未提供签到脚本',
        timestamp: Date.now(),
      }
    }

    // 如果是文件路径，读取文件内容
    if (scriptContent.endsWith('.js')) {
      try {
        const appPath = app.getAppPath()
        const scriptsDir = join(appPath, 'scripts')
        const scriptPath = join(scriptsDir, scriptContent)
        scriptContent = readFileSync(scriptPath, 'utf-8')
        log.info(`Loaded check-in script from: ${scriptPath}`)
      } catch (error) {
        log.error(`Failed to load check-in script: ${scriptContent}`, error)
        return {
          success: false,
          error: `无法读取脚本文件: ${scriptContent}`,
          timestamp: Date.now(),
        }
      }
    }

    // 首先获取网页内容
    const config: CrawlConfig = { ...DEFAULT_CRAWL_CONFIG, ...request.config }
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.timeout)

    const response = await fetch(request.url, {
      method: 'GET',
      headers: {
        'User-Agent': config.userAgent,
        ...request.headers,
      },
      redirect: config.followRedirects ? 'follow' : 'manual',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    const finalUrl = response.url

    // 创建沙箱环境并执行签到脚本
    const scriptContext = {
      url: finalUrl,
      html: html,
      headers: request.headers || {},
      // 提供 fetch 函数供脚本使用
      fetch: async (url: string, options?: RequestInit) => {
        return await fetch(url, {
          ...options,
          headers: {
            'User-Agent': config.userAgent,
            ...request.headers,
            ...(options?.headers || {}),
          },
        })
      },
    }

    // 使用 AsyncFunction 执行脚本
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const scriptFunction = new AsyncFunction(
      'url',
      'html',
      'headers',
      'fetch',
      `
      'use strict';
      ${request.script}
      `
    )

    // 执行脚本
    const scriptResult = await scriptFunction(
      scriptContext.url,
      scriptContext.html,
      scriptContext.headers,
      scriptContext.fetch
    )

    // 验证返回结果
    if (!scriptResult || typeof scriptResult !== 'object') {
      throw new Error('签到脚本必须返回一个对象：{ success: boolean, message?: string, data?: any }')
    }

    if (typeof scriptResult.success !== 'boolean') {
      throw new Error('签到脚本返回的对象必须包含 success 字段（boolean 类型）')
    }

    const result: CheckInResult = {
      success: scriptResult.success,
      message: scriptResult.message,
      data: scriptResult.data,
      timestamp: Date.now(),
    }

    log.info(`Check-in completed: ${request.url}`, result)
    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Check-in failed: ${request.url}`, error)

    return {
      success: false,
      error: errorMessage,
      timestamp: Date.now(),
    }
  }
}
