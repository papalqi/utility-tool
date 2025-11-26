import * as pty from '@homebridge/node-pty-prebuilt-multiarch'
import { BrowserWindow } from 'electron'
import * as os from 'os'

interface PTYSession {
  id: string
  pty: pty.IPty
  window: BrowserWindow
}

export type PTYSessionMode = 'interactive' | 'task' | 'ssh'

export interface PTYSessionOptions {
  id: string
  command?: string
  args?: string[]
  cwd?: string
  shell?: string
  mode?: PTYSessionMode
}

class PTYManager {
  private sessions: Map<string, PTYSession> = new Map()

  /**
   * 创建新的 PTY 会话
   */
  createSession(options: PTYSessionOptions, window: BrowserWindow): string {
    const {
      id,
      command = '',
      args = [],
      cwd,
      shell,
      mode = 'interactive',
    } = options

    // 如果已存在同 ID 的会话，先关闭
    if (this.sessions.has(id)) {
      this.closeSession(id)
    }

    const shellConfig = this.resolveShell(shell)

    // 创建 PTY
    const ptyProcess = pty.spawn(shellConfig.executable, shellConfig.spawnArgs, {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: cwd || process.cwd(),
      env: process.env as Record<string, string | undefined>,
    })

    // 监听 PTY 输出
    ptyProcess.onData((data: string) => {
      // 检查 webContents 是否已销毁
      if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
        window.webContents.send(`pty-output-${id}`, data)
      } else {
        // WebContents 已销毁，清理会话
        this.closeSession(id)
      }
    })

    // 监听 PTY 退出
    ptyProcess.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
      // 检查 webContents 是否已销毁
      if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
        window.webContents.send(`pty-exit-${id}`, { exitCode, signal })
      }
      this.sessions.delete(id)
    })

    if (command) {
      const commandLine = this.buildCommandLine(command, args, shellConfig.platform)
      ptyProcess.write(`${commandLine}${shellConfig.newline}`)
      if (mode === 'task') {
        ptyProcess.write(`exit${shellConfig.newline}`)
      }
    }

    // 保存会话
    this.sessions.set(id, {
      id,
      pty: ptyProcess,
      window,
    })

    return id
  }

  /**
   * 向 PTY 会话写入数据
   */
  writeToSession(id: string, data: string): boolean {
    const session = this.sessions.get(id)
    if (!session) {
      throw new Error(`PTY session not found: ${id}`)
    }

    try {
      session.pty.write(data)
      return true
    } catch (error) {
      console.error(`Failed to write to PTY session ${id}:`, error)
      return false
    }
  }

  /**
   * 调整 PTY 会话大小
   */
  resizeSession(id: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(id)
    if (!session) {
      return false
    }

    session.pty.resize(cols, rows)
    return true
  }

  /**
   * 关闭 PTY 会话
   */
  closeSession(id: string): boolean {
    const session = this.sessions.get(id)
    if (!session) {
      return false
    }

    session.pty.kill()
    this.sessions.delete(id)
    return true
  }

  /**
   * 关闭所有会话
   */
  closeAllSessions(): void {
    this.sessions.forEach((session) => {
      session.pty.kill()
    })
    this.sessions.clear()
  }

  private resolveShell(preferred?: string): {
    executable: string
    spawnArgs: string[]
    newline: string
    platform: NodeJS.Platform
  } {
    const platform = os.platform()
    const newline = platform === 'win32' ? '\r' : '\n'
    const normalized = preferred?.toLowerCase()

    if (platform === 'win32') {
      if (normalized === 'powershell') {
        return { executable: 'powershell.exe', spawnArgs: ['-NoLogo'], newline, platform }
      }
      if (normalized && normalized !== 'auto') {
        return { executable: normalized, spawnArgs: [], newline, platform }
      }
      return {
        executable: process.env.COMSPEC || 'cmd.exe',
        spawnArgs: [],
        newline,
        platform,
      }
    }

    if (normalized === 'bash') {
      return { executable: '/bin/bash', spawnArgs: [], newline, platform }
    }
    if (normalized === 'zsh') {
      return { executable: '/bin/zsh', spawnArgs: [], newline, platform }
    }
    if (normalized && normalized !== 'auto') {
      return { executable: normalized, spawnArgs: [], newline, platform }
    }

    const envShell = process.env.SHELL
    return {
      executable: envShell || '/bin/bash',
      spawnArgs: [],
      newline,
      platform,
    }
  }

  private buildCommandLine(command: string, args: string[], platform: NodeJS.Platform): string {
    const quotedCommand = this.quoteArg(command, platform)
    const quotedArgs = args
      .filter((arg) => typeof arg === 'string')
      .map((arg) => this.quoteArg(arg, platform))
    return [quotedCommand, ...quotedArgs].filter(Boolean).join(' ')
  }

  private quoteArg(arg: string, platform: NodeJS.Platform): string {
    if (!arg) {
      return '""'
    }

    if (platform === 'win32') {
      if (/[\s"]/u.test(arg)) {
        return `"${arg.replace(/"/g, '\\"')}"`
      }
      return arg
    }

    if (/[\s"'\\]/u.test(arg)) {
      return `"${arg.replace(/(["\\$`])/g, '\\$1')}"`
    }

    return arg
  }
}

export const ptyManager = new PTYManager()
