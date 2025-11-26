/**
 * 附件管理器
 *
 * 支持两种存储模式:
 * 1. 本地存储: 保存到本地目录
 * 2. PICgo 上传: 上传到图床
 */

import type { Attachment } from '../shared/types'
import { configManager } from '../core/ConfigManager'

export type StorageMode = 'local' | 'picgo'

export class AttachmentManager {
  // 支持的文件类型
  static IMAGE_EXTENSIONS = new Set([
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.bmp',
    '.webp',
    '.svg',
    '.ico',
  ])
  static VIDEO_EXTENSIONS = new Set(['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm'])

  /**
   * 添加附件
   */
  static async addAttachment(filePath: string, customName?: string): Promise<Attachment | null> {
    try {
      const config = configManager.getConfig()
      const storageMode: StorageMode = config.attachment?.storage_mode || 'local'

      console.log('[AttachmentManager] Config:', {
        storageMode,
        use_picgo_server: config.attachment?.use_picgo_server,
        picgo_server_url: config.attachment?.picgo_server_url,
        picgo_path: config.attachment?.picgo_path,
        local_path: config.attachment?.local_path,
      })

      // 获取文件信息
      const fileName = customName || filePath.split('/').pop() || 'file'
      const fileType = this.getFileType(filePath)

      let resultPath: string

      if (storageMode === 'local') {
        resultPath = await this.saveToLocal(filePath, fileName)
      } else {
        resultPath = await this.uploadToPicGo(filePath)
      }

      return {
        name: fileName,
        path: resultPath,
        type: fileType,
        storage_mode: storageMode,
      }
    } catch (error) {
      console.error('[AttachmentManager] Failed to add attachment:', error)
      throw error
    }
  }

  /**
   * 删除附件
   */
  static async deleteAttachment(attachment: Attachment): Promise<boolean> {
    try {
      const storageMode = attachment.storage_mode || 'local'

      if (storageMode === 'local') {
        return await this.deleteLocalFile(attachment.path)
      } else {
        // 图床文件通常不支持删除
        console.log('[AttachmentManager] Image host files do not support automatic deletion')
        return false
      }
    } catch (error) {
      console.error('[AttachmentManager] Failed to delete attachment:', error)
      return false
    }
  }

  /**
   * 获取文件类型
   */
  private static getFileType(filePath: string): 'image' | 'video' | 'file' {
    const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'))

    if (this.IMAGE_EXTENSIONS.has(ext)) {
      return 'image'
    } else if (this.VIDEO_EXTENSIONS.has(ext)) {
      return 'video'
    } else {
      return 'file'
    }
  }

  /**
   * 保存到本地
   */
  private static async saveToLocal(sourcePath: string, fileName: string): Promise<string> {
    const config = configManager.getConfig()
    const localPath = config.attachment?.local_path || 'data/obsidian_vault/attachments'

    // 确保目录存在
    try {
      await window.electronAPI.ensureDir(localPath)
    } catch (error) {
      console.error('[AttachmentManager] Failed to create directory:', error)
    }

    // 生成唯一文件名（防止覆盖）
    const timestamp = Date.now()
    const ext = fileName.substring(fileName.lastIndexOf('.'))
    const baseName = fileName.substring(0, fileName.lastIndexOf('.'))
    const uniqueName = `${baseName}_${timestamp}${ext}`
    const targetPath = `${localPath}/${uniqueName}`

    // 复制文件
    await window.electronAPI.copyFile(sourcePath, targetPath)

    // 返回相对路径
    return uniqueName
  }

  /**
   * 上传到 PicGo
   */
  private static async uploadToPicGo(sourcePath: string): Promise<string> {
    const config = configManager.getConfig()
    const usePicGoServer = config.attachment?.use_picgo_server || false
    const picgoServerUrl = config.attachment?.picgo_server_url || 'http://127.0.0.1:36677'
    const picgoPath = config.attachment?.picgo_path || ''

    console.log('[AttachmentManager] uploadToPicGo:', {
      usePicGoServer,
      picgoServerUrl,
      picgoPath,
      sourcePath,
    })

    if (usePicGoServer) {
      // 使用 PicGo Server API
      console.log('[AttachmentManager] Using PicGo Server')
      return await this.uploadViaPicGoServer(sourcePath, picgoServerUrl)
    } else {
      // 使用 PicGo CLI
      console.log('[AttachmentManager] Using PicGo CLI')
      return await this.uploadViaPicGoCLI(sourcePath, picgoPath)
    }
  }

  /**
   * 通过 PicGo Server 上传
   */
  private static async uploadViaPicGoServer(
    sourcePath: string,
    serverUrl: string
  ): Promise<string> {
    console.log('[AttachmentManager] Uploading to PicGo Server:', serverUrl)
    console.log('[AttachmentManager] Source file path:', sourcePath)

    // PicGo Server API 需要的是文件路径列表，而不是 base64 内容
    const response = await fetch(`${serverUrl}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        list: [sourcePath], // 直接传递文件路径
      }),
    })

    console.log('[AttachmentManager] PicGo Server response status:', response.status)

    if (!response.ok) {
      throw new Error(`PicGo Server upload failed: ${response.statusText}`)
    }

    const result = await response.json()
    console.log('[AttachmentManager] PicGo Server response:', result)

    // 检查响应是否成功
    if (!result.success) {
      throw new Error(`PicGo Server upload failed: ${result.message || 'Unknown error'}`)
    }

    // PicGo Server 的响应格式: { success: true, result: ["url1", "url2"] }
    if (result.result && result.result.length > 0) {
      return result.result[0] // 返回图床 URL
    } else {
      throw new Error(`PicGo Server upload failed: No URL returned`)
    }
  }

  /**
   * 通过 PicGo CLI 上传
   */
  private static async uploadViaPicGoCLI(sourcePath: string, picgoPath: string): Promise<string> {
    if (!picgoPath) {
      throw new Error('PicGo CLI 路径未配置，请在设置中配置 attachment.picgo_path')
    }

    try {
      // 调用 PicGo CLI，使用完整路径
      const result = await window.electronAPI.execCommand(`"${picgoPath}" upload "${sourcePath}"`)

      // 解析 CLI 输出获取 URL
      // PicGo CLI 输出格式通常是: [PicGo SUCCESS]: https://...
      const urlMatch = result.match(/https?:\/\/[^\s]+/)
      if (urlMatch) {
        return urlMatch[0]
      } else {
        throw new Error(`Failed to parse PicGo CLI output: ${result}`)
      }
    } catch (error) {
      console.error('[AttachmentManager] PicGo CLI upload failed:', error)
      throw new Error(
        `PicGo上传失败: ${error instanceof Error ? error.message : String(error)}\n` +
          `请确保PicGo CLI已安装并配置正确的路径，当前配置: ${picgoPath}`
      )
    }
  }

  /**
   * 删除本地文件
   */
  private static async deleteLocalFile(relativePath: string): Promise<boolean> {
    try {
      const config = configManager.getConfig()
      const localPath = config.attachment?.local_path || 'data/obsidian_vault/attachments'
      const fullPath = `${localPath}/${relativePath}`

      await window.electronAPI.deleteFile(fullPath)
      return true
    } catch (error) {
      console.error('[AttachmentManager] Failed to delete local file:', error)
      return false
    }
  }

  /**
   * 获取附件的完整路径（用于显示）
   */
  static getAttachmentFullPath(attachment: Attachment): string {
    if (attachment.path.startsWith('http://') || attachment.path.startsWith('https://')) {
      // 网络路径，直接返回
      return attachment.path
    } else {
      // 本地路径，需要拼接
      const config = configManager.getConfig()
      const localPath = config.attachment?.local_path || 'data/obsidian_vault/attachments'
      return `${localPath}/${attachment.path}`
    }
  }
}
