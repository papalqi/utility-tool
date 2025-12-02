/**
 * IPC Handlers 统一注册入口
 * 所有 IPC handlers 按功能域拆分到独立模块，在此统一注册
 */

import { BrowserWindow } from 'electron'

// 导入各功能域的 IPC 注册函数
import { registerAppIpc } from './app.ipc'
import { registerConfigIpc } from './config.ipc'
import { registerFileIpc } from './file.ipc'
import { registerPtyIpc } from './pty.ipc'
import { registerScriptIpc } from './script.ipc'
import { registerEnvIpc } from './env.ipc'
import { registerAdbIpc } from './adb.ipc'
import { registerAiIpc } from './ai.ipc'
import { registerGithubIpc } from './github.ipc'
import { registerWindowIpc } from './window.ipc'
import { registerResourcesIpc } from './resources.ipc'
import { registerWebArchiveIpc } from './webarchive.ipc'
import { registerShellIpc } from './shell.ipc'

/**
 * IPC 上下文，传递给各模块的共享依赖
 */
export interface IpcContext {
  getMainWindow: () => BrowserWindow | null
}

/**
 * 注册所有 IPC handlers
 * @param context IPC 上下文
 */
export function registerAllIpcHandlers(context: IpcContext): void {
  // 核心功能
  registerAppIpc(context)
  registerConfigIpc(context)
  registerFileIpc(context)
  registerWindowIpc(context)

  // 终端与脚本
  registerPtyIpc(context)
  registerScriptIpc(context)

  // 系统功能
  registerEnvIpc(context)
  registerResourcesIpc(context)
  registerShellIpc(context)

  // 外部服务
  registerAdbIpc(context)
  registerAiIpc(context)
  registerGithubIpc(context)
  registerWebArchiveIpc(context)
}
