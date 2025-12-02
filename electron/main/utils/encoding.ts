/**
 * 编码处理工具
 */

import iconv from 'iconv-lite'

/**
 * 智能解码控制台输出
 * Windows 下优先尝试 UTF-8，若检测到乱码则回退到 GBK
 */
export function decodeConsoleOutput(buf: Buffer): string {
  if (!Buffer.isBuffer(buf)) return String(buf ?? '')

  if (process.platform === 'win32') {
    // Try UTF-8 first; if we see replacement chars or common mojibake, try GBK
    const asUtf8 = buf.toString('utf-8')
    if (asUtf8.includes('\uFFFD') || asUtf8.includes('锟')) {
      try {
        return iconv.decode(buf, 'gbk')
      } catch {
        return asUtf8
      }
    }
    return asUtf8
  }

  return buf.toString('utf-8')
}
