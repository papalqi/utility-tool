/**
 * Auth Window Manager - 身份验证窗口管理
 * 
 * 功能：
 * 1. 打开独立的登录窗口
 * 2. 用户完成登录后自动捕获 Cookie
 * 3. 支持手动确认和自动检测
 */

import { BrowserWindow, ipcMain } from 'electron'
import type { Cookie } from 'electron'

export interface AuthWindowOptions {
  url: string
  width?: number
  height?: number
  title?: string
  autoDetect?: boolean
}

export interface AuthResult {
  success: boolean
  cookies?: string
  error?: string
  metadata?: {
    cookieCount: number
    domain: string
  }
}

/**
 * 打开登录窗口并获取 Cookie
 */
export async function openAuthWindow(options: AuthWindowOptions): Promise<AuthResult> {
  const {
    url,
    width = 500,
    height = 700,
    title = '登录获取 Cookie',
    autoDetect = false,
  } = options

  return new Promise((resolve, reject) => {
    let authWindow: BrowserWindow | null = null
    let initialCookieCount = 0
    const domain = extractDomain(url)
    const sessionPartition = `persist:auth-${Date.now()}`

    try {
      // 创建独立的登录窗口
      authWindow = new BrowserWindow({
        width,
        height,
        title,
        modal: false,
        center: true,
        autoHideMenuBar: true,
        webPreferences: {
          partition: sessionPartition,
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: true,
          allowRunningInsecureContent: false,
        },
      })

      const windowSession = authWindow.webContents.session

      // 获取初始 Cookie 数量
      windowSession.cookies.get({ domain }).then((cookies) => {
        initialCookieCount = cookies.length
      })

      // 加载登录页面
      authWindow.loadURL(url)

      // 注入确认按钮和通信脚本
      authWindow.webContents.on('did-finish-load', () => {
        if (!authWindow) return

        authWindow.webContents.executeJavaScript(`
          (function() {
            // 防止重复注入
            if (document.getElementById('auth-confirm-btn')) return;
            
            // 创建确认按钮
            const btn = document.createElement('button');
            btn.id = 'auth-confirm-btn';
            btn.textContent = '✓ 登录完成';
            btn.style.cssText = \`
              position: fixed;
              top: 10px;
              right: 10px;
              z-index: 999999;
              padding: 8px 16px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
              transition: all 0.3s ease;
            \`;
            
            btn.onmouseover = () => {
              btn.style.transform = 'translateY(-2px)';
              btn.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.6)';
            };
            
            btn.onmouseout = () => {
              btn.style.transform = 'translateY(0)';
              btn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
            };
            
            btn.onclick = () => {
              btn.textContent = '✓ 获取中...';
              btn.disabled = true;
              btn.style.opacity = '0.6';
              // 设置标记，主进程会轮询检测
              window.__AUTH_CONFIRMED__ = true;
            };
            
            document.body.appendChild(btn);
          })();
        `)
      })

      // 轮询检测用户是否点击了确认按钮
      const checkConfirmInterval = setInterval(async () => {
        if (!authWindow || authWindow.isDestroyed()) {
          clearInterval(checkConfirmInterval)
          return
        }

        try {
          const confirmed = await authWindow.webContents.executeJavaScript(
            'window.__AUTH_CONFIRMED__ === true'
          )

          if (confirmed) {
            clearInterval(checkConfirmInterval)
            if (checkCookieInterval) clearInterval(checkCookieInterval)
            const result = await captureAndCloserWindow(authWindow, windowSession, domain)
            resolve(result)
          }
        } catch (error) {
          // 窗口可能已关闭，忽略错误
          clearInterval(checkConfirmInterval)
        }
      }, 500) // 每 500ms 检查一次

      // 自动检测登录成功（可选）
      let checkCookieInterval: NodeJS.Timeout | null = null
      if (autoDetect) {
        let autoDetectResolved = false

        authWindow.webContents.on('did-navigate', async (_event, navUrl) => {
          if (!authWindow || autoDetectResolved) return

          // 检测 URL 变化（常见的登录成功标志）
          const successPatterns = [
            '/home',
            '/dashboard',
            '/feed',
            '/timeline',
            '/profile',
            '/account',
          ]

          const isSuccess = successPatterns.some((pattern) => navUrl.includes(pattern))

          if (isSuccess) {
            autoDetectResolved = true
            clearInterval(checkConfirmInterval)
            if (checkCookieInterval) clearInterval(checkCookieInterval)
            // 延迟一下确保 Cookie 已设置
            setTimeout(async () => {
              if (!authWindow) return
              const result = await captureAndCloserWindow(authWindow, windowSession, domain)
              resolve(result)
            }, 1000)
          }
        })

        // 检测 Cookie 数量变化
        checkCookieInterval = setInterval(async () => {
          if (!authWindow || autoDetectResolved) {
            if (checkCookieInterval) clearInterval(checkCookieInterval)
            return
          }

          const currentCookies = await windowSession.cookies.get({ domain })
          if (currentCookies.length > initialCookieCount + 3) {
            autoDetectResolved = true
            clearInterval(checkConfirmInterval)
            if (checkCookieInterval) clearInterval(checkCookieInterval)
            setTimeout(async () => {
              if (!authWindow) return
              const result = await captureAndCloserWindow(authWindow, windowSession, domain)
              resolve(result)
            }, 2000)
          }
        }, 2000)

        // 清理定时器
        authWindow.on('closed', () => {
          if (checkCookieInterval) clearInterval(checkCookieInterval)
        })
      }

      // 窗口关闭处理
      authWindow.on('closed', () => {
        clearInterval(checkConfirmInterval)
        if (checkCookieInterval) clearInterval(checkCookieInterval)
        authWindow = null
        reject(new Error('用户取消登录'))
      })
    } catch (error) {
      if (authWindow && !authWindow.isDestroyed()) {
        authWindow.close()
      }
      reject(error)
    }
  })
}

/**
 * 捕获 Cookie 并关闭窗口
 */
async function captureAndCloserWindow(
  window: BrowserWindow,
  windowSession: Electron.Session,
  domain: string
): Promise<AuthResult> {
  try {
    // 获取所有相关 Cookie
    const cookies = await windowSession.cookies.get({ domain })

    // 同时获取父域名的 Cookie（如 .example.com）
    const parentDomain = domain.split('.').slice(-2).join('.')
    const parentCookies = await windowSession.cookies.get({ domain: parentDomain })

    // 合并去重
    const allCookies = [...cookies, ...parentCookies]
    const uniqueCookies = Array.from(
      new Map(allCookies.map((c) => [c.name, c])).values()
    )

    // 格式化为 Cookie 字符串
    const cookieString = formatCookies(uniqueCookies)

    // 关闭窗口
    if (!window.isDestroyed()) {
      window.close()
    }

    return {
      success: true,
      cookies: cookieString,
      metadata: {
        cookieCount: uniqueCookies.length,
        domain,
      },
    }
  } catch (error) {
    if (!window.isDestroyed()) {
      window.close()
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : '获取 Cookie 失败',
    }
  }
}

/**
 * 格式化 Cookie 为字符串
 */
function formatCookies(cookies: Cookie[]): string {
  return cookies
    .filter((cookie) => {
      // 过滤已过期的 Cookie
      if (cookie.expirationDate) {
        return cookie.expirationDate > Date.now() / 1000
      }
      return true
    })
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ')
}

/**
 * 从 URL 提取域名
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    // 如果解析失败，尝试简单提取
    const match = url.match(/(?:https?:\/\/)?([^/]+)/)
    return match ? match[1] : url
  }
}

/**
 * 注册 IPC Handler
 */
export function registerAuthWindowHandlers() {
  ipcMain.handle(
    'auth:openLoginWindow',
    async (_event, options: AuthWindowOptions): Promise<AuthResult> => {
      try {
        const result = await openAuthWindow(options)
        return result
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        }
      }
    }
  )
}
