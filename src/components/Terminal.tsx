import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useTheme } from '@/contexts/ThemeContext'
import type { TerminalSessionMode } from '@/stores/useTerminalStore'

interface TerminalProps {
  id: string
  command?: string
  args?: string[]
  cwd?: string
  mode?: TerminalSessionMode
  shell?: string
  onExit?: (exitCode: number, signal?: number) => void
  height?: number | string
  isVisible?: boolean
}

export const Terminal = ({
  id,
  command,
  args = [],
  cwd = process.cwd(),
  mode = 'interactive',
  shell,
  onExit,
  height = 400,
  isVisible = true,
}: TerminalProps) => {
  const { colors } = useTheme()
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [isReady, setIsReady] = useState(false)
  const ptyInitializedRef = useRef(false) // 追踪 PTY 是否已初始化
  const onExitRef = useRef(onExit) // 保存 onExit 引用

  // 更新 onExit 引用
  useEffect(() => {
    onExitRef.current = onExit
  }, [onExit])

  useEffect(() => {
    if (!isVisible || !terminalRef.current || !xtermRef.current) {
      return
    }

    const element = terminalRef.current
    const xterm = xtermRef.current

    const writeClipboard = async (text: string) => {
      if (!text) return
      try {
        if (window.electronAPI?.writeClipboardText) {
          await window.electronAPI.writeClipboardText(text)
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
        }
      } catch (err) {
        console.error('Failed to copy text:', err)
      }
    }

    const readClipboard = async () => {
      try {
        if (window.electronAPI?.readClipboardText) {
          return await window.electronAPI.readClipboardText()
        }
        if (navigator.clipboard?.readText) {
          return await navigator.clipboard.readText()
        }
      } catch (err) {
        console.error('Failed to read clipboard:', err)
      }
      return ''
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      const selection = xterm.getSelection()
      if (selection) {
        void writeClipboard(selection)
      } else {
        readClipboard().then((text) => {
          if (!text) return
          window.electronAPI.ptyWrite(id, text).catch((err) => {
            console.warn('Failed to paste text:', err)
          })
        })
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!xterm) return
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c' && xterm.hasSelection()) {
          e.preventDefault()
          const selection = xterm.getSelection()
          if (selection) {
            void writeClipboard(selection)
          }
        } else if (e.key === 'v') {
          e.preventDefault()
          readClipboard().then((text) => {
            if (!text) return
            window.electronAPI.ptyWrite(id, text).catch((err) => {
              console.warn('Failed to paste text:', err)
            })
          })
        }
      }
    }

    element.addEventListener('contextmenu', handleContextMenu)
    element.addEventListener('keydown', handleKeyDown)

    return () => {
      element.removeEventListener('contextmenu', handleContextMenu)
      element.removeEventListener('keydown', handleKeyDown)
    }
  }, [id, isReady, isVisible])

  useEffect(() => {
    if (
      !isVisible ||
      !isReady ||
      !fitAddonRef.current ||
      !xtermRef.current ||
      !terminalRef.current
    ) {
      return
    }

    const fitAddon = fitAddonRef.current
    const xterm = xtermRef.current
    const element = terminalRef.current

    const handleResize = () => {
      try {
        fitAddon.fit()
        window.electronAPI.ptyResize(id, xterm.cols, xterm.rows).catch((err) => {
          console.warn('Failed to resize PTY on window resize:', err)
        })
      } catch (err) {
        console.warn('Failed to fit terminal on resize:', err)
      }
    }

    const rafId = requestAnimationFrame(handleResize)
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => handleResize()) : null

    if (resizeObserver) {
      resizeObserver.observe(element)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      cancelAnimationFrame(rafId)
    }
  }, [id, isReady, isVisible])

  useEffect(() => {
    if (!terminalRef.current) return

    // 创建终端实例
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: colors.terminalBg,
        foreground: colors.terminalFg,
        cursor: colors.terminalCursor,
        selectionBackground: colors.terminalSelection,
        black: colors.terminalBlack,
        red: colors.terminalRed,
        green: colors.terminalGreen,
        yellow: colors.terminalYellow,
        blue: colors.terminalBlue,
        magenta: colors.terminalMagenta,
        cyan: colors.terminalCyan,
        white: colors.terminalWhite,
        brightBlack: colors.terminalBrightBlack,
        brightRed: colors.terminalBrightRed,
        brightGreen: colors.terminalBrightGreen,
        brightYellow: colors.terminalBrightYellow,
        brightBlue: colors.terminalBrightBlue,
        brightMagenta: colors.terminalBrightMagenta,
        brightCyan: colors.terminalBrightCyan,
        brightWhite: colors.terminalBrightWhite,
      },
      rows: 24,
      cols: 80,
      // 开启透明度以便主题自由扩展
      allowTransparency: false,
      // 右键菜单默认改为复制/粘贴
      rightClickSelectsWord: false,
    })

    // 加载 fit addon
    const fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)

    // 挂载到 DOM
    xterm.open(terminalRef.current)

    // 延迟 fit，确保 DOM 已经渲染完成
    setTimeout(() => {
      try {
        fitAddon.fit()
      } catch (err) {
        console.warn('Failed to fit terminal on mount:', err)
      }
    }, 0)

    xtermRef.current = xterm
    fitAddonRef.current = fitAddon
    setIsReady(true)

    return () => {
      xterm.dispose()
      window.electronAPI.ptyClose(id)
    }
    // colors 作为依赖，主题切换时重新创建终端以应用新颜色
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, colors])

  useEffect(() => {
    if (!isReady || !xtermRef.current || ptyInitializedRef.current) return

    const xterm = xtermRef.current
    const fitAddon = fitAddonRef.current!

    // 标记为已初始化
    ptyInitializedRef.current = true

    // 创建 PTY 会话
    const initPty = async () => {
      try {
        await window.electronAPI.ptyCreate({
          id,
          command: command || undefined,
          args,
          cwd,
          shell,
          mode,
        })

        // 监听输出
        const unsubscribeOutput = window.electronAPI.onPtyOutput(id, (data: string) => {
          xterm.write(data)
        })

        // 监听退出
        const unsubscribeExit = window.electronAPI.onPtyExit(
          id,
          ({ exitCode, signal }: { exitCode: number; signal?: number }) => {
            xterm.write(`\r\n\r\n进程已退出，退出码: ${exitCode}\r\n`)
            // 使用 ref 中的 onExit，避免闭包陈旧值问题
            onExitRef.current?.(exitCode, signal)
          }
        )

        // 监听用户输入
        const disposable = xterm.onData((data: string) => {
          window.electronAPI.ptyWrite(id, data).catch((err) => {
            console.warn('Failed to write to PTY:', err)
          })
        })

        // 更新终端大小（稍微延迟确保 PTY 已完全初始化）
        setTimeout(() => {
          try {
            fitAddon.fit()
            window.electronAPI.ptyResize(id, xterm.cols, xterm.rows).catch((err) => {
              console.warn('Failed to resize PTY:', err)
            })
          } catch (err) {
            console.warn('Failed to fit terminal during PTY init:', err)
          }
        }, 100)

        return () => {
          disposable.dispose()
          unsubscribeOutput()
          unsubscribeExit()
        }
      } catch (error) {
        console.error('Failed to initialize PTY:', error)
        xterm.write(`\r\n\x1b[31m错误: 无法启动终端会话\x1b[0m\r\n`)
        xterm.write(`${error}\r\n`)
      }
    }

    const cleanup = initPty()

    return () => {
      cleanup.then((fn) => fn?.())
    }
  }, [isReady, id, command, args, cwd, mode, shell])

  return (
    <div
      ref={terminalRef}
      style={{
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        backgroundColor: colors.terminalBg,
        padding: '8px',
        borderRadius: '4px',
      }}
    />
  )
}
