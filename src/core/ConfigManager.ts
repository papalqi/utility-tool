import { AppConfig } from '../shared/types'
import { DEFAULT_VISIBLE_TABS } from '../config/widgetKeys'

/**
 * ConfigManager - Manages application configuration
 * Handles TOML config loading, saving, and hot-reloading
 */
class ConfigManager {
  private config: AppConfig | null = null
  private _configPath: string = ''
  private listeners: Array<(config: AppConfig) => void> = []

  /**
   * Initialize the config manager
   */
  async initialize(configPath?: string): Promise<void> {
    if (configPath) {
      this._configPath = configPath
    }
    await this.loadConfig()
  }

  /**
   * Get config path
   */
  getConfigPath(): string {
    return this._configPath
  }

  /**
   * Load configuration from file
   */
  async loadConfig(): Promise<AppConfig> {
    try {
      // In Electron, we'll use IPC to load the config from the main process
      // The configPath is used by the main process
      const config = await window.electronAPI.loadConfig()
      this.config = config as AppConfig
      this.notifyListeners()
      return this.config
    } catch (error) {
      console.error('Failed to load config:', error)
      // Return default config
      const defaultConfig = this.getDefaultConfig()
      this.config = defaultConfig
      return defaultConfig
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig(config: AppConfig): Promise<void> {
    try {
      await window.electronAPI.saveConfig(config)
      this.config = config
      this.notifyListeners()
    } catch (error) {
      console.error('Failed to save config:', error)
      throw error
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AppConfig {
    return this.config || this.getDefaultConfig()
  }

  /**
   * Get a specific config section
   */
  getSection<K extends keyof AppConfig>(section: K): AppConfig[K] {
    const config = this.getConfig()
    return config[section]
  }

  /**
   * Update a specific config section
   */
  async updateSection<K extends keyof AppConfig>(section: K, value: AppConfig[K]): Promise<void> {
    const config = this.getConfig()
    config[section] = value
    await this.saveConfig(config)
  }

  /**
   * Subscribe to config changes
   */
  subscribe(listener: (config: AppConfig) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * Notify all listeners of config changes
   */
  private notifyListeners(): void {
    if (this.config) {
      this.listeners.forEach((listener) => listener(this.config!))
    }
  }

  /**
   * Get default configuration
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
        server_url: '',
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
            note_folder: 'TodoNotes',
          },
        },
      },
    }
  }

  /**
   * Get Obsidian config for current computer
   */
  async getObsidianConfig(): Promise<{
    enabled: boolean
    vault_path?: string
    secrets_file?: string
  }> {
    const hostname = await this.getHostname()
    const config = this.getConfig()
    const computerConfig = config.computer[hostname]

    if (computerConfig?.obsidian) {
      return computerConfig.obsidian
    }

    return { enabled: false }
  }

  /**
   * Get current hostname
   */
  private async getHostname(): Promise<string> {
    // This would be implemented via IPC in the actual app
    return 'default'
  }
}

export const configManager = new ConfigManager()
export default ConfigManager
