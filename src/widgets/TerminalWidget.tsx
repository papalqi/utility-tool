import { useMemo, useState, useEffect, useRef } from 'react'
import {
  App,
  Button,
  Space,
  Tabs,
  Tag,
  Typography,
  Form,
  Input,
  InputNumber,
  Select,
  Modal,
  List,
  Switch,
} from 'antd'
import {
  DesktopOutlined,
  ThunderboltOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
  CloudServerOutlined,
  PlusOutlined,
  EditOutlined,
  SettingOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { WidgetLayout, WidgetSection, WidgetEmpty } from '@/components/widgets'
import type { WidgetMetadata } from '@/shared/widget-types'
import { useWidget } from '@/hooks/useWidget'
import { Terminal } from '@/components/Terminal'
import { useTerminalStore } from '@/stores/useTerminalStore'
import type { TerminalSessionMode } from '@/stores/useTerminalStore'
import { useWidgetConfig } from '@/hooks/useWidgetConfig'
import { useWidgetObsidian } from '@/hooks/useWidgetObsidian'
import type { TerminalConfig, SSHProfile } from '@/shared/types'
import { splitCommandLine } from '@/utils/commandLine'

const { Text } = Typography

const metadata: WidgetMetadata = {
  id: 'terminal',
  displayName: '终端任务',
  icon: <DesktopOutlined />,
  description: '多标签命令终端，支持跨 Widget 复用的 PTY 会话',
  category: 'tools',
  order: 8,
  enabled: true,
}

const statusColorMap: Record<string, string> = {
  running: 'processing',
  pending: 'processing',
  success: 'success',
  error: 'error',
}

const defaultTerminalConfig: TerminalConfig = {
  default_shell: 'auto',
}

const shellOptions: {
  label: string
  value: TerminalConfig['default_shell']
  description: string
}[] = [
  { label: '自动检测', value: 'auto', description: '跟随系统默认 Shell / COMSPEC' },
  { label: 'Bash', value: 'bash', description: '/bin/bash' },
  { label: 'Zsh', value: 'zsh', description: '/bin/zsh' },
  { label: 'PowerShell', value: 'powershell', description: 'powershell.exe -NoLogo' },
  { label: 'CMD', value: 'cmd', description: 'cmd.exe / COMSPEC' },
]

const modeLabelMap: Record<TerminalSessionMode, string> = {
  interactive: '交互',
  task: '任务',
  ssh: 'SSH',
}

const modeColorMap: Record<TerminalSessionMode, string> = {
  interactive: 'blue',
  task: 'gold',
  ssh: 'purple',
}

const demoSshProfiles: SSHProfile[] = [
  {
    id: 'demo-1',
    name: '示例服务器',
    host: 'example.dev',
    user: 'dev',
    port: 22,
    description: 'Obsidian 未启用时的示例配置',
  },
  {
    id: 'demo-2',
    name: 'CI Runner',
    host: 'ci.internal',
    user: 'builder',
    port: 2222,
    extra_args: '-L 9000:localhost:9000',
    description: '端口转发示例',
  },
]

interface SSHProfileFormValues extends Omit<SSHProfile, 'id' | 'port' | 'identity_pem'> {
  id?: string
  port?: number
  identity_pem_text?: string
}

const createProfileId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `ssh-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

const TerminalWidget = () => {
  const { message } = App.useApp()
  const { state, setStatus, widgetLogger, isVisible } = useWidget({ metadata })
  const {
    config: terminalConfigState,
    updateConfig,
    loading: configLoading,
    error: configError,
  } = useWidgetConfig<TerminalConfig>({
    section: 'terminal',
    defaultConfig: defaultTerminalConfig,
  })
  const sessions = useTerminalStore((store) => store.sessions)
  const activeSessionId = useTerminalStore((store) => store.activeSessionId)
  const createSession = useTerminalStore((store) => store.createSession)
  const setActiveSession = useTerminalStore((store) => store.setActiveSession)
  const removeSession = useTerminalStore((store) => store.removeSession)
  const updateSession = useTerminalStore((store) => store.updateSession)
  const clearCompleted = useTerminalStore((store) => store.clearCompleted)

  const [lastOpenedDir, setLastOpenedDir] = useState<string>()
  const [activeTab, setActiveTab] = useState<'local' | 'ssh'>('local')
  const [openingShell, setOpeningShell] = useState(false)
  const [sshModalVisible, setSshModalVisible] = useState(false)
  const [usePem, setUsePem] = useState(false)
  const [editingProfile, setEditingProfile] = useState<SSHProfile | null>(null)
  const [sshForm] = Form.useForm<SSHProfileFormValues>()
  const [sshProfiles, setSshProfiles] = useState<SSHProfile[]>([])
  const lastObsidianErrorRef = useRef<string | null>(null)
  const ephemeralKeyMapRef = useRef<Map<string, string>>(new Map())

  const {
    isEnabled: obsidianEnabled,
    read: readSshProfiles,
    sync: syncSshProfiles,
    reading: sshReading,
    syncing: sshSyncing,
    error: obsidianError,
  } = useWidgetObsidian<SSHProfile>({
    widgetId: metadata.id,
    dataType: 'ssh_profiles',
  })

  const terminalConfig = terminalConfigState || defaultTerminalConfig
  const currentShell = terminalConfig.default_shell || defaultTerminalConfig.default_shell
  const resolvedShell = currentShell === 'auto' ? undefined : currentShell
  const widgetLoading = state.loading || configLoading || sshReading
  const widgetError = state.error || configError || obsidianError || null
  const legacySshProfiles = (terminalConfigState as unknown as { ssh_profiles?: SSHProfile[] })
    ?.ssh_profiles
  const hasLegacySshProfiles = Array.isArray(legacySshProfiles) && legacySshProfiles.length > 0
  const legacyMigrationAttemptedRef = useRef(false)

  useEffect(() => {
    if (!isVisible) {
      return
    }

    if (!obsidianEnabled) {
      setSshProfiles(demoSshProfiles.map((item) => ({ ...item })))
      return
    }
    let cancelled = false
    const loadProfiles = async () => {
      const profiles = await readSshProfiles()
      if (cancelled) {
        return
      }
      if (
        profiles.length === 0 &&
        hasLegacySshProfiles &&
        !legacyMigrationAttemptedRef.current &&
        legacySshProfiles
      ) {
        legacyMigrationAttemptedRef.current = true
        const profilesToImport = legacySshProfiles.map((profile) => ({
          ...profile,
          id: profile.id || createProfileId(),
        }))
        const saved = await syncSshProfiles(profilesToImport)
        if (saved) {
          setSshProfiles(profilesToImport)
          message.success('已从配置文件导入 SSH 配置并同步到 Obsidian')
        } else {
          message.error('导入旧 SSH 配置失败，请检查 Obsidian Vault 权限')
          setSshProfiles([])
        }
        return
      }
      setSshProfiles(profiles)
    }
    void loadProfiles()
    return () => {
      cancelled = true
    }
  }, [
    obsidianEnabled,
    readSshProfiles,
    hasLegacySshProfiles,
    legacySshProfiles,
    syncSshProfiles,
    message,
  ])

  useEffect(() => {
    if (obsidianError && obsidianError !== lastObsidianErrorRef.current) {
      lastObsidianErrorRef.current = obsidianError
      message.error(`Obsidian 同步失败：${obsidianError}`)
    } else if (!obsidianError) {
      lastObsidianErrorRef.current = null
    }
  }, [message, obsidianError])

  const runningCount = useMemo(
    () =>
      sessions.filter((session) => session.status === 'running' || session.status === 'pending')
        .length,
    [sessions]
  )
  const completedCount = useMemo(
    () =>
      sessions.filter((session) => session.status === 'success' || session.status === 'error')
        .length,
    [sessions]
  )

  useEffect(() => {
    if (runningCount > 0) {
      setStatus(`运行中 ${runningCount} 个任务`)
    } else if (sessions.length === 0) {
      setStatus('尚未创建终端任务')
    } else {
      setStatus(`已完成 ${completedCount} 个任务`)
    }
  }, [completedCount, isVisible, runningCount, sessions.length, setStatus])

  const handleShellChange = async (value: TerminalConfig['default_shell']) => {
    try {
      await updateConfig({ default_shell: value })
      const target = shellOptions.find((item) => item.value === value)
      message.success(`默认 Shell 已切换为 ${target?.label || value}`)
    } catch (error) {
      message.error(`更新默认 Shell 失败：${getErrorMessage(error)}`)
    }
  }

  const openProfileModal = (profile?: SSHProfile) => {
    setEditingProfile(profile ?? null)
    setSshModalVisible(true)
    sshForm.resetFields()
    const initialValues: Partial<SSHProfileFormValues> = profile
      ? {
          ...profile,
          identity_pem_text: profile.identity_pem ? atob(profile.identity_pem) : undefined,
        }
      : { port: 22 }
    sshForm.setFieldsValue(initialValues)
    setUsePem(Boolean(profile?.identity_pem))
  }

  const handleCloseProfileModal = () => {
    setSshModalVisible(false)
    setEditingProfile(null)
    sshForm.resetFields()
  }

  const handleSaveProfile = async () => {
    try {
      const values = await sshForm.validateFields()
      const normalized: SSHProfile = {
        id: editingProfile?.id || values.id || createProfileId(),
        name: values.name?.trim() || values.host?.trim() || '',
        host: values.host?.trim() || '',
        user: values.user?.trim() || undefined,
        port: values.port || undefined,
        identity_file: usePem ? undefined : values.identity_file?.trim() || undefined,
        identity_pem: usePem
          ? (() => {
              const raw = values.identity_pem_text?.trim() || ''
              if (!raw) return undefined
              const pem = normalizeOpenSSHPem(raw)
              try {
                return btoa(pem)
              } catch {
                return btoa(unescape(encodeURIComponent(pem)))
              }
            })()
          : undefined,
        extra_args: values.extra_args?.trim() || undefined,
        description: values.description?.trim() || undefined,
        local_workdir: values.local_workdir?.trim() || undefined,
      }

      const nextProfiles = editingProfile
        ? sshProfiles.map((profile) => {
            if (editingProfile.id) {
              return profile.id === editingProfile.id ? normalized : profile
            }
            return profile === editingProfile ? normalized : profile
          })
        : [...sshProfiles, normalized]

      let saved = true
      if (obsidianEnabled) {
        saved = await syncSshProfiles(nextProfiles)
        if (!saved) {
          message.error('保存 SSH 配置失败，请检查 Obsidian Vault 权限')
          return
        }
      } else {
        message.warning('Obsidian 未启用，SSH 配置仅在当前会话有效')
      }
      setSshProfiles(nextProfiles)
      message.success(editingProfile ? 'SSH 配置已更新' : '已新增 SSH 配置')
      handleCloseProfileModal()
    } catch (error: any) {
      if (error?.errorFields) {
        return
      }
      message.error(`保存 SSH 配置失败：${getErrorMessage(error)}`)
    }
  }

  const handleDeleteProfile = (profile: SSHProfile) => {
    Modal.confirm({
      title: `删除 SSH 配置「${profile.name || profile.host}」？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          const nextProfiles = sshProfiles.filter((item) => {
            if (profile.id) {
              return item.id !== profile.id
            }
            return item !== profile
          })
          let saved = true
          if (obsidianEnabled) {
            saved = await syncSshProfiles(nextProfiles)
            if (!saved) {
              message.error('删除 SSH 配置失败，请稍后重试')
              return
            }
          } else {
            message.warning('Obsidian 未启用，删除结果仅在当前会话生效')
          }
          setSshProfiles(nextProfiles)
          message.success('已删除 SSH 配置')
        } catch (error) {
          message.error(`删除失败：${getErrorMessage(error)}`)
        }
      },
    })
  }

  const handleConnectProfile = async (profile: SSHProfile) => {
    if (!profile.host) {
      message.error('SSH 配置缺少主机地址')
      return
    }

    const target = profile.user ? `${profile.user}@${profile.host}` : profile.host
    const args = [target]
    if (profile.port) {
      args.push('-p', profile.port.toString())
    }
    let tempKeyPath: string | undefined
    try {
      if (profile.identity_pem) {
        // 直接按 base64 写入，避免 atob/utf-8 编码破坏
        widgetLogger.info('Preparing SSH key from identity_pem (base64)', {
          base64Length: profile.identity_pem.length,
        })
        tempKeyPath = await createEphemeralKeyFileFromBase64(profile.identity_pem)
        args.push('-i', tempKeyPath)
        // 连接前自检：头尾、大小、ssh-keygen
        try {
          const content = await window.electronAPI.readFile(tempKeyPath)
          const lines = content.split(/\r?\n/)
          const head = lines[0] || ''
          const tail = lines[lines.length - 1] || ''
          widgetLogger.info('Ephemeral key written', {
            path: tempKeyPath,
            size: content.length,
            head,
            tail,
          })
          if (window.electronAPI.execCommand) {
            try {
              const out = await window.electronAPI.execCommand(`ssh-keygen -l -f "${tempKeyPath}"`)
              widgetLogger.info('ssh-keygen check OK', { output: out.trim() })
            } catch (err: any) {
              widgetLogger.warn('ssh-keygen check failed', { error: String(err?.message || err) })
              message.warning('ssh-keygen 校验失败：可能不是有效的私钥格式')
            }
          }
        } catch (probeErr) {
          widgetLogger.warn('Failed to probe ephemeral key', { error: getErrorMessage(probeErr) })
        }
      } else if (profile.identity_file) {
        widgetLogger.info('Using identity_file for SSH', { identity_file: profile.identity_file })
        args.push('-i', profile.identity_file)
      }
    } catch (e) {
      message.error(`准备私钥失败：${getErrorMessage(e)}`)
      return
    }
    if (profile.extra_args) {
      args.push(...splitCommandLine(profile.extra_args))
    }

    const newId = createSession({
      title: profile.name || `SSH @ ${profile.host}`,
      command: 'ssh',
      args,
      cwd: profile.local_workdir || undefined,
      mode: 'ssh',
      shell: resolvedShell,
      profileId: profile.id,
    })
    if (tempKeyPath) {
      ephemeralKeyMapRef.current.set(newId, tempKeyPath)
    }
    message.success(`正在连接 ${target}`)
  }

  const handlePickProfilePath = async (field: 'identity_file' | 'local_workdir') => {
    if (!window.electronAPI) {
      message.error('当前环境缺少文件系统能力')
      return
    }

    try {
      if (field === 'identity_file') {
        const picked = await window.electronAPI.selectFile({
          title: '选择 SSH 私钥',
          properties: ['openFile'],
        })
        if (picked) {
          sshForm.setFieldsValue({ identity_file: picked })
        }
      } else {
        const picked = await window.electronAPI.selectFolder({
          title: '选择本地工作目录',
          properties: ['openDirectory'],
        })
        if (picked) {
          sshForm.setFieldsValue({ local_workdir: picked })
        }
      }
    } catch (error) {
      message.error(`选择路径失败：${getErrorMessage(error)}`)
    }
  }

  const handleCopyProfileValue = async (
    field: 'identity_file' | 'local_workdir' | 'identity_pem_text'
  ) => {
    const value = sshForm.getFieldValue(field)
    if (!value) {
      message.warning('当前字段为空，无法复制')
      return
    }
    try {
      await navigator.clipboard.writeText(value)
      message.success('已复制到剪贴板')
    } catch (error) {
      message.error(`复制失败：${getErrorMessage(error)}`)
    }
  }

  const buildSessionTitle = (directory: string) => {
    const normalized = directory.replace(/\\/g, '/').replace(/\/+$/, '')
    const folderName = normalized.split('/').filter(Boolean).pop()
    return folderName ? `终端 @ ${folderName}` : '终端会话'
  }

  const createInteractiveSession = (directory: string) => {
    const title = buildSessionTitle(directory)
    createSession({
      title,
      command: '',
      args: [],
      cwd: directory,
      mode: 'interactive',
      shell: resolvedShell,
    })
    setLastOpenedDir(directory)
    message.success(`已在 ${directory} 打开交互式终端`)
  }

  const handlePickDirectoryAndOpen = async () => {
    if (!window.electronAPI?.selectFolder) {
      message.error('当前环境不支持选择目录')
      return
    }
    setOpeningShell(true)
    try {
      const picked = await window.electronAPI.selectFolder({
        title: '选择终端工作目录',
        properties: ['openDirectory'],
      })
      if (picked) {
        createInteractiveSession(picked)
      }
    } catch (error) {
      message.error(`打开终端失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setOpeningShell(false)
    }
  }

  const handleReopenLastDirectory = () => {
    if (!lastOpenedDir) {
      message.warning('请先选择一个目录')
      return
    }
    createInteractiveSession(lastOpenedDir)
  }

  const handleClearCompleted = () => {
    clearCompleted()
    message.info('已清除所有已完成的任务')
  }

  const buildSessionTabs = (source: typeof sessions, groupVisible: boolean) =>
    source.map((session) => {
      const sessionMode = session.mode || (session.command ? 'task' : 'interactive')
      const modeTagColor = modeColorMap[sessionMode as TerminalSessionMode] || 'default'
      const modeLabel = modeLabelMap[sessionMode as TerminalSessionMode] || '终端'
      const sessionVisible = groupVisible && activeSessionId === session.id

      return {
        key: session.id,
        label: (
          <Space size={6} align="center">
            <span>{session.title}</span>
            <Tag color={modeTagColor} style={{ margin: 0 }}>
              {modeLabel}
            </Tag>
            <Tag color={statusColorMap[session.status] || 'default'} style={{ margin: 0 }}>
              {session.status === 'running'
                ? '运行中'
                : session.status === 'pending'
                  ? '初始化'
                  : session.status === 'success'
                    ? '完成'
                    : '失败'}
            </Tag>
          </Space>
        ),
        children: (
          <div style={{ height: '60vh' }}>
            <Terminal
              id={session.id}
              command={session.command}
              args={session.args}
              cwd={session.cwd || ''}
              mode={sessionMode as TerminalSessionMode}
              shell={session.shell}
              height="56vh"
              isVisible={sessionVisible}
              onExit={async (exitCode) => {
                updateSession(session.id, {
                  status: exitCode === 0 ? 'success' : 'error',
                  exitCode,
                })
                if (exitCode === 0) {
                  message.success(`任务 ${session.title} 已完成`)
                } else {
                  message.error(`任务 ${session.title} 失败（退出码 ${exitCode}）`)
                }
                // 清理临时私钥
                const map = ephemeralKeyMapRef.current
                const keyPath = map.get(session.id)
                if (keyPath && window.electronAPI?.deleteFile) {
                  try {
                    await window.electronAPI.deleteFile(keyPath)
                  } catch {
                    // ignore
                  } finally {
                    map.delete(session.id)
                  }
                }
              }}
            />
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">
                创建时间：{dayjs(session.createdAt).format('HH:mm:ss')}
                {session.cwd ? ` • 工作目录: ${session.cwd}` : ''}
                {` • 模式: ${modeLabel}`}
                {session.shell ? ` • Shell: ${session.shell}` : ''}
              </Text>
            </div>
          </div>
        ),
      }
    })

  const localSessions = useMemo(
    () => sessions.filter((s) => (s.mode || (s.command ? 'task' : 'interactive')) !== 'ssh'),
    [sessions]
  )
  const sshSessions = useMemo(
    () => sessions.filter((s) => (s.mode || (s.command ? 'task' : 'interactive')) === 'ssh'),
    [sessions]
  )
  const localSessionTabs = useMemo(
    () => buildSessionTabs(localSessions, isVisible && activeTab === 'local'),
    [activeSessionId, activeTab, isVisible, localSessions]
  )
  const sshSessionTabs = useMemo(
    () => buildSessionTabs(sshSessions, isVisible && activeTab === 'ssh'),
    [activeSessionId, activeTab, isVisible, sshSessions]
  )

  // ======= 明文私钥支持（快速连接） =======
  const normalizeOpenSSHPem = (raw: string) => {
    let text = (raw || '').trim()
    if (!text) return ''
    // 去掉围绕的引号
    if (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))
    ) {
      text = text.slice(1, -1).trim()
    }
    // 去掉 Markdown 代码块围栏 ```...```
    if (text.startsWith('```')) {
      text = text.replace(/^```[a-zA-Z-]*\s*/, '')
      text = text.replace(/\s*```\s*$/, '')
    }
    text = text.replace(/\r\n?/g, '\n').trim()

    // 尝试匹配任意 BEGIN/END 私钥围栏（更宽松，避免用户粘贴的头尾被破坏导致误判）
    const beginMatch = text.match(/^-----BEGIN\s+([A-Z0-9 ]+?)-----\s*$/m)
    const endMatch = text.match(/^-----END\s+([A-Z0-9 ]+?)-----\s*$/m)
    let label = 'OPENSSH PRIVATE KEY'
    if (beginMatch && endMatch && beginMatch[1] === endMatch[1]) {
      label = beginMatch[1]
      const start = beginMatch.index! + beginMatch[0].length
      const endIdx = endMatch.index!
      const middle = text.slice(start, endIdx)
      // 仅保留 base64 合法字符
      const base64 = middle.replace(/[^A-Za-z0-9+/=]/g, '')
      const lines: string[] = []
      for (let i = 0; i < base64.length; i += 70) {
        lines.push(base64.slice(i, i + 70))
      }
      // OpenSSH 私钥文件必须以换行符结尾
      return [`-----BEGIN ${label}-----`, ...lines, `-----END ${label}-----`].join('\n') + '\n'
    }

    // 不含围栏，则视为 base64 主体，按 OPENSSH 私钥重建
    const base64 = text.replace(/[^A-Za-z0-9+/=]/g, '')
    const lines: string[] = []
    for (let i = 0; i < base64.length; i += 70) {
      lines.push(base64.slice(i, i + 70))
    }
    // OpenSSH 私钥文件必须以换行符结尾
    return (
      ['-----BEGIN OPENSSH PRIVATE KEY-----', ...lines, '-----END OPENSSH PRIVATE KEY-----'].join(
        '\n'
      ) + '\n'
    )
  }

  // legacy helper kept for reference (no longer used)

  const createEphemeralKeyFileFromBase64 = async (base64Data: string) => {
    if (
      !window.electronAPI?.getTempDir ||
      !window.electronAPI?.ensureDir ||
      !window.electronAPI?.writeFile
    ) {
      throw new Error('缺少文件系统权限')
    }
    const dir = `${await window.electronAPI.getTempDir()}/pcut-ssh-keys`
    await window.electronAPI.ensureDir(dir)
    const id = `key_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`
    const keyPath = `${dir}/${id}.key`

    // 修复：SSH 私钥必须是纯文本文件，不能用二进制模式写入
    // 先将 base64 解码为原始 PEM 文本，再以文本模式写入
    const pemContent = atob(base64Data)
    await window.electronAPI.writeFile(keyPath, pemContent)

    try {
      const platform = await window.electronAPI.getPlatform()
      if (platform !== 'win32' && window.electronAPI.execCommand) {
        await window.electronAPI.execCommand(`chmod 600 "${keyPath}"`)
      }
    } catch {
      // ignore
    }
    return keyPath
  }

  const hasCompleted = completedCount > 0

  return (
    <>
      <WidgetLayout
        title={metadata.displayName}
        icon={metadata.icon}
        loading={widgetLoading}
        error={widgetError}
        bordered
        extra={
          <Space>
            <Tag color="geekblue">运行中 {runningCount}</Tag>
            <Tag color="default">已完成 {completedCount}</Tag>
            <Button
              icon={<DeleteOutlined />}
              onClick={handleClearCompleted}
              disabled={!hasCompleted}
              size="small"
            >
              清除完成
            </Button>
          </Space>
        }
        actionInProgress={runningCount > 0}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <WidgetSection title="终端偏好" icon={<SettingOutlined />}>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Text type="secondary">默认 Shell 应用于新建的交互式终端与 SSH 会话。</Text>
              <Select
                value={currentShell}
                onChange={(value) => void handleShellChange(value)}
                style={{ width: 260 }}
                options={shellOptions.map((item) => ({
                  label: `${item.label}${item.description ? `（${item.description}）` : ''}`,
                  value: item.value,
                }))}
              />
            </Space>
          </WidgetSection>

          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as 'local' | 'ssh')}
            items={[
              {
                key: 'local',
                label: '本地终端',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <WidgetSection title="打开终端" icon={<ThunderboltOutlined />}>
                      <Space direction="vertical" style={{ width: '100%' }} size="small">
                        <Text type="secondary">选择一个目录并立即打开交互式终端。</Text>
                        <Space wrap>
                          <Button
                            type="primary"
                            icon={<FolderOpenOutlined />}
                            onClick={() => void handlePickDirectoryAndOpen()}
                            loading={openingShell}
                          >
                            选择目录并打开
                          </Button>
                          <Button onClick={handleReopenLastDirectory} disabled={!lastOpenedDir}>
                            在最近目录打开
                          </Button>
                        </Space>
                        <Text type="secondary" title={lastOpenedDir || '尚未选择'}>
                          最近目录：{lastOpenedDir || '尚未选择'}
                        </Text>
                      </Space>
                    </WidgetSection>

                    <WidgetSection title="终端会话（本地）" icon={<DesktopOutlined />}>
                      {localSessions.length === 0 ? (
                        <WidgetEmpty
                          description="还没有本地终端会话"
                          actionText="打开终端"
                          onAction={() => void handlePickDirectoryAndOpen()}
                        />
                      ) : (
                        <Tabs
                          activeKey={
                            localSessions.find((s) => s.id === activeSessionId)?.id ||
                            localSessions[0].id
                          }
                          type="editable-card"
                          hideAdd
                          onEdit={(targetKey, action) => {
                            if (action === 'remove') {
                              removeSession(targetKey as string)
                            }
                          }}
                          onChange={(key) => setActiveSession(key)}
                          items={localSessionTabs}
                        />
                      )}
                    </WidgetSection>
                  </Space>
                ),
              },
              {
                key: 'ssh',
                label: 'SSH',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <WidgetSection title="SSH 连接" icon={<CloudServerOutlined />}>
                      <Space direction="vertical" style={{ width: '100%' }} size="small">
                        <Space
                          style={{
                            width: '100%',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                          }}
                        >
                          <Space size={8} align="center">
                            <Text type="secondary">保存常用 SSH 目标并一键连接。</Text>
                            <Tag color={obsidianEnabled ? 'green' : 'orange'}>
                              {obsidianEnabled ? 'Obsidian 已启用' : '示例数据'}
                            </Tag>
                          </Space>
                          <Button
                            type="link"
                            icon={<PlusOutlined />}
                            onClick={() => openProfileModal()}
                          >
                            新增配置
                          </Button>
                        </Space>
                        {!obsidianEnabled && (
                          <Text type="warning">
                            未检测到 Obsidian Vault，下面的配置仅用于展示，修改不会持久化。
                          </Text>
                        )}
                        {sshProfiles.length === 0 ? (
                          <WidgetEmpty
                            description="尚未配置 SSH 连接"
                            actionText="新增 SSH 配置"
                            onAction={() => openProfileModal()}
                          />
                        ) : (
                          <List
                            loading={sshReading || sshSyncing}
                            dataSource={sshProfiles}
                            renderItem={(profile) => {
                              const target = profile.user
                                ? `${profile.user}@${profile.host}`
                                : profile.host
                              const listKey = profile.id || `${target}-${profile.port || 22}`
                              return (
                                <List.Item
                                  key={listKey}
                                  actions={[
                                    <Button
                                      type="link"
                                      key="connect"
                                      onClick={() => handleConnectProfile(profile)}
                                    >
                                      连接
                                    </Button>,
                                    <Button
                                      type="link"
                                      icon={<EditOutlined />}
                                      key="edit"
                                      onClick={() => openProfileModal(profile)}
                                    >
                                      编辑
                                    </Button>,
                                    <Button
                                      type="link"
                                      danger
                                      key="delete"
                                      onClick={() => handleDeleteProfile(profile)}
                                    >
                                      删除
                                    </Button>,
                                  ]}
                                >
                                  <List.Item.Meta
                                    title={
                                      <Space size="small">
                                        <Text strong>{profile.name || target}</Text>
                                        <Tag color="purple">SSH</Tag>
                                      </Space>
                                    }
                                    description={
                                      <Space direction="vertical" size={2}>
                                        <Text type="secondary">目标：{target}</Text>
                                        <Text type="secondary">
                                          端口：{profile.port || 22}
                                          {profile.local_workdir
                                            ? ` • 工作目录：${profile.local_workdir}`
                                            : ''}
                                        </Text>
                                        {profile.description && (
                                          <Text type="secondary">{profile.description}</Text>
                                        )}
                                      </Space>
                                    }
                                  />
                                </List.Item>
                              )
                            }}
                          />
                        )}
                      </Space>
                    </WidgetSection>

                    <WidgetSection title="终端会话（SSH）" icon={<DesktopOutlined />}>
                      {sshSessions.length === 0 ? (
                        <WidgetEmpty
                          description="还没有 SSH 会话"
                          actionText="新增 SSH 配置"
                          onAction={() => openProfileModal()}
                        />
                      ) : (
                        <Tabs
                          activeKey={
                            sshSessions.find((s) => s.id === activeSessionId)?.id ||
                            sshSessions[0].id
                          }
                          type="editable-card"
                          hideAdd
                          onEdit={(targetKey, action) => {
                            if (action === 'remove') {
                              removeSession(targetKey as string)
                            }
                          }}
                          onChange={(key) => setActiveSession(key)}
                          items={sshSessionTabs}
                        />
                      )}
                    </WidgetSection>
                  </Space>
                ),
              },
            ]}
          />
        </Space>
      </WidgetLayout>

      <Modal
        open={sshModalVisible}
        title={editingProfile ? '编辑 SSH 配置' : '新增 SSH 配置'}
        okText="保存"
        cancelText="取消"
        confirmLoading={sshSyncing}
        onCancel={handleCloseProfileModal}
        onOk={() => void handleSaveProfile()}
        destroyOnHidden
        maskClosable={false}
      >
        <Form form={sshForm} layout="vertical">
          <Form.Item label="名称" name="name">
            <Input placeholder="例如：生产环境 / GitHub" />
          </Form.Item>
          <Form.Item
            label="主机"
            name="host"
            rules={[
              { required: true, message: '请输入主机地址，例如 192.168.1.10 或 example.com' },
            ]}
          >
            <Input placeholder="example.com" />
          </Form.Item>
          <Form.Item label="用户名" name="user">
            <Input placeholder="可选，例如 ubuntu" />
          </Form.Item>
          <Form.Item label="端口" name="port">
            <InputNumber min={1} max={65535} style={{ width: '100%' }} placeholder="默认 22" />
          </Form.Item>

          <Form.Item label="密钥输入方式">
            <Switch
              checked={usePem}
              onChange={(checked) => {
                setUsePem(checked)
                if (checked) {
                  sshForm.setFieldsValue({ identity_file: undefined })
                } else {
                  sshForm.setFieldsValue({ identity_pem_text: undefined })
                }
              }}
              checkedChildren="粘贴私钥"
              unCheckedChildren="选择文件"
            />
          </Form.Item>
          {usePem ? (
            <Form.Item label="OpenSSH 私钥内容" name="identity_pem_text">
              <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                <div style={{ flex: 1 }}>
                  <Input.TextArea rows={6} placeholder="-----BEGIN OPENSSH PRIVATE KEY----- ..." />
                </div>
                <div>
                  <Button
                    onClick={async () => {
                      try {
                        const picked = await window.electronAPI?.selectFile?.({
                          title: '选择 SSH 私钥文件',
                          properties: ['openFile'],
                        })
                        if (picked) {
                          const content = await window.electronAPI.readFile(picked)
                          sshForm.setFieldsValue({ identity_pem_text: content })
                          message.success('已从文件导入私钥内容')
                        }
                      } catch (e) {
                        message.error(`导入失败：${getErrorMessage(e)}`)
                      }
                    }}
                  >
                    从文件导入
                  </Button>
                </div>
              </div>
            </Form.Item>
          ) : (
            <Form.Item label="私钥文件">
              <Space style={{ width: '100%' }}>
                <div style={{ flex: 1 }}>
                  <Form.Item name="identity_file" noStyle>
                    <Input placeholder="例如 ~/.ssh/id_rsa" />
                  </Form.Item>
                </div>
                <Button
                  icon={<FolderOpenOutlined />}
                  onClick={() => void handlePickProfilePath('identity_file')}
                />
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => void handleCopyProfileValue('identity_file')}
                />
              </Space>
            </Form.Item>
          )}

          <Form.Item label="本地工作目录">
            <Space style={{ width: '100%' }}>
              <div style={{ flex: 1 }}>
                <Form.Item name="local_workdir" noStyle>
                  <Input placeholder="可选，例如 /Users/me/code" />
                </Form.Item>
              </div>
              <Button
                icon={<FolderOpenOutlined />}
                onClick={() => void handlePickProfilePath('local_workdir')}
              />
              <Button
                icon={<CopyOutlined />}
                onClick={() => void handleCopyProfileValue('local_workdir')}
              />
            </Space>
          </Form.Item>

          <Form.Item label="额外参数" name="extra_args">
            <Input placeholder='例如 "-L 9000:localhost:9000"' />
          </Form.Item>

          <Form.Item label="备注" name="description">
            <Input.TextArea rows={2} placeholder="可选说明" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default TerminalWidget
