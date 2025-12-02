/**
 * 类型安全的 IPC 客户端
 * 提供编译时类型检查的 IPC 调用
 */

import type {
  IpcChannel,
  IpcChannelMap,
  IpcEvent,
  IpcEventData,
  IpcError,
} from '../../packages/shared/src/ipc-channels'

// 确保 window.electronAPI 类型可用
declare const window: Window & {
  electronAPI: {
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
    on: (channel: string, callback: (...args: unknown[]) => void) => () => void
    onPtyOutput: (id: string, callback: (data: string) => void) => () => void
    onPtyExit: (id: string, callback: (result: { exitCode: number; signal?: number }) => void) => () => void
  }
}

// 类型工具
type IpcArgs<C extends IpcChannel> = IpcChannelMap[C]['args']
type IpcReturn<C extends IpcChannel> = IpcChannelMap[C]['return']

/**
 * 类型安全的 IPC 客户端
 */
class TypedIpcClient {
  /**
   * 调用 IPC 通道（类型安全）
   * @param channel 通道名称
   * @param args 参数（根据通道自动推断类型）
   * @returns 返回值（根据通道自动推断类型）
   * 
   * @example
   * ```ts
   * // 自动推断 config 为 AppConfig | null
   * const config = await ipc.invoke('config:load')
   * 
   * // 自动检查参数类型
   * await ipc.invoke('file:write', '/path/to/file', 'content')
   * 
   * // 编译错误：缺少参数
   * await ipc.invoke('file:read') // ❌ Error
   * 
   * // 编译错误：参数类型错误
   * await ipc.invoke('file:read', 123) // ❌ Error
   * ```
   */
  async invoke<C extends IpcChannel>(
    channel: C,
    ...args: IpcArgs<C>
  ): Promise<IpcReturn<C>> {
    try {
      return await window.electronAPI.invoke(channel, ...args)
    } catch (error) {
      // 包装错误信息
      const ipcError: IpcError = {
        channel,
        message: error instanceof Error ? error.message : String(error),
        code: 'IPC_ERROR',
        timestamp: Date.now(),
      }
      throw ipcError
    }
  }

  /**
   * 订阅 IPC 事件（类型安全）
   * @param event 事件名称
   * @param callback 回调函数
   * @returns 取消订阅函数
   * 
   * @example
   * ```ts
   * // 自动推断 data 类型
   * const unsubscribe = ipc.on('script:output', (data) => {
   *   console.log(data.id, data.type, data.data)
   * })
   * 
   * // 组件卸载时取消订阅
   * unsubscribe()
   * ```
   */
  on<E extends IpcEvent>(
    event: E,
    callback: (data: IpcEventData<E>) => void
  ): () => void {
    return window.electronAPI.on(event, callback as (...args: unknown[]) => void)
  }

  /**
   * 订阅 PTY 输出事件
   */
  onPtyOutput(id: string, callback: (data: string) => void): () => void {
    return window.electronAPI.onPtyOutput(id, callback)
  }

  /**
   * 订阅 PTY 退出事件
   */
  onPtyExit(
    id: string,
    callback: (result: { exitCode: number; signal?: number }) => void
  ): () => void {
    return window.electronAPI.onPtyExit(id, callback)
  }
}

/**
 * 类型安全的 IPC 客户端单例
 * 
 * @example
 * ```ts
 * import { ipc } from '@/core/ipc-client'
 * 
 * // 加载配置
 * const config = await ipc.invoke('config:load')
 * 
 * // 读取文件
 * const content = await ipc.invoke('file:read', '/path/to/file')
 * 
 * // 订阅事件
 * const unsubscribe = ipc.on('script:output', (data) => {
 *   console.log(data)
 * })
 * ```
 */
export const ipc = new TypedIpcClient()

// 导出类型
export type { IpcChannel, IpcArgs, IpcReturn, IpcError }
