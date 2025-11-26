/**
 * Electron 主进程配置管理
 * 使用 @iarna/toml 解析 TOML 配置文件
 * 使用 chokidar 监控文件变化
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import * as TOML from '@iarna/toml'
import * as chokidar from 'chokidar'
import { hostname } from 'os'
import log from './logger'

const DEFAULT_VISIBLE_TABS = [
  'settings',
  'ai-cli',
  'generic-ai',
  'ai-chat',
  'todo',
  'pomodoro',
  'calendar',
  'scripts',
  'environment',
  'terminal',
  'renderdoc',
  'adb',
  'projects',
  'github',
]

export interface AppConfig {
  scripts: Array<{
    name: string
    path: string
    group?: string
    schedule?: string
    parameters?: string
  }>
  quick_access: Array<{
    name: string
    path: string
    type: 'url' | 'app'
    category?: string
    icon?: string
  }>
  icons: {
    default_folder: string
    default_app_icon: string
    default_url_icon: string
  }
  theme: {
    current: 'light' | 'dark'
    auto_switch: boolean
    dark_mode_start_time?: string
    light_mode_start_time?: string
  }
  pomodoro: {
    work_duration: number
    short_break_duration: number
    long_break_duration: number
    long_break_interval: number
    notification_sound?: string
  }
  markdown_log: {
    file_path: string
  }
  adb: {
    adb_path: string
    refresh_interval: number
    default_download_dir?: string
  }
  project_manager: {
    projects: string[]
    auto_sync: boolean
    default_build_config: string
  }
  attachment: {
    storage_mode: 'local' | 'picgo'
    local_path?: string
    picgo_path?: string
    picgo_server_url?: string
    use_picgo_server: boolean
    auto_upload_threshold: number
    markdown_format: 'obsidian' | 'standard'
  }
  file_transfer: {
    server_url: string
  }
  terminal: {
    default_shell: 'auto' | 'bash' | 'zsh' | 'powershell' | 'cmd'
  }
  ui: {
    visible_tabs: string[]
  }
  ai_apis: Record<string, unknown>
  ai_cli_tools?: Array<{
    command: string
    package: string
    label: string
  }>
  todo: {
    ai_parser: {
      selected_provider_id: string
      max_clipboard_length: number
      prompt_template_path: string
    }
  }
  calendar: {
    categories: Record<
      string,
      {
        name: string
        color: string
      }
    >
  }
  computer: Record<
    string,
    {
      obsidian?: {
        enabled: boolean
        vault_path: string
        secrets_file: string
      }
      project_manager?: {
        projects: string[]
      }
    }
  >
  global: {
    obsidian: {
      content_files: {
        todo_template?: string
        calendar_template?: string
        pomodoro_template?: string
        mode: 'auto' | 'manual'
        template: string
        manual_file?: string
      }
      todo: {
        auto_save: boolean
        save_interval: number
        enabled: boolean
        categories: string[]
      }
    }
  }
}

/**
 * 配置管理器类
 */
class ConfigManager {
  private config: AppConfig | null = null
  private defaultConfigPath: string
  private savedConfigDir: string
  private savedConfigPath: string
  private watcher: chokidar.FSWatcher | null = null
  private hostname: string
  private isSaving = false
  private changeListeners: Array<(config: AppConfig) => void> = []

  constructor() {
    // 确定配置文件路径
    if (process.env.NODE_ENV === 'development') {
      this.defaultConfigPath = join(process.cwd(), 'config', 'config.toml')
      this.savedConfigDir = join(process.cwd(), 'Saved')
    } else {
      this.defaultConfigPath = join(
        process.resourcesPath,
        'config',
        'config.toml'
      )
      this.savedConfigDir = join(app.getPath('userData'), 'Saved')
    }

    this.savedConfigPath = join(this.savedConfigDir, 'config.toml')

    // 获取主机名
    this.hostname = hostname().split('.')[0].toLowerCase()

    log.info('ConfigManager initialized', {
      defaultConfigPath: this.defaultConfigPath,
      savedConfigPath: this.savedConfigPath,
      hostname: this.hostname,
    })
  }

  /**
   * 初始化配置管理器
   */
  async initialize(): Promise<void> {
    // 加载配置
    await this.loadConfig()

    // 开始监控配置文件变化
    this.startWatching()
  }

  /**
   * 加载配置文件
   */
  async loadConfig(): Promise<AppConfig> {
    try {
      const baseConfigFromFile = this.readConfigFile(this.defaultConfigPath)

      if (!baseConfigFromFile) {
        log.warn('Default config file not found, using internal defaults', {
          defaultConfigPath: this.defaultConfigPath,
        })
      }

      let mergedConfig: AppConfig =
        (baseConfigFromFile as AppConfig | null) ?? this.getDefaultConfig()

      const savedOverrides = this.readConfigFile(this.savedConfigPath)

      if (savedOverrides) {
        mergedConfig = this.mergeConfigs(
          mergedConfig,
          savedOverrides as Record<string, unknown>
        )
      }

      this.config = mergedConfig
      log.info('Config loaded successfully', {
        hasSavedOverrides: Boolean(savedOverrides),
      })

      // 通知监听器
      this.notifyListeners()

      return this.config
    } catch (error) {
      log.error('Failed to load config', error)
      this.config = this.getDefaultConfig()
      return this.config
    }
  }

  /**
   * 保存配置文件
   */
  async saveConfig(config: AppConfig): Promise<void> {
    try {
      this.isSaving = true

      const tomlString = TOML.stringify(config as unknown as TOML.JsonMap)
      this.ensureSavedDirectory()
      writeFileSync(this.savedConfigPath, tomlString, 'utf-8')

      this.config = config
      log.info('Config saved successfully')

      // 通知监听器
      this.notifyListeners()
    } catch (error) {
      log.error('Failed to save config', error)
      throw error
    } finally {
      // 延迟重置标志，避免立即触发文件变化事件
      setTimeout(() => {
        this.isSaving = false
      }, 500)
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): AppConfig {
    return this.config || this.getDefaultConfig()
  }

  /**
   * 获取配置的某个部分
   */
  getSection<K extends keyof AppConfig>(section: K): AppConfig[K] {
    const config = this.getConfig()
    return config[section]
  }

  /**
   * 更新配置的某个部分
   */
  async updateSection<K extends keyof AppConfig>(
    section: K,
    value: AppConfig[K]
  ): Promise<void> {
    const config = this.getConfig()
    config[section] = value
    await this.saveConfig(config)
  }

  /**
   * 获取当前主机的 Obsidian 配置
   */
  getObsidianConfig() {
    const config = this.getConfig()
    const computerConfig = config.computer[this.hostname]

    if (computerConfig?.obsidian) {
      return computerConfig.obsidian
    }

    return { enabled: false }
  }

  /**
   * 获取主机名
   */
  getHostname(): string {
    return this.hostname
  }

  /**
   * 获取 Saved 配置文件路径
   */
  getSavedConfigPath(): string {
    return this.savedConfigPath
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): AppConfig {
    return {
      scripts: [],
      quick_access: [],
      icons: {
        default_folder: 'assets/icons',
        default_app_icon: '🚀',
        default_url_icon: '🌐',
      },
      theme: {
        current: 'dark',
        auto_switch: false,
        dark_mode_start_time: '18:00',
        light_mode_start_time: '08:00',
      },
      pomodoro: {
        work_duration: 25,
        short_break_duration: 5,
        long_break_duration: 15,
        long_break_interval: 4,
      },
      markdown_log: {
        file_path: '',
      },
      adb: {
        adb_path: 'adb',
        refresh_interval: 0,
        default_download_dir: '',
      },
      project_manager: {
        projects: [],
        auto_sync: false,
        default_build_config: 'Development',
      },
      attachment: {
        storage_mode: 'local',
        use_picgo_server: false,
        auto_upload_threshold: 5242880,
        markdown_format: 'obsidian',
      },
      file_transfer: {
        server_url: 'http://localhost:3000/api',
      },
      terminal: {
        default_shell: 'auto',
      },
      ui: {
        visible_tabs: [...DEFAULT_VISIBLE_TABS],
      },
      ai_apis: {},
      todo: {
        ai_parser: {
          selected_provider_id: 'deepseek',
          max_clipboard_length: 10000,
          prompt_template_path: 'prompts/ai_todo_parser.md',
        },
      },
      calendar: {
        categories: {
          default: {
            name: '默认',
            color: '#546E7A',
          },
        },
      },
      computer: {},
      global: {
        obsidian: {
          content_files: {
            mode: 'auto',
            template: '{year}-W{week}.md',
          },
          todo: {
            auto_save: false,
            save_interval: 200,
            enabled: false,
            categories: ['工作', '学习', '生活'],
          },
        },
      },
    }
  }

  /**
   * 开始监控配置文件变化
   */
  private startWatching(): void {
    if (this.watcher) {
      return
    }

    this.watcher = chokidar.watch(
      [this.defaultConfigPath, this.savedConfigPath],
      {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      }
    )

    const handleChange = (changedPath: string) => {
      if (this.isSaving && changedPath === this.savedConfigPath) {
        log.debug('Config file changed by save operation, skipping reload')
        return
      }

      log.info('Config file changed, reloading...', {
        changedPath,
      })
      this.loadConfig()
    }

    this.watcher.on('change', handleChange)
    this.watcher.on('add', handleChange)

    log.info('Config file watcher started', {
      watching: [this.defaultConfigPath, this.savedConfigPath],
    })
  }

  /**
   * 停止监控
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
      log.info('Config file watcher stopped')
    }
  }

  /**
   * 添加配置变化监听器
   */
  addChangeListener(listener: (config: AppConfig) => void): void {
    this.changeListeners.push(listener)
  }

  /**
   * 移除配置变化监听器
   */
  removeChangeListener(listener: (config: AppConfig) => void): void {
    const index = this.changeListeners.indexOf(listener)
    if (index > -1) {
      this.changeListeners.splice(index, 1)
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    if (!this.config) return

    this.changeListeners.forEach((listener) => {
      try {
        listener(this.config!)
      } catch (error) {
        log.error('Error in config change listener', error)
      }
    })
  }


  /**
   * ȷ�� Saved Ŀ¼����
   */
  private ensureSavedDirectory(): void {
    if (!existsSync(this.savedConfigDir)) {
      mkdirSync(this.savedConfigDir, { recursive: true })
    }
  }

  /**
   * ��ȡָ�������ļ�
   */
  private readConfigFile(
    filePath: string
  ): Record<string, unknown> | null {
    if (!existsSync(filePath)) {
      return null
    }

    try {
      const content = readFileSync(filePath, 'utf-8')

      if (!content.trim()) {
        return {}
      }

      return TOML.parse(content) as Record<string, unknown>
    } catch (error) {
      log.error('Failed to read config file', {
        filePath,
        error,
      })
      return null
    }
  }

  /**
   * ���ö�������
   */
  private mergeConfigs<T>(
    base: T,
    overrides: Record<string, unknown>
  ): T {
    if (!this.isMergeableObject(base)) {
      return overrides as T
    }

    const result: Record<string, unknown> = {
      ...(base as Record<string, unknown>),
    }

    Object.entries(overrides).forEach(([key, value]) => {
      const currentValue = result[key]

      if (
        this.isMergeableObject(currentValue) &&
        this.isMergeableObject(value)
      ) {
        result[key] = this.mergeConfigs(
          currentValue,
          value as Record<string, unknown>
        )
        return
      }

      result[key] = value
    })

    return result as T
  }

  /**
   * �ж����Ƿ����ϲ�
   */
  private isMergeableObject(
    value: unknown
  ): value is Record<string, unknown> {
    return (
      value !== null && typeof value === 'object' && !Array.isArray(value)
    )
  }


  /**
   * 清理资源
   */
  destroy(): void {
    this.stopWatching()
    this.changeListeners = []
  }
}

// 导出单例
export const configManager = new ConfigManager()
export default ConfigManager
