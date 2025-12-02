/**
 * 文件系统操作 Hook
 * 使用类型安全的 IPC 客户端
 */

import { useCallback } from 'react'
import { ipc } from '@/core/ipc-client'
import type { FileSelectOptions, FolderSelectOptions } from '../../../packages/shared/src/ipc-channels'

interface UseFileSystemReturn {
  // 文件选择
  selectFile: (options?: FileSelectOptions) => Promise<string | undefined>
  selectFolder: (options?: FolderSelectOptions) => Promise<string | undefined>

  // 文件读写
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  exists: (path: string) => Promise<boolean>
  deleteFile: (path: string) => Promise<void>

  // Base64 操作
  readFileBase64: (path: string) => Promise<string>
  writeFileBase64: (path: string, base64Data: string) => Promise<void>

  // 目录操作
  ensureDir: (path: string) => Promise<void>
  getTempDir: () => Promise<string>

  // 剪贴板
  readClipboard: () => Promise<string>
  writeClipboard: (text: string) => Promise<boolean>
}

/**
 * 文件系统操作 Hook
 * 
 * @example
 * ```tsx
 * function FileManager() {
 *   const { selectFile, readFile, writeFile } = useFileSystem()
 *   
 *   const handleOpen = async () => {
 *     const path = await selectFile({
 *       title: '选择文件',
 *       filters: [{ name: 'Text', extensions: ['txt', 'md'] }]
 *     })
 *     if (path) {
 *       const content = await readFile(path)
 *       console.log(content)
 *     }
 *   }
 *   
 *   return <Button onClick={handleOpen}>打开文件</Button>
 * }
 * ```
 */
export function useFileSystem(): UseFileSystemReturn {
  // ==================== 文件选择 ====================

  const selectFile = useCallback(async (options?: FileSelectOptions) => {
    return ipc.invoke('file:select', options)
  }, [])

  const selectFolder = useCallback(async (options?: FolderSelectOptions) => {
    return ipc.invoke('file:selectFolder', options)
  }, [])

  // ==================== 文件读写 ====================

  const readFile = useCallback(async (path: string) => {
    return ipc.invoke('file:read', path)
  }, [])

  const writeFile = useCallback(async (path: string, content: string) => {
    return ipc.invoke('file:write', path, content)
  }, [])

  const exists = useCallback(async (path: string) => {
    return ipc.invoke('file:exists', path)
  }, [])

  const deleteFile = useCallback(async (path: string) => {
    return ipc.invoke('file:delete', path)
  }, [])

  // ==================== Base64 操作 ====================

  const readFileBase64 = useCallback(async (path: string) => {
    return ipc.invoke('file:readBase64', path)
  }, [])

  const writeFileBase64 = useCallback(async (path: string, base64Data: string) => {
    return ipc.invoke('file:writeBase64', path, base64Data)
  }, [])

  // ==================== 目录操作 ====================

  const ensureDir = useCallback(async (path: string) => {
    return ipc.invoke('file:ensureDir', path)
  }, [])

  const getTempDir = useCallback(async () => {
    return ipc.invoke('file:getTempDir')
  }, [])

  // ==================== 剪贴板 ====================

  const readClipboard = useCallback(async () => {
    return ipc.invoke('clipboard:readText')
  }, [])

  const writeClipboard = useCallback(async (text: string) => {
    return ipc.invoke('clipboard:writeText', text)
  }, [])

  return {
    selectFile,
    selectFolder,
    readFile,
    writeFile,
    exists,
    deleteFile,
    readFileBase64,
    writeFileBase64,
    ensureDir,
    getTempDir,
    readClipboard,
    writeClipboard,
  }
}
