import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  RobotOutlined,
  KeyOutlined,
  ApiOutlined,
  CloudSyncOutlined,
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FolderOpenOutlined,
  FileSearchOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Divider,
  Empty,
  Input,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography,
  App,
} from 'antd'
import { WidgetLayout, WidgetSection } from '@/components/widgets'
import { useWidget } from '@/hooks/useWidget'
import { useWidgetActions } from '@/hooks/useWidgetActions'
import type { WidgetMetadata } from '@/shared/widget-types'
import { obsidianManager, ServiceKeyEntry } from '@/core/ObsidianManager'
import { useConfig } from '@/hooks/useConfig'
import type { AICliToolConfig } from '@/shared/types'
import { useTheme } from '@/contexts/ThemeContext'

const { Text, Paragraph } = Typography
const { Option } = Select

type ApiServiceId = 'openai' | 'cli_anthropic' | 'gemini'

const SERVICE_META: Record<
  ApiServiceId,
  { label: string; emoji: string; defaultUrl: string; placeholder: string }
> = {
  openai: {
    label: 'OpenAI',
    emoji: '🤖',
    defaultUrl: 'https://api.openai.com/v1',
    placeholder: 'sk-...',
  },
  cli_anthropic: {
    label: 'CLI Anthropic',
    emoji: '🧠',
    defaultUrl: 'https://api.anthropic.com',
    placeholder: 'sk-ant-...',
  },
  gemini: {
    label: 'Gemini',
    emoji: '✨',
    defaultUrl: 'https://generativelanguage.googleapis.com',
    placeholder: 'AI...',
  },
}

type ApiKeyState = Record<ApiServiceId, ServiceKeyEntry[]>

interface CodexConfigState {
  modelProvider: string
  model: string
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high'
  baseUrl: string
  disableResponseStorage: boolean
}

interface ClaudeFields {
  baseUrl: string
  authToken: string
  apiKey: string
  disableTraffic: boolean
}

const serviceIds: ApiServiceId[] = ['openai', 'cli_anthropic', 'gemini']

const maskSecretValue = (value: string) => {
  if (!value) return ''
  if (value.length <= 6) return `${value[0]}***${value[value.length - 1]}`
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

const buildEmptyApiKeys = (): ApiKeyState =>
  serviceIds.reduce(
    (acc, id) => ({
      ...acc,
      [id]: [],
    }),
    {} as ApiKeyState
  )

const defaultCodexConfig: CodexConfigState = {
  modelProvider: 'fox',
  model: 'gpt-5',
  reasoningEffort: 'high',
  baseUrl: 'https://code.newcli.com/codex/v1',
  disableResponseStorage: true,
}

const metadata: WidgetMetadata = {
  id: 'ai-cli',
  displayName: 'AI CLI 配置',
  icon: <RobotOutlined />,
  description: '管理 Claude Code 与 Codex 的本地配置与 API Keys',
  category: 'tools',
  order: 2,
  enabled: true,
}

const AICliWidget: React.FC = () => {
  const { message, modal } = App.useApp()
  const { colors } = useTheme()
  const config = useConfig()
  const cliTools = useMemo(() => config?.ai_cli_tools || [], [config])

  const [activeTab, setActiveTab] = useState('secrets')
  const [apiKeys, setApiKeys] = useState<ApiKeyState>(buildEmptyApiKeys)
  const [showApiKeys, setShowApiKeys] = useState<Record<ApiServiceId, boolean>>({
    openai: false,
    cli_anthropic: false,
    gemini: false,
  })
  const [secretsStatus, setSecretsStatus] = useState('就绪')
  const [homeDir, setHomeDir] = useState('')
  const [platform, setPlatform] = useState('')
  const [claudeSettings, setClaudeSettings] = useState<Record<string, unknown>>({})
  const [claudeStatus, setClaudeStatus] = useState('未加载')
  const [claudeFields, setClaudeFields] = useState<ClaudeFields>({
    baseUrl: '',
    authToken: '',
    apiKey: '',
    disableTraffic: false,
  })
  const [codexConfig, setCodexConfig] = useState<CodexConfigState>(defaultCodexConfig)
  const [codexStatus, setCodexStatus] = useState('未加载')
  const [codexAuthKey, setCodexAuthKey] = useState('')
  const [claudeShowSecrets, setClaudeShowSecrets] = useState(false)
  const [codexShowKey, setCodexShowKey] = useState(false)
  const [installStatus, setInstallStatus] = useState<Record<string, string>>({})
  const [installLog, setInstallLog] = useState<string[]>([])
  const [installing, setInstalling] = useState<Record<string, boolean>>({})

  const { state, setStatus, setError, setLoading, initialize, widgetLogger } = useWidget({
    metadata,
    autoInit: false,
  })

  const isObsidianEnabled = obsidianManager.isEnabled()

  const getPlatformValue = useCallback(async () => {
    if (platform) {
      return platform
    }
    if (window.electronAPI?.getPlatform) {
      const detected = await window.electronAPI.getPlatform()
      setPlatform(detected)
      return detected
    }
    return 'linux'
  }, [platform])

  const claudeDir = useMemo(() => (homeDir ? `${homeDir}/.claude` : ''), [homeDir])
  const claudeSettingsPath = useMemo(
    () => (claudeDir ? `${claudeDir}/settings.json` : ''),
    [claudeDir]
  )
  const claudeEnv = useMemo(
    () => ((claudeSettings?.env as Record<string, string>) || {}) as Record<string, string>,
    [claudeSettings]
  )

  const codexDir = useMemo(() => (homeDir ? `${homeDir}/.codex` : ''), [homeDir])
  const codexConfigPath = useMemo(() => (codexDir ? `${codexDir}/config.toml` : ''), [codexDir])
  const codexAuthPath = useMemo(() => (codexDir ? `${codexDir}/auth.json` : ''), [codexDir])

  const getErrorMessage = useCallback(
    (error: unknown) => (error instanceof Error ? error.message : String(error)),
    []
  )

  const openWithDefaultApp = useCallback(
    async (targetPath: string) => {
      if (!targetPath) {
        message.warning('未提供有效路径')
        return
      }
      if (!window.electronAPI?.execCommand) {
        message.error('当前环境不支持打开外部应用')
        return
      }

      try {
        const currentPlatform = await getPlatformValue()
        let command: string
        if (currentPlatform === 'win32') {
          command = `start "" "${targetPath}"`
        } else if (currentPlatform === 'darwin') {
          command = `open "${targetPath}"`
        } else {
          command = `xdg-open "${targetPath}"`
        }
        await window.electronAPI.execCommand(command)
        widgetLogger.info('Opened external path', { targetPath })
      } catch (error) {
        const msg = getErrorMessage(error)
        message.error(`无法打开路径：${msg}`)
      }
    },
    [getErrorMessage, getPlatformValue, widgetLogger, message]
  )

  const appendInstallLog = useCallback((line: string) => {
    setInstallLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${line}`])
  }, [])

  const addApiKeyRow = useCallback((serviceId: ApiServiceId) => {
    setApiKeys((prev) => ({
      ...prev,
      [serviceId]: [
        ...prev[serviceId],
        {
          id: `key_${prev[serviceId].length + 1}`,
          key: '',
          url: SERVICE_META[serviceId].defaultUrl,
        },
      ],
    }))
  }, [])

  const updateApiKeyRow = useCallback(
    (serviceId: ApiServiceId, index: number, field: keyof ServiceKeyEntry, value: string) => {
      setApiKeys((prev) => {
        const next = [...prev[serviceId]]
        next[index] = { ...next[index], [field]: value }
        return { ...prev, [serviceId]: next }
      })
    },
    []
  )

  const removeApiKeyRow = useCallback((serviceId: ApiServiceId, index: number) => {
    setApiKeys((prev) => {
      const next = [...prev[serviceId]]
      next.splice(index, 1)
      return { ...prev, [serviceId]: next }
    })
  }, [])

  const pickPrimaryKey = useCallback(
    (serviceId: ApiServiceId): ServiceKeyEntry | undefined => {
      const list = apiKeys[serviceId]
      if (!list.length) return undefined
      const preferred = list.find((item) => /^(main|primary|default)$/i.test(item.id))
      return preferred || list[0]
    },
    [apiKeys]
  )

  const loadSecrets = useCallback(async () => {
    if (!isObsidianEnabled) {
      message.warning('Obsidian 未启用，无法加载 API Keys')
      return
    }

    try {
      setSecretsStatus('正在从 Obsidian 加载...')
      const map = await obsidianManager.getAllServiceKeys(serviceIds)
      const next = buildEmptyApiKeys()
      let total = 0
      serviceIds.forEach((id) => {
        if (map[id]?.length) {
          next[id] = map[id]
          total += map[id].length
        }
      })
      setApiKeys(next)
      setSecretsStatus(total > 0 ? `已加载 ${total} 个 API Keys` : 'Secrets 文件为空或不存在')
      message.success('已加载 Obsidian API Keys')
    } catch (error) {
      const msg = getErrorMessage(error)
      setSecretsStatus(`加载失败：${msg}`)
      widgetLogger.error('Failed to load secrets from Obsidian', error as Error)
      message.error(`加载失败：${msg}`)
    }
  }, [getErrorMessage, isObsidianEnabled, widgetLogger, message])

  const saveSecrets = useCallback(async () => {
    if (!isObsidianEnabled) {
      message.warning('Obsidian 未启用，无法保存')
      return
    }

    try {
      setSecretsStatus('正在保存到 Obsidian...')
      await obsidianManager.saveAllServiceKeys(apiKeys)
      const total = serviceIds.reduce((acc, id) => acc + apiKeys[id].length, 0)
      setSecretsStatus(`已保存 ${total} 个 API Keys`)
      message.success('API Keys 已保存到 Obsidian')
    } catch (error) {
      const msg = getErrorMessage(error)
      setSecretsStatus(`保存失败：${msg}`)
      widgetLogger.error('Failed to save secrets', error as Error)
      message.error(`保存失败：${msg}`)
    }
  }, [apiKeys, getErrorMessage, isObsidianEnabled, widgetLogger, message])

  const saveClaudeConfig = useCallback(
    async (overrides?: Partial<ClaudeFields>) => {
      if (!claudeDir || !claudeSettingsPath || !window.electronAPI?.writeFile) return

      const payload = { ...claudeFields, ...overrides }
      setClaudeFields(payload)

      try {
        await window.electronAPI.ensureDir(claudeDir)
        const env = {
          ...((claudeSettings.env as Record<string, string>) || {}),
          ANTHROPIC_BASE_URL: payload.baseUrl,
          ANTHROPIC_AUTH_TOKEN: payload.authToken,
          ANTHROPIC_API_KEY: payload.apiKey,
          DISABLE_NONESSENTIAL_TRAFFIC: payload.disableTraffic,
        }

        const updated = { ...claudeSettings, env }
        await window.electronAPI.writeFile(claudeSettingsPath, JSON.stringify(updated, null, 2))

        setClaudeSettings(updated)
        setClaudeStatus('已保存')
        widgetLogger.info('Claude settings saved')
        message.success('Claude 配置已保存')
      } catch (error) {
        const msg = getErrorMessage(error)
        widgetLogger.error('Failed to save Claude settings', error as Error)
        throw new Error(`保存 Claude 配置失败: ${msg}`)
      }
    },
    [
      claudeDir,
      claudeFields,
      claudeSettings,
      claudeSettingsPath,
      getErrorMessage,
      widgetLogger,
      message,
    ]
  )

  const saveCodexAuth = useCallback(
    async (keyOverride?: string) => {
      if (!codexDir || !codexAuthPath || !window.electronAPI?.writeFile) return

      const keyToWrite = keyOverride ?? codexAuthKey
      setCodexAuthKey(keyToWrite)

      try {
        await window.electronAPI.ensureDir(codexDir)
        await window.electronAPI.writeFile(
          codexAuthPath,
          JSON.stringify({ OPENAI_API_KEY: keyToWrite }, null, 2)
        )
        widgetLogger.info('Codex auth saved')
        message.success('Codex API Key 已保存')
      } catch (error) {
        const msg = getErrorMessage(error)
        widgetLogger.error('Failed to save Codex auth', error as Error)
        throw new Error(`保存 Codex auth 失败: ${msg}`)
      }
    },
    [codexAuthKey, codexAuthPath, codexDir, getErrorMessage, widgetLogger, message]
  )

  const syncSecretsToTools = useCallback(async () => {
    if (!isObsidianEnabled) {
      message.warning('Obsidian 未启用，无法同步')
      return
    }

    try {
      const synced: string[] = []

      const openaiPrimary = pickPrimaryKey('openai')
      if (openaiPrimary?.key) {
        await saveCodexAuth(openaiPrimary.key)
        synced.push(`Codex ← OpenAI Key [${openaiPrimary.id || 'key'}]`)
      }

      const cliPrimary = pickPrimaryKey('cli_anthropic')
      if (cliPrimary?.key) {
        await saveClaudeConfig({
          apiKey: cliPrimary.key,
          baseUrl: cliPrimary.url || claudeFields.baseUrl,
        })
        synced.push(`Claude Code ← CLI Anthropic Key [${cliPrimary.id || 'key'}]`)
      }

      if (synced.length) {
        setSecretsStatus('已同步到本地工具')
        message.success(`同步成功：\n${synced.join('\n')}`)
      } else {
        setSecretsStatus('没有可以同步的 API Keys')
        message.info('未找到可同步的 API Keys')
      }
    } catch (error) {
      const msg = getErrorMessage(error)
      setSecretsStatus(`同步失败：${msg}`)
      widgetLogger.error('Failed to sync secrets to tools', error as Error)
      message.error(`同步失败：${msg}`)
    }
  }, [
    claudeFields.baseUrl,
    getErrorMessage,
    isObsidianEnabled,
    pickPrimaryKey,
    saveClaudeConfig,
    saveCodexAuth,
    widgetLogger,
    message,
  ])

  const openSecretsInObsidian = useCallback(async () => {
    const filePath = obsidianManager.getSecretsFilePath()
    if (!filePath) {
      message.warning('未配置 Obsidian Secrets 文件')
      return
    }

    await openWithDefaultApp(filePath)
  }, [openWithDefaultApp, message])

  const viewClaudeConfig = useCallback(async () => {
    if (!claudeSettingsPath || !window.electronAPI?.readFile) {
      message.warning('尚未检测到 Claude 配置文件')
      return
    }

    try {
      const content = await window.electronAPI.readFile(claudeSettingsPath)
      modal.info({
        title: 'Claude settings.json',
        width: 720,
        maskClosable: true,
        content: (
          <pre
            style={{
              maxHeight: 360,
              overflow: 'auto',
              background: '#0f172a',
              color: '#e0f2ff',
              padding: 12,
              borderRadius: 6,
            }}
          >
            {content}
          </pre>
        ),
      })
    } catch (error) {
      const msg = getErrorMessage(error)
      message.error(`读取配置失败：${msg}`)
    }
  }, [claudeSettingsPath, getErrorMessage, message, modal])

  const openClaudeConfigFile = useCallback(async () => {
    if (!claudeSettingsPath) {
      message.warning('尚未检测到 Claude 配置文件')
      return
    }
    await openWithDefaultApp(claudeSettingsPath)
  }, [claudeSettingsPath, openWithDefaultApp, message])

  const openCodexDirectory = useCallback(async () => {
    if (!codexDir) {
      message.warning('尚未检测到 Codex 目录')
      return
    }
    await openWithDefaultApp(codexDir)
  }, [codexDir, openWithDefaultApp, message])

  const loadClaudeConfig = useCallback(async () => {
    if (!claudeSettingsPath || !window.electronAPI?.readFile) return

    try {
      const content = await window.electronAPI.readFile(claudeSettingsPath)
      const parsed = JSON.parse(content)
      setClaudeSettings(parsed)

      const env = (parsed.env || {}) as Record<string, string>
      setClaudeFields({
        baseUrl: env.ANTHROPIC_BASE_URL || '',
        authToken: env.ANTHROPIC_AUTH_TOKEN || '',
        apiKey: env.ANTHROPIC_API_KEY || '',
        disableTraffic: Boolean(env.DISABLE_NONESSENTIAL_TRAFFIC),
      })

      setClaudeStatus('已加载')
      widgetLogger.info('Claude settings loaded')
    } catch (error) {
      const msg = getErrorMessage(error)
      if (msg.includes('ENOENT')) {
        setClaudeStatus('配置文件不存在，将在保存时创建')
        setClaudeSettings({})
        setClaudeFields({
          baseUrl: '',
          authToken: '',
          apiKey: '',
          disableTraffic: false,
        })
        return
      }
      widgetLogger.error('Failed to load Claude settings', error as Error)
      throw new Error(`加载 Claude 配置失败: ${msg}`)
    }
  }, [claudeSettingsPath, getErrorMessage, widgetLogger])

  const loadCodexConfig = useCallback(async () => {
    if (!codexConfigPath || !window.electronAPI?.readFile) return

    try {
      const content = await window.electronAPI.readFile(codexConfigPath)
      const config: Partial<CodexConfigState> = {}
      content.split('\n').forEach((line) => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')) return
        const [key, value] = trimmed.split('=')
        if (!key || value === undefined) return
        const normalized = key.trim()
        const cleaned = value.trim().replace(/^"(.*)"$/, '$1')
        switch (normalized) {
          case 'model_provider':
            config.modelProvider = cleaned
            break
          case 'model':
            config.model = cleaned
            break
          case 'model_reasoning_effort':
            config.reasoningEffort = cleaned as CodexConfigState['reasoningEffort']
            break
          case 'disable_response_storage':
            config.disableResponseStorage = cleaned === 'true'
            break
          case 'base_url':
            config.baseUrl = cleaned
            break
          default:
            break
        }
      })

      setCodexConfig({
        modelProvider: config.modelProvider || defaultCodexConfig.modelProvider,
        model: config.model || defaultCodexConfig.model,
        reasoningEffort: config.reasoningEffort || defaultCodexConfig.reasoningEffort,
        baseUrl: config.baseUrl || defaultCodexConfig.baseUrl,
        disableResponseStorage:
          config.disableResponseStorage ?? defaultCodexConfig.disableResponseStorage,
      })
      setCodexStatus('已加载')
      widgetLogger.info('Codex config loaded')
    } catch (error) {
      const msg = getErrorMessage(error)
      if (msg.includes('ENOENT')) {
        setCodexStatus('配置文件不存在，将在保存时创建')
        setCodexConfig(defaultCodexConfig)
        return
      }
      widgetLogger.error('Failed to load Codex config', error as Error)
      throw new Error(`加载 Codex 配置失败: ${msg}`)
    }
  }, [codexConfigPath, getErrorMessage, widgetLogger])

  const saveCodexConfig = useCallback(async () => {
    if (!codexDir || !codexConfigPath || !window.electronAPI?.writeFile) return

    try {
      await window.electronAPI.ensureDir(codexDir)
      const lines = [
        `model_provider = "${codexConfig.modelProvider}"`,
        `model = "${codexConfig.model}"`,
        `model_reasoning_effort = "${codexConfig.reasoningEffort}"`,
        `disable_response_storage = ${codexConfig.disableResponseStorage ? 'true' : 'false'}`,
        '',
        `[model_providers.${codexConfig.modelProvider}]`,
        `name = "${codexConfig.modelProvider}"`,
        `base_url = "${codexConfig.baseUrl}"`,
        'wire_api = "responses"',
        'requires_openai_auth = true',
        '',
      ]
      await window.electronAPI.writeFile(codexConfigPath, lines.join('\n'))
      setCodexStatus('已保存')
      widgetLogger.info('Codex config saved')
      message.success('Codex 配置已保存')
    } catch (error) {
      const msg = getErrorMessage(error)
      widgetLogger.error('Failed to save Codex config', error as Error)
      throw new Error(`保存 Codex 配置失败: ${msg}`)
    }
  }, [codexConfig, codexConfigPath, codexDir, getErrorMessage, widgetLogger, message])

  const loadCodexAuth = useCallback(async () => {
    if (!codexAuthPath || !window.electronAPI?.readFile) return

    try {
      const content = await window.electronAPI.readFile(codexAuthPath)
      const parsed = JSON.parse(content) as { OPENAI_API_KEY?: string }
      setCodexAuthKey(parsed.OPENAI_API_KEY || '')
      widgetLogger.info('Codex auth loaded')
    } catch (error) {
      const msg = getErrorMessage(error)
      if (msg.includes('ENOENT')) {
        setCodexAuthKey('')
        return
      }
      widgetLogger.error('Failed to load Codex auth', error as Error)
      throw new Error(`加载 Codex auth 失败: ${msg}`)
    }
  }, [codexAuthPath, getErrorMessage, widgetLogger])

  const checkToolInstalled = useCallback(
    async (toolConfig: AICliToolConfig) => {
      // Prefer main-process resolver to avoid shell/encoding issues
      if (window.electronAPI?.which) {
        try {
          const resolved = await window.electronAPI.which(toolConfig.command)
          const ok = Boolean(resolved)
          setInstallStatus((prev) => ({
            ...prev,
            [toolConfig.command]: ok ? '已安装' : '未检测到',
          }))
          return ok
        } catch {
          // fallthrough to shell-based detection
        }
      }

      if (!window.electronAPI?.execCommand) return false
      const psFallback = `powershell -NoProfile -Command "(Get-Command ${toolConfig.command} -ErrorAction SilentlyContinue) | Select-Object -Expand Source"`
      const checkCommand =
        platform === 'win32'
          ? `where ${toolConfig.command} || ${psFallback}`
          : `which ${toolConfig.command}`
      try {
        await window.electronAPI.execCommand(checkCommand)
        setInstallStatus((prev) => ({ ...prev, [toolConfig.command]: '已安装' }))
        return true
      } catch {
        setInstallStatus((prev) => ({ ...prev, [toolConfig.command]: '未检测到' }))
        return false
      }
    },
    [platform]
  )

  const recordInstallInstruction = useCallback(
    (toolConfig: AICliToolConfig) => {
      appendInstallLog(`请在终端运行：npm install -g ${toolConfig.package}`)
    },
    [appendInstallLog]
  )

  const requestInstallConfirm = useCallback(
    (toolConfig: AICliToolConfig) => {
      return new Promise<boolean>((resolve) => {
        modal.confirm({
          title: `安装 ${toolConfig.label}`,
          content: (
            <div>
              <p>
                将执行命令：<code>npm install -g {toolConfig.package}</code>
              </p>
              <p style={{ marginBottom: 0 }}>需要已安装 Node.js / npm，可能需要管理员权限。</p>
            </div>
          ),
          okText: '继续',
          cancelText: '取消',
          centered: true,
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        })
      })
    },
    [modal]
  )

  const runInstallTool = useCallback(
    async (toolConfig: AICliToolConfig) => {
      if (!window.electronAPI?.execCommand) {
        message.error('当前环境不支持执行安装命令')
        return
      }
      if (installing[toolConfig.command]) {
        message.info(`${toolConfig.label} 安装已在进行中`)
        return
      }

      try {
        const confirmed = await requestInstallConfirm(toolConfig)
        if (!confirmed) {
          appendInstallLog(`${toolConfig.label} 安装已取消`)
          return
        }

        setInstalling((prev) => ({ ...prev, [toolConfig.command]: true }))
        appendInstallLog(`开始安装 ${toolConfig.label}...`)
        appendInstallLog(`执行命令：npm install -g ${toolConfig.package}`)

        try {
          const output = await window.electronAPI.execCommand(
            `npm install -g ${toolConfig.package}`
          )
          appendInstallLog(`安装成功！`)
          if (output) {
            appendInstallLog(output)
          }
          message.success(`${toolConfig.label} 安装成功`)
          setInstallStatus((prev) => ({ ...prev, [toolConfig.command]: '已安装' }))
          await checkToolInstalled(toolConfig)
        } catch (error) {
          const msg = getErrorMessage(error)
          appendInstallLog(`❌ 安装失败：${msg}`)
          message.error(`${toolConfig.label} 安装失败`)
          setInstallStatus((prev) => ({ ...prev, [toolConfig.command]: '安装失败' }))
        }
      } catch (error) {
        const msg = getErrorMessage(error)
        appendInstallLog(`${toolConfig.label} 安装启动失败：${msg}`)
        message.error(`${toolConfig.label} 安装启动失败：${msg}`)
      } finally {
        setInstalling((prev) => ({ ...prev, [toolConfig.command]: false }))
      }
    },
    [
      appendInstallLog,
      checkToolInstalled,
      getErrorMessage,
      installing,
      requestInstallConfirm,
      message,
    ]
  )

  const { refresh, save, isActionInProgress } = useWidgetActions({
    widgetId: metadata.id,
    onRefresh: async () => {
      await Promise.all([loadClaudeConfig(), loadCodexConfig(), loadCodexAuth(), loadSecrets()])
    },
    onSave: async () => {
      await Promise.all([saveClaudeConfig(), saveCodexConfig(), saveCodexAuth(), saveSecrets()])
    },
  })

  useEffect(() => {
    if (window.electronAPI?.getPath) {
      window.electronAPI.getPath('home').then((dir) => setHomeDir(dir))
    }
    if (window.electronAPI?.getPlatform) {
      window.electronAPI.getPlatform().then((value) => setPlatform(value))
    }
  }, [])

  // 自动检查所有工具的安装状态
  useEffect(() => {
    if (!platform || cliTools.length === 0) return

    const checkAllTools = async () => {
      appendInstallLog('正在检查已配置的 CLI 工具...')
      for (const tool of cliTools) {
        await checkToolInstalled(tool)
      }
      appendInstallLog('检查完成')
    }

    checkAllTools()
  }, [platform, cliTools, checkToolInstalled, appendInstallLog])

  useEffect(() => {
    if (!homeDir) return
    let cancelled = false

    const bootstrap = async () => {
      try {
        setLoading(true)
        await Promise.all([loadClaudeConfig(), loadCodexConfig(), loadCodexAuth()])
        if (!cancelled) {
          setStatus('AI CLI 配置已加载')
          await initialize()
        }
      } catch (error) {
        if (!cancelled) {
          const msg = getErrorMessage(error)
          setError(`初始化失败：${msg}`)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [
    getErrorMessage,
    homeDir,
    initialize,
    loadClaudeConfig,
    loadCodexAuth,
    loadCodexConfig,
    setError,
    setLoading,
    setStatus,
  ])

  const renderServiceKeyTab = (serviceId: ApiServiceId) => {
    const rows = apiKeys[serviceId]
    const meta = SERVICE_META[serviceId]

    return (
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {rows.length === 0 ? (
          <Empty description="暂无 API Keys" />
        ) : (
          rows.map((row, index) => (
            <div
              key={`${serviceId}-${index}-${row.id}`}
              style={{
                padding: 12,
                borderRadius: 8,
                border: `1px solid ${colors.borderPrimary}`,
                background: colors.bgSecondary,
              }}
            >
              <Space style={{ width: '100%' }} align="center" wrap>
                <Input
                  value={row.id}
                  placeholder="标识 ID (例如 main)"
                  style={{ minWidth: 140 }}
                  onChange={(e) => updateApiKeyRow(serviceId, index, 'id', e.target.value)}
                />
                <Input
                  value={row.key}
                  type={showApiKeys[serviceId] ? 'text' : 'password'}
                  placeholder={meta.placeholder}
                  style={{ minWidth: 200, flex: 1 }}
                  onChange={(e) => updateApiKeyRow(serviceId, index, 'key', e.target.value)}
                />
                <Input
                  value={row.url || ''}
                  placeholder={meta.defaultUrl}
                  style={{ minWidth: 200, flex: 1 }}
                  onChange={(e) => updateApiKeyRow(serviceId, index, 'url', e.target.value)}
                />
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  type="text"
                  onClick={() => removeApiKeyRow(serviceId, index)}
                />
              </Space>
            </div>
          ))
        )}

        <Space wrap>
          <Button icon={<PlusOutlined />} onClick={() => addApiKeyRow(serviceId)}>
            添加 {meta.label} Key
          </Button>
          <Switch
            checked={showApiKeys[serviceId]}
            onChange={(checked) => setShowApiKeys((prev) => ({ ...prev, [serviceId]: checked }))}
            checkedChildren="显示 Key"
            unCheckedChildren="隐藏 Key"
          />
        </Space>
      </Space>
    )
  }

  const renderSecretsTab = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <WidgetSection title="Secrets 文件">
        <Space direction="vertical" size="small">
          <Text>路径：{obsidianManager.getSecretsFilePath() || '未配置'}</Text>
          {!isObsidianEnabled && (
            <Alert
              type="warning"
              showIcon
              message="Obsidian 未启用"
              description="请在设置中启用 Obsidian 集成后再管理 API Keys。"
            />
          )}
        </Space>
      </WidgetSection>

      <WidgetSection title="API Keys 管理" icon={<KeyOutlined />}>
        <Tabs
          type="card"
          items={serviceIds.map((id) => ({
            key: id,
            label: `${SERVICE_META[id].emoji} ${SERVICE_META[id].label}`,
            children: renderServiceKeyTab(id),
          }))}
        />
      </WidgetSection>

      <Space wrap>
        <Button onClick={loadSecrets}>📥 从 Obsidian 加载</Button>
        <Button type="primary" onClick={saveSecrets}>
          💾 保存到 Obsidian
        </Button>
        <Button icon={<CloudSyncOutlined />} onClick={syncSecretsToTools}>
          同步到本地工具
        </Button>
        <Button icon={<ApiOutlined />} onClick={openSecretsInObsidian}>
          在 Obsidian 中打开
        </Button>
      </Space>

      <Alert type="info" showIcon message={secretsStatus} />
      <Alert
        type="warning"
        showIcon
        message="安全提示"
        description="• 建议将 secrets.md 添加到 .gitignore\n• 使用 Obsidian 加密功能保护敏感数据\n• 定期备份 Obsidian Vault"
      />
    </Space>
  )

  const anthropicOptions = apiKeys.cli_anthropic.map((item) => ({
    label: `${item.id || '未命名'} (${item.url || '默认 URL'})`,
    value: item.id || item.key,
    data: item,
  }))

  const renderClaudeTab = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <WidgetSection title="Claude 配置文件">
        <Text type="secondary">{claudeSettingsPath || '等待主目录...'}</Text>
        {anthropicOptions.length > 0 && (
          <>
            <Divider />
            <Space wrap style={{ width: '100%' }}>
              <Select
                placeholder="从 Obsidian API Keys 选择"
                style={{ minWidth: 300 }}
                options={anthropicOptions}
                onChange={(value) => {
                  const selected = anthropicOptions.find((item) => item.value === value)
                  if (selected?.data) {
                    setClaudeFields((prev) => ({
                      ...prev,
                      apiKey: selected.data.key,
                      baseUrl: selected.data.url || prev.baseUrl,
                    }))
                    message.info('已填充选中的 CLI Anthropic Key')
                  }
                }}
              />
              <Button onClick={loadSecrets}>刷新 Obsidian Keys</Button>
            </Space>
          </>
        )}
      </WidgetSection>

      <WidgetSection title="环境变量">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Input
            prefix="ANTHROPIC_BASE_URL"
            placeholder="https://api.anthropic.com"
            value={claudeFields.baseUrl}
            onChange={(e) => setClaudeFields((prev) => ({ ...prev, baseUrl: e.target.value }))}
          />
          <Input
            prefix="ANTHROPIC_AUTH_TOKEN"
            placeholder="sk-ant-oat01-..."
            type={claudeShowSecrets ? 'text' : 'password'}
            value={claudeFields.authToken}
            onChange={(e) => setClaudeFields((prev) => ({ ...prev, authToken: e.target.value }))}
          />
          <Input
            prefix="ANTHROPIC_API_KEY"
            placeholder="sk-ant-oat01-..."
            type={claudeShowSecrets ? 'text' : 'password'}
            value={claudeFields.apiKey}
            onChange={(e) => setClaudeFields((prev) => ({ ...prev, apiKey: e.target.value }))}
          />
          <Switch
            checked={claudeFields.disableTraffic}
            onChange={(checked) =>
              setClaudeFields((prev) => ({ ...prev, disableTraffic: checked }))
            }
            checkedChildren="禁用非必要流量"
            unCheckedChildren="允许非必要流量"
          />
          <Space align="center">
            <Switch
              checked={claudeShowSecrets}
              onChange={setClaudeShowSecrets}
              checkedChildren={<EyeOutlined />}
              unCheckedChildren={<EyeInvisibleOutlined />}
            />
            <Text type="secondary">{claudeShowSecrets ? '显示密钥' : '隐藏密钥'}</Text>
          </Space>
        </Space>
      </WidgetSection>

      <Space wrap>
        <Button icon={<ReloadOutlined />} onClick={loadClaudeConfig}>
          从配置文件加载
        </Button>
        <Button type="primary" onClick={() => saveClaudeConfig()}>
          保存到配置文件
        </Button>
        <Button icon={<FolderOpenOutlined />} onClick={openClaudeConfigFile}>
          打开配置文件
        </Button>
        <Button icon={<FileSearchOutlined />} onClick={viewClaudeConfig}>
          查看 JSON
        </Button>
      </Space>

      <Tag color={claudeStatus.includes('未') ? 'warning' : 'green'}>{claudeStatus}</Tag>
    </Space>
  )

  const renderCodexTab = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <WidgetSection title="Codex 配置">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space>
            <Text style={{ width: 120 }}>模型提供商</Text>
            <Select
              value={codexConfig.modelProvider}
              style={{ minWidth: 200 }}
              onChange={(value) => setCodexConfig((prev) => ({ ...prev, modelProvider: value }))}
            >
              <Option value="fox">Fox</Option>
              <Option value="openai">OpenAI</Option>
            </Select>
          </Space>
          <Space>
            <Text style={{ width: 120 }}>模型</Text>
            <Input
              value={codexConfig.model}
              onChange={(e) => setCodexConfig((prev) => ({ ...prev, model: e.target.value }))}
            />
          </Space>
          <Space>
            <Text style={{ width: 120 }}>Reasoning</Text>
            <Select
              value={codexConfig.reasoningEffort}
              style={{ minWidth: 200 }}
              onChange={(value) =>
                setCodexConfig((prev) => ({
                  ...prev,
                  reasoningEffort: value as CodexConfigState['reasoningEffort'],
                }))
              }
            >
              <Option value="minimal">minimal</Option>
              <Option value="low">low</Option>
              <Option value="medium">medium</Option>
              <Option value="high">high</Option>
            </Select>
          </Space>
          <Space>
            <Text style={{ width: 120 }}>Base URL</Text>
            <Input
              value={codexConfig.baseUrl}
              onChange={(e) => setCodexConfig((prev) => ({ ...prev, baseUrl: e.target.value }))}
            />
          </Space>
          <Space>
            <Text style={{ width: 120 }}>禁用响应存储</Text>
            <Switch
              checked={codexConfig.disableResponseStorage}
              onChange={(checked) =>
                setCodexConfig((prev) => ({ ...prev, disableResponseStorage: checked }))
              }
            />
          </Space>
          <Input
            prefix={<KeyOutlined />}
            placeholder="Codex OPENAI_API_KEY"
            type={codexShowKey ? 'text' : 'password'}
            value={codexAuthKey}
            onChange={(e) => setCodexAuthKey(e.target.value)}
          />
          <Space>
            <Switch
              checked={codexShowKey}
              onChange={setCodexShowKey}
              checkedChildren={<EyeOutlined />}
              unCheckedChildren={<EyeInvisibleOutlined />}
            />
            <Text type="secondary">{codexShowKey ? '显示 API Key' : '隐藏 API Key'}</Text>
          </Space>
        </Space>
      </WidgetSection>

      <Space wrap>
        <Button onClick={loadCodexConfig}>加载配置</Button>
        <Button onClick={loadCodexAuth}>加载 API Key</Button>
        <Button type="primary" onClick={saveCodexConfig}>
          保存配置
        </Button>
        <Button type="primary" onClick={() => saveCodexAuth()}>
          保存 API Key
        </Button>
        <Button icon={<FolderOpenOutlined />} onClick={openCodexDirectory}>
          打开配置目录
        </Button>
      </Space>

      <Tag color={codexStatus.includes('未') ? 'warning' : 'blue'}>{codexStatus}</Tag>
    </Space>
  )

  const renderSystemTab = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <WidgetSection title="Claude Code 配置">
        <Paragraph>
          路径：<code>{claudeSettingsPath || '未检测到'}</code>
        </Paragraph>
        <Space wrap>
          <Button icon={<FolderOpenOutlined />} onClick={openClaudeConfigFile}>
            打开文件
          </Button>
          <Button icon={<FileSearchOutlined />} onClick={viewClaudeConfig}>
            查看内容
          </Button>
        </Space>
        <Divider />
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          {Object.keys(claudeEnv).length === 0 && (
            <Text type="secondary">尚未读取到环境变量，保存后将自动创建。</Text>
          )}
          {Object.entries(claudeEnv).map(([key, value]) => (
            <Paragraph key={key} style={{ marginBottom: 0 }}>
              <strong>{key}:</strong> {maskSecretValue(String(value || ''))}
            </Paragraph>
          ))}
        </Space>
      </WidgetSection>

      <WidgetSection title="Codex 配置">
        <Paragraph>
          config.toml：<code>{codexConfigPath || '未检测到'}</code>
        </Paragraph>
        <Paragraph>
          auth.json：<code>{codexAuthPath || '未检测到'}</code>
        </Paragraph>
        <Space wrap>
          <Button icon={<FolderOpenOutlined />} onClick={openCodexDirectory}>
            打开配置目录
          </Button>
        </Space>
      </WidgetSection>

      <WidgetSection title="环境说明">
        <Paragraph>
          Claude Code 使用 JSON 配置文件 (~/.claude/settings.json)，主要字段位于 <code>env</code>{' '}
          节点。Codex 使用 TOML 配置 (~/.codex/config.toml) 与 auth.json。
        </Paragraph>
      </WidgetSection>
    </Space>
  )

  const renderInstallTab = () => {
    if (cliTools.length === 0) {
      return (
        <Alert
          type="info"
          showIcon
          message="未配置 CLI 工具"
          description="请在 config.toml 中的 ai_cli_tools 段落添加 CLI 工具配置。"
        />
      )
    }

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {cliTools.map((tool) => (
          <WidgetSection key={tool.command} title={`${tool.label} 安装`}>
            <Space wrap>
              <Tag color={installStatus[tool.command] === '已安装' ? 'green' : 'orange'}>
                {installStatus[tool.command] || '未知'}
              </Tag>
              <Button onClick={() => checkToolInstalled(tool)}>检查</Button>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                loading={installing[tool.command]}
                onClick={() => runInstallTool(tool)}
              >
                安装
              </Button>
              <Button onClick={() => recordInstallInstruction(tool)}>安装指引</Button>
            </Space>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                包名：<code>{tool.package}</code>
              </Text>
            </div>
          </WidgetSection>
        ))}

        <WidgetSection title="安装日志">
          <div
            style={{
              background: '#111',
              color: '#d6f2ff',
              minHeight: 120,
              maxHeight: 220,
              overflowY: 'auto',
              borderRadius: 6,
              padding: 12,
              fontFamily: 'Consolas, monospace',
              fontSize: 12,
            }}
          >
            {installLog.length === 0 ? (
              <Text type="secondary">暂无日志</Text>
            ) : (
              installLog.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)
            )}
          </div>
          <Space style={{ marginTop: 12 }}>
            <Button onClick={() => setInstallLog([])}>清空日志</Button>
          </Space>
        </WidgetSection>
      </Space>
    )
  }

  const tabs = [
    { key: 'secrets', label: 'API Keys', children: renderSecretsTab() },
    { key: 'claude', label: 'Claude Code', children: renderClaudeTab() },
    { key: 'codex', label: 'Codex', children: renderCodexTab() },
    { key: 'system', label: '系统信息', children: renderSystemTab() },
    { key: 'install', label: '安装管理', children: renderInstallTab() },
  ]

  return (
    <WidgetLayout
      title={metadata.displayName}
      icon={metadata.icon}
      loading={state.loading}
      error={state.error}
      showRefresh
      onRefresh={refresh}
      showSave
      onSave={save}
      actionInProgress={isActionInProgress}
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} />
    </WidgetLayout>
  )
}

export default AICliWidget
