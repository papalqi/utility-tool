import { spawn } from 'child_process'
import { homedir, tmpdir } from 'os'
import { join } from 'path'
import { promises as fsPromises, existsSync } from 'fs'
import log from './logger'
import {
  ADBDeviceInfo,
  AdbCommandResult,
  AdbRunCommandOptions,
  AdbFileTransferOptions,
  AdbScreenshotResult,
  AdbLogcatResult,
} from '@shared/adb'

const DEFAULT_TIMEOUT = 15_000
const ADB_HINT =
  '请在设置 → ADB 中配置 adb_path 或安装 Android Platform Tools 并确保 adb 在 PATH 中。'

export class AdbNotFoundError extends Error {
  code = 'ADB_NOT_FOUND'
  constructor(resolvedPath: string) {
    super(`未找到 ADB 可执行文件（当前路径: ${resolvedPath}）。${ADB_HINT}`)
    this.name = 'AdbNotFoundError'
  }
}

type TimeoutHandle = ReturnType<typeof setTimeout>

/**
 * 运行 ADB 命令
 */
async function runAdbCommand(options: AdbRunCommandOptions): Promise<AdbCommandResult> {
  const { adbPath, deviceId, args, timeout = DEFAULT_TIMEOUT } = options
  const command = resolveAdbPath(adbPath)
  const finalArgs = buildArgs(deviceId, args)
  if (command !== 'adb' && !existsSync(command)) {
    throw new AdbNotFoundError(command)
  }

  log.debug('[ADB] Executing command', { command, finalArgs })

  return new Promise<AdbCommandResult>((resolve, reject) => {
    const child = spawn(command, finalArgs, { shell: false })
    let stdout = ''
    let stderr = ''
    let timer: TimeoutHandle | null = null

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }

    timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('ADB command timed out'))
    }, timeout)

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimer()
      if (error.code === 'ENOENT') {
        reject(new AdbNotFoundError(command))
        return
      }
      reject(error)
    })

    child.on('close', (code) => {
      clearTimer()
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code: code ?? -1,
      })
    })
  })
}

/**
 * 运行需要二进制输出的 ADB 命令
 */
async function runBinaryAdbCommand(
  options: AdbRunCommandOptions
): Promise<{ stdout: Buffer; stderr: string; code: number }> {
  const { adbPath, deviceId, args, timeout = DEFAULT_TIMEOUT } = options
  const command = resolveAdbPath(adbPath)
  const finalArgs = buildArgs(deviceId, args)
  if (command !== 'adb' && !existsSync(command)) {
    throw new AdbNotFoundError(command)
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, finalArgs, { shell: false })
    const stdoutChunks: Buffer[] = []
    let stderr = ''
    let timer: TimeoutHandle | null = null

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }

    timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('ADB command timed out'))
    }, timeout)

    child.stdout.on('data', (data: Buffer) => {
      stdoutChunks.push(data)
    })

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimer()
      if (error.code === 'ENOENT') {
        reject(new AdbNotFoundError(command))
        return
      }
      reject(error)
    })

    child.on('close', (code) => {
      clearTimer()
      resolve({
        stdout: Buffer.concat(stdoutChunks),
        stderr: stderr.trim(),
        code: code ?? -1,
      })
    })
  })
}

/**
 * 检查 ADB 可用性
 */
async function checkVersion(adbPath?: string): Promise<AdbCommandResult> {
  return runAdbCommand({
    adbPath,
    args: ['version'],
    timeout: 5_000,
  })
}

/**
 * 获取设备列表
 */
async function listDevices(adbPath?: string): Promise<ADBDeviceInfo[]> {
  const result = await runAdbCommand({
    adbPath,
    args: ['devices', '-l'],
    timeout: 5_000,
  })

  if (result.code !== 0) {
    throw new Error(result.stderr || 'Failed to list devices')
  }

  const lines = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('List of devices'))

  const devices: ADBDeviceInfo[] = []

  for (const line of lines) {
    const device = parseDeviceLine(line)
    if (device) {
      devices.push(device)
    }
  }

  await Promise.all(devices.map((device) => enrichDeviceInfo(adbPath, device)))

  return devices
}

/**
 * 执行用户命令
 */
async function runUserCommand(options: AdbRunCommandOptions): Promise<AdbCommandResult> {
  return runAdbCommand(options)
}

/**
 * 上传文件
 */
async function pushFile(options: AdbFileTransferOptions): Promise<AdbCommandResult> {
  const { deviceId, localPath, remotePath, adbPath } = options
  return runAdbCommand({
    adbPath,
    deviceId,
    args: ['push', localPath, remotePath],
    timeout: 60_000,
  })
}

/**
 * 下载文件
 */
async function pullFile(options: AdbFileTransferOptions): Promise<AdbCommandResult> {
  const { deviceId, localPath, remotePath, adbPath } = options
  return runAdbCommand({
    adbPath,
    deviceId,
    args: ['pull', remotePath, localPath],
    timeout: 60_000,
  })
}

/**
 * 截图
 */
async function captureScreenshot(options: {
  adbPath?: string
  deviceId: string
  outputDir?: string
}): Promise<AdbScreenshotResult> {
  const { adbPath, deviceId, outputDir } = options
  const result = await runBinaryAdbCommand({
    adbPath,
    deviceId,
    args: ['exec-out', 'screencap', '-p'],
    timeout: 10_000,
  })

  if (result.code !== 0 || result.stdout.length === 0) {
    throw new Error(result.stderr || 'Failed to capture screenshot')
  }

  const targetDir = outputDir || tmpdir()
  const filename = `adb-screenshot-${deviceId}-${Date.now()}.png`
  const fullPath = join(targetDir, filename)

  await fsPromises.writeFile(fullPath, result.stdout)

  return {
    filePath: fullPath,
    size: result.stdout.length,
  }
}

/**
 * 导出 logcat
 */
async function dumpLogcat(options: {
  adbPath?: string
  deviceId: string
  filter?: string
}): Promise<AdbLogcatResult> {
  const { adbPath, deviceId, filter } = options
  const args = ['logcat', '-d', '-v', 'time']

  if (filter && filter.trim().length > 0) {
    args.push(filter)
  }

  const result = await runAdbCommand({
    adbPath,
    deviceId,
    args,
    timeout: 10_000,
  })

  if (result.code !== 0) {
    throw new Error(result.stderr || 'Failed to dump logcat')
  }

  return {
    log: result.stdout,
    length: result.stdout.length,
  }
}

/**
 * 工具函数 - 解析设备行
 */
function parseDeviceLine(line: string): ADBDeviceInfo | null {
  const tokens = line.split(/\s+/)
  if (tokens.length < 2) {
    return null
  }

  const [id, status, ...rest] = tokens
  if (!id || !status) {
    return null
  }

  const extras: Record<string, string> = {}

  for (const token of rest) {
    if (token.includes(':')) {
      const [key, value] = token.split(':')
      if (key && value) {
        extras[key] = value
      }
    }
  }

  return {
    id,
    status,
    model: extras.model,
    product: extras.product,
    transportId: extras.transport_id,
    deviceName: extras.device,
  }
}

/**
 * 获取设备更多信息
 */
async function enrichDeviceInfo(adbPath: string | undefined, device: ADBDeviceInfo): Promise<void> {
  try {
    const manufacturerResult = await runAdbCommand({
      adbPath,
      deviceId: device.id,
      args: ['shell', 'getprop', 'ro.product.manufacturer'],
      timeout: 4_000,
    })

    if (manufacturerResult.code === 0) {
      device.manufacturer = manufacturerResult.stdout
    }
  } catch (error) {
    log.warn('[ADB] Failed to read manufacturer', { device: device.id, error })
  }

  try {
    const versionResult = await runAdbCommand({
      adbPath,
      deviceId: device.id,
      args: ['shell', 'getprop', 'ro.build.version.release'],
      timeout: 4_000,
    })

    if (versionResult.code === 0) {
      device.androidVersion = versionResult.stdout
    }
  } catch (error) {
    log.warn('[ADB] Failed to read android version', { device: device.id, error })
  }
}

/**
 * 构建命令参数
 */
function buildArgs(deviceId: string | undefined, args: string[]): string[] {
  const finalArgs = []
  if (deviceId) {
    finalArgs.push('-s', deviceId)
  }
  finalArgs.push(...args)
  return finalArgs
}

/**
 * 解析 ADB 路径
 */
function resolveAdbPath(adbPath?: string): string {
  const platformExecutable = process.platform === 'win32' ? 'adb.exe' : 'adb'

  const expandHomeDir = (input: string) => {
    if (input.startsWith('~')) {
      return join(homedir(), input.slice(1))
    }
    return input
  }

  const normalizeCandidate = (candidate?: string | null) => {
    if (!candidate) return null
    const expanded = expandHomeDir(candidate.trim())
    if (!expanded) return null
    if (expanded === 'adb' || expanded.endsWith('/adb') || expanded.endsWith('\\adb')) {
      return expanded
    }
    if (existsSync(expanded)) {
      return expanded
    }
    return null
  }

  if (adbPath) {
    const normalized = normalizeCandidate(adbPath)
    if (normalized) {
      return normalized
    }
  }

  const candidates: Array<string | null> = [
    'adb',
    join(process.cwd(), 'platform-tools', platformExecutable),
  ]

  const envHomes = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT]
  envHomes.forEach((envPath) => {
    if (envPath) {
      candidates.push(join(envPath, 'platform-tools', platformExecutable))
    }
  })

  if (process.platform === 'darwin') {
    candidates.push(join(homedir(), 'Library', 'Android', 'sdk', 'platform-tools', 'adb'))
  } else if (process.platform === 'linux') {
    candidates.push(join(homedir(), 'Android', 'Sdk', 'platform-tools', 'adb'))
  } else if (process.platform === 'win32') {
    candidates.push(join('C:\\', 'Android', 'platform-tools', 'adb.exe'))
  }

  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate)
    if (!normalized) continue
    if (normalized === 'adb') {
      return normalized
    }
    if (existsSync(normalized)) {
      return normalized
    }
  }

  return 'adb'
}

export const adbManager = {
  checkVersion,
  listDevices,
  runUserCommand,
  pushFile,
  pullFile,
  captureScreenshot,
  dumpLogcat,
}

export type { ADBDeviceInfo, AdbCommandResult }
