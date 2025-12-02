/**
 * 环境变量服务
 * 将环境变量相关的业务逻辑从 index.ts 中抽离
 */

import { join } from 'path'
import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'
import log from '../logger'
import type {
  EnvironmentSnapshot,
  EnvironmentMutationPayload,
  EnvironmentDeletePayload,
  PathEntriesPayload,
  EnvironmentVariable,
  EnvironmentCapabilities,
  EnvVarScope,
} from '@shared/system'

const WINDOWS_USER_ENV_REG_PATH = 'HKCU\\Environment'
const WINDOWS_SYSTEM_ENV_REG_PATH =
  'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'
const WINDOWS_EXECUTABLE_CACHE = new Map<string, string | null>()
const ENV_SCOPE_ORDER: Record<EnvVarScope, number> = {
  system: 0,
  user: 1,
  process: 2,
}

/**
 * 构建环境变量快照
 */
export function buildEnvironmentSnapshot(): EnvironmentSnapshot {
  const platform = process.platform
  const variables: EnvironmentVariable[] = []
  const scopes: EnvVarScope[] = []
  const registryKeys = new Set<string>()
  const pathEntries = {
    user: [] as string[],
    system: [] as string[],
    process: getProcessPathEntries(),
  }

  const addScope = (scope: EnvVarScope) => {
    if (!scopes.includes(scope)) {
      scopes.push(scope)
    }
  }

  if (platform === 'win32') {
    const regExecutable = resolveWindowsExecutablePath('reg.exe')

    if (regExecutable) {
      const systemVars = readWindowsEnvironmentVariables('system', regExecutable)
      if (systemVars.length) {
        addScope('system')
        systemVars.forEach((entry) => registryKeys.add(normalizeEnvKey(entry.key)))
        variables.push(...systemVars)
        pathEntries.system = extractPathEntries(systemVars)
      }

      const userVars = readWindowsEnvironmentVariables('user', regExecutable)
      if (userVars.length) {
        addScope('user')
        userVars.forEach((entry) => registryKeys.add(normalizeEnvKey(entry.key)))
        variables.push(...userVars)
        pathEntries.user = extractPathEntries(userVars)
      }
    } else {
      log.warn('reg.exe not available, falling back to process environment variables only')
    }
  }

  const processVars: EnvironmentVariable[] = []
  for (const [key, value] of Object.entries(process.env)) {
    if (!key) {
      continue
    }

    if (platform === 'win32' && registryKeys.has(normalizeEnvKey(key))) {
      continue
    }

    processVars.push({
      key,
      value: value ?? '',
      scope: 'process',
      source: 'process',
    })
  }

  if (processVars.length) {
    addScope('process')
    variables.push(...processVars)
  }

  variables.sort((a, b) => {
    if (a.scope !== b.scope) {
      return ENV_SCOPE_ORDER[a.scope] - ENV_SCOPE_ORDER[b.scope]
    }
    return a.key.localeCompare(b.key)
  })

  return {
    variables,
    platform,
    scopes,
    capabilities: resolveEnvironmentCapabilities(platform),
    pathEntries,
    generatedAt: Date.now(),
  }
}

/**
 * 解析环境变量编辑能力
 */
export function resolveEnvironmentCapabilities(platform: NodeJS.Platform): EnvironmentCapabilities {
  const isWindows = platform === 'win32'
  if (!isWindows) {
    return {
      supportsEditing: false,
      canEditUser: false,
      canEditSystem: false,
      canDelete: false,
      notes: 'Currently only supports viewing environment variables, cross-platform write support coming soon',
    }
  }

  const regExecutable = resolveWindowsExecutablePath('reg.exe')
  const setxExecutable = resolveWindowsExecutablePath('setx.exe')
  const supportsEditing = Boolean(regExecutable && setxExecutable)

  return {
    supportsEditing,
    canEditUser: Boolean(setxExecutable),
    canEditSystem: Boolean(setxExecutable),
    canDelete: Boolean(regExecutable),
    notes: supportsEditing
      ? undefined
      : 'reg.exe or setx.exe not found, automatically downgraded to read-only mode',
  }
}

/**
 * 应用环境变量修改
 */
export async function applyEnvironmentMutation(
  payload: EnvironmentMutationPayload
): Promise<EnvironmentVariable> {
  if (!payload || !payload.key?.trim()) {
    throw new Error('Environment variable name cannot be empty')
  }

  const key = payload.key.trim()
  const serializedValue = `${payload.value ?? ''}`

  if (process.platform !== 'win32') {
    throw new Error('Currently only supports modifying environment variables on Windows')
  }

  const scope: Exclude<EnvVarScope, 'process'> = payload.scope === 'system' ? 'system' : 'user'
  const args = [key, serializedValue]
  if (scope === 'system') {
    args.push('/M')
  }

  const setxExecutable = resolveWindowsExecutablePath('setx.exe')
  if (!setxExecutable) {
    throw new Error('setx.exe not available, cannot set environment variable')
  }

  try {
    execFileSync(setxExecutable, args, { windowsHide: true })
    process.env[key] = serializedValue
    return {
      key,
      value: serializedValue,
      scope,
      source: 'registry',
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to write environment variable ${key}: ${reason}`)
  }
}

/**
 * 删除环境变量
 */
export async function deleteEnvironmentVariable(payload: EnvironmentDeletePayload): Promise<void> {
  if (!payload || !payload.key?.trim()) {
    throw new Error('Environment variable name cannot be empty')
  }

  if (process.platform !== 'win32') {
    throw new Error('Currently only supports deleting environment variables on Windows')
  }

  const key = payload.key.trim()
  const scope: Exclude<EnvVarScope, 'process'> = payload.scope === 'system' ? 'system' : 'user'
  const hive = scope === 'system' ? WINDOWS_SYSTEM_ENV_REG_PATH : WINDOWS_USER_ENV_REG_PATH
  const regExecutable = resolveWindowsExecutablePath('reg.exe')
  if (!regExecutable) {
    throw new Error('reg.exe not available, cannot delete environment variable')
  }

  try {
    execFileSync(regExecutable, ['delete', hive, '/v', key, '/f'], { windowsHide: true })
    delete process.env[key]
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to delete environment variable ${key}: ${reason}`)
  }
}

/**
 * 应用 PATH 条目更新
 */
export async function applyPathEntries(payload: PathEntriesPayload): Promise<void> {
  if (!payload.scope || !payload.entries) {
    throw new Error('PATH update parameters incomplete')
  }

  if (process.platform !== 'win32') {
    throw new Error('Currently only supports modifying PATH on Windows')
  }

  const sanitized = payload.entries
    .map((entry) => entry.trim())
    .filter((entry, index, array) => entry.length > 0 && array.indexOf(entry) === index)

  await applyEnvironmentMutation({
    key: 'PATH',
    value: sanitized.join(';'),
    scope: payload.scope,
  })
}

/**
 * 解析可执行文件路径（跨平台 which）
 */
export function resolveExecutable(command: string): string | null {
  if (!command || /[\\/]/.test(command)) {
    // Do not resolve paths with separators here
    return null
  }
  const pathVar = process.env.PATH || ''
  const dirs = pathVar.split(process.platform === 'win32' ? ';' : ':').filter(Boolean)

  if (process.platform === 'win32') {
    const exts = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
    const hasExt = /\.[^.]+$/.test(command)
    for (const dir of dirs) {
      if (!hasExt) {
        for (const ext of exts) {
          const full = path.join(dir, command + ext)
          try {
            if (fs.existsSync(full)) return full
          } catch {
            // Ignore errors when checking file existence
          }
        }
      } else {
        const full = path.join(dir, command)
        try {
          if (fs.existsSync(full)) return full
        } catch {
          // Ignore errors when checking file existence
        }
      }
    }
    return null
  } else {
    for (const dir of dirs) {
      const full = path.join(dir, command)
      try {
        // Check executable bit for owner/group/others
        fs.accessSync(full, fs.constants.X_OK)
        return full
      } catch {
        // Ignore errors when checking file permissions
      }
    }
    return null
  }
}

// ==================== 内部辅助函数 ====================

function readWindowsEnvironmentVariables(
  scope: Exclude<EnvVarScope, 'process'>,
  regExecutable: string
): EnvironmentVariable[] {
  const hive = scope === 'system' ? WINDOWS_SYSTEM_ENV_REG_PATH : WINDOWS_USER_ENV_REG_PATH
  try {
    const output = execFileSync(regExecutable, ['query', hive], { encoding: 'utf8' })
    const lines = output.split(/\r?\n/)
    const entries: EnvironmentVariable[] = []

    for (const rawLine of lines) {
      const line = rawLine.trim()

      if (!line || line.startsWith('HKEY')) {
        continue
      }

      const parts = line.split(/\s{2,}/).filter(Boolean)
      if (parts.length < 3) {
        continue
      }

      const [name, , ...valueParts] = parts
      const value = valueParts.join('  ').replace(/\0/g, ';')
      entries.push({
        key: name,
        value,
        scope,
        source: 'registry',
      })
    }

    return entries
  } catch (error) {
    log.warn(`Failed to read ${scope} environment variables`, error)
    return []
  }
}

function normalizeEnvKey(key: string): string {
  return process.platform === 'win32' ? key.toUpperCase() : key
}

function getProcessPathEntries(): string[] {
  const raw = process.env.PATH || process.env.Path || process.env.path || ''
  return splitPath(raw)
}

function extractPathEntries(entries: EnvironmentVariable[]): string[] {
  const pathEntry = entries.find((entry) => normalizeEnvKey(entry.key) === 'PATH')
  return pathEntry ? splitPath(pathEntry.value) : []
}

function splitPath(value: string): string[] {
  if (!value) {
    return []
  }

  return value
    .split(';')
    .map((segment) => segment.trim())
    .filter((segment) => Boolean(segment))
}

function resolveWindowsExecutablePath(executable: string): string | null {
  if (process.platform !== 'win32') {
    return null
  }

  if (WINDOWS_EXECUTABLE_CACHE.has(executable)) {
    return WINDOWS_EXECUTABLE_CACHE.get(executable) || null
  }

  const systemRoot = process.env.SystemRoot || 'C:\\Windows'
  const candidate = join(systemRoot, 'System32', executable)
  if (fs.existsSync(candidate)) {
    WINDOWS_EXECUTABLE_CACHE.set(executable, candidate)
    return candidate
  }

  // Last resort: trust PATH
  WINDOWS_EXECUTABLE_CACHE.set(executable, null)
  return null
}
