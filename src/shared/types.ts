// Configuration types based on the Python version's config.toml structure

export interface ScriptConfig {
  name: string
  path: string
  group?: string
  schedule?: string
  parameters?: string
}

export interface QuickAccessItem {
  name: string
  path: string
  type: 'url' | 'app'
  category?: string
  icon?: string
}

export interface IconConfig {
  default_folder: string
  default_app_icon: string
  default_url_icon: string
}

export interface ThemeConfig {
  current: 'light' | 'dark'
  auto_switch: boolean
  dark_mode_start_time?: string
  light_mode_start_time?: string
}

export interface PomodoroConfig {
  work_duration: number
  short_break_duration: number
  long_break_duration: number
  long_break_interval: number
  notification_sound?: string
}

export interface MarkdownLogConfig {
  file_path: string
}

export interface ADBConfig {
  adb_path: string
  refresh_interval: number
  default_download_dir?: string
}

export interface ProjectManagerConfig {
  projects: string[]
  auto_sync: boolean
  default_build_config: string
}

export interface AttachmentConfig {
  storage_mode: 'local' | 'picgo'
  local_path?: string
  picgo_path?: string
  picgo_mode?: 'server' | 'cli' // �����ֶΣ��������ر�ʾ PicGo ģʽ
  picgo_server_url?: string
  use_picgo_server: boolean // �������ֶΣ��� picgo_mode ͬ��
  auto_upload_threshold: number
  markdown_format: 'obsidian' | 'standard'
}

export interface FileTransferConfig {
  server_url: string
}

export interface AIParserConfig {
  selected_provider_id: string
  max_clipboard_length: number
  prompt_template_path: string
}

export interface SSHProfile {
  id: string
  name: string
  host: string
  user?: string
  port?: number
  identity_file?: string
  identity_pem?: string
  description?: string
  extra_args?: string
  local_workdir?: string
}

export interface TerminalConfig {
  default_shell: 'auto' | 'bash' | 'zsh' | 'powershell' | 'cmd'
}

export interface UIConfig {
  visible_tabs: string[]
}

export interface CalendarCategory {
  name: string
  color: string
}

export interface ObsidianConfig {
  enabled: boolean
  vault_path: string
  secrets_file: string
}

export interface ObsidianContentFilesConfig {
  todo_template?: string
  calendar_template?: string
  pomodoro_template?: string
  mode: 'auto' | 'manual'
  template: string
  manual_file?: string
}

export interface ObsidianTodoConfig {
  auto_save: boolean
  save_interval: number
  enabled: boolean
  categories: string[]
  note_folder?: string
}

export interface AICliToolConfig {
  command: string
  package: string
  label: string
}

export interface AppConfig {
  scripts: ScriptConfig[]
  quick_access: QuickAccessItem[]
  icons: IconConfig
  theme: ThemeConfig
  pomodoro: PomodoroConfig
  markdown_log: MarkdownLogConfig
  adb: ADBConfig
  project_manager: ProjectManagerConfig
  attachment: AttachmentConfig
  file_transfer: FileTransferConfig
  terminal: TerminalConfig
  ui: UIConfig
  ai_apis: Record<string, unknown>
  ai_cli_tools?: AICliToolConfig[]
  todo: {
    ai_parser: AIParserConfig
  }
  calendar: {
    categories: Record<string, CalendarCategory>
  }
  computer: Record<
    string,
    {
      obsidian?: ObsidianConfig
      project_manager?: ProjectManagerConfig
    }
  >
  global: {
    obsidian: {
      content_files: ObsidianContentFilesConfig
      todo: ObsidianTodoConfig
    }
  }
}

// Widget types
export interface WidgetProps {
  // Common props that all widgets receive
}

export interface Attachment {
  name: string
  path: string
  type: 'image' | 'video' | 'file'
  size?: number
  storage_mode?: 'local' | 'picgo'
}

export interface TodoItem {
  id: string
  text: string // �����ı�
  done: boolean // �Ƿ����
  category?: string // ����
  dueDate?: string | null // ��ֹ����
  priority?: 'low' | 'medium' | 'high'
  tags?: string[]
  createdAt: number // ʱ���
  updatedAt: number // ʱ���
  note?: string // �ʼ� - ��¼�����е�����
  conclusion?: string // ���� - ���ն���
  attachments?: Attachment[] // �����б�
  /** 父任务 ID；用于表示子任务层级 */
  parentId?: string
}

export interface PomodoroSession {
  id: string
  task: string // ��������
  date: string // ���� YYYY-MM-DD
  startTime: string // ��ʼʱ�� HH:MM
  endTime: string // ����ʱ�� HH:MM
  duration: number // ʱ��(����)
  category?: string // ����
  completed: boolean // �Ƿ����
  createdAt: number // ʱ���
}

export interface CalendarEvent {
  id: string
  title: string // �¼�����
  date: string // ���� YYYY-MM-DD
  time: string // ʱ�� HH:MM
  endTime?: string | null // ����ʱ�� HH:MM
  durationMinutes?: number // ����ʱ�������ӣ�
  allDay?: boolean // �Ƿ�ȫ��
  category?: string // ����
  description?: string
  createdAt: number // ʱ���
}

// ========== Project ������� ==========
export interface Project {
  name: string // ��Ŀ����
  path: string // ��Ŀ·��
  engine_version: 'UE4' | 'UE5' | 'Unity' | 'Custom' // ����汾
  build_config: 'Development' | 'Shipping' | 'Debug' | 'Test' // ��������
  platform: 'Win64' | 'Android' | 'iOS' | 'Linux' | 'Mac' // Ŀ��ƽ̨
  p4_server?: string // P4 ��������ַ
  p4_user?: string // P4 �û���
  p4_charset?: string // P4 �ַ���
  p4_workspace?: string // P4 ����������
  rider_path?: string // Rider IDE ·��
}
