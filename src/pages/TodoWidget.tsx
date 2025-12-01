import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Button, Space, Typography, Row, Col, App, Form } from 'antd'
import { SyncOutlined, SettingOutlined } from '@ant-design/icons'
import { WidgetLayout } from '@/components/widgets'
import { useWidget } from '@/hooks/useWidget'
import { useWidgetActions } from '@/hooks/useWidgetActions'
import { useWidgetObsidian } from '@/hooks/useWidgetObsidian'
import { useConfig } from '@/hooks/useConfig'
import type { TodoItem, Attachment, AIParserConfig } from '@/shared/types'
import type { GenericAIConfig } from '@/shared/ai'
import { AttachmentManager } from '@/utils/AttachmentManager'
import { useAppContext } from '@/context/AppContext'
import { useNavigation } from '@/context/NavigationContext'
import { TodoAIPreviewModal, TodoAISuggestion } from '@/components/todo/TodoAIPreviewModal'
import { parseAiTodoMarkdown, ParsedAiTodoItem } from '@/utils/todoAiParser'
import aiClient from '@/services/aiClient'
import { obsidianManager } from '@/core/ObsidianManager'
import { configManager } from '@/core/ConfigManager'
import dayjs from 'dayjs'
import {
  DEFAULT_CATEGORIES,
  DEFAULT_TEMPLATE,
  TODO_WIDGET_METADATA,
  extractObsidianLinkTarget,
  stripObsidianLinks,
} from './todo/constants'
import { TodoFormModal } from './todo/components/TodoFormModal'
import { TodoListPanel } from './todo/components/TodoListPanel'
import { TodoDetailsPanel } from './todo/components/TodoDetailsPanel'
import { TodoAiClipboardModal } from './todo/components/TodoAiClipboardModal'
import type { TodoFormValues } from './todo/types'

const { Text, Paragraph } = Typography

const normalizeDoneValue = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return ['true', '1', 'yes', 'y', 'checked'].includes(normalized)
  }
  if (typeof value === 'number') {
    return value !== 0
  }
  return Boolean(value)
}

const normalizeTodoItems = (items: TodoItem[]): TodoItem[] =>
  items.map((item) => ({
    ...item,
    done: normalizeDoneValue(item.done),
  }))

export const TodoWidget: React.FC = () => {
  const { message, modal } = App.useApp()
  useAppContext() // 保持 context 连接
  useNavigation() // 保持 navigation 连接
  const config = useConfig()
  const [form] = Form.useForm<TodoFormValues>()

  const { state, setStatus, setError, widgetLogger, isVisible } = useWidget({
    metadata: TODO_WIDGET_METADATA,
  })

  // Data
  const [todoItems, setTodoItems] = useState<TodoItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('全部分类')
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES)
  const [syncStatus, setSyncStatus] = useState<string>('等待同步...')

  // UI state
  const [selectedTodo, setSelectedTodo] = useState<TodoItem | null>(null)
  const [addDialogVisible, setAddDialogVisible] = useState<boolean>(false)
  const [editDialogVisible, setEditDialogVisible] = useState<boolean>(false)
  const [quickAddCategory, setQuickAddCategory] = useState<string>('默认')
  const [currentAttachments, setCurrentAttachments] = useState<Attachment[]>([])
  // 防重复点击创建 Obsidian 笔记
  const [creatingNoteIds, setCreatingNoteIds] = useState<Set<string>>(new Set())
  // 防止重复加载
  const initialLoadDoneRef = useRef(false)

  const initialAiParserConfig = useMemo<AIParserConfig>(
    () => ({
      selected_provider_id:
        config.todo?.ai_parser?.selected_provider_id ||
        configManager.getConfig().todo?.ai_parser?.selected_provider_id ||
        '',
      max_clipboard_length:
        config.todo?.ai_parser?.max_clipboard_length ||
        configManager.getConfig().todo?.ai_parser?.max_clipboard_length ||
        10000,
      prompt_template_path:
        config.todo?.ai_parser?.prompt_template_path ||
        configManager.getConfig().todo?.ai_parser?.prompt_template_path ||
        'prompts/ai_todo_parser.md',
    }),
    [config.todo?.ai_parser]
  )

  const [aiParsingConfig, setAiParsingConfig] = useState<AIParserConfig>(initialAiParserConfig)
  const [aiProviders, setAiProviders] = useState<GenericAIConfig[]>([])
  const [selectedAiProviderId, setSelectedAiProviderId] = useState<string>(
    initialAiParserConfig.selected_provider_id
  )
  const [clipboardModalVisible, setClipboardModalVisible] = useState(false)
  const [aiClipboardText, setAiClipboardText] = useState('')
  const [aiPreviewVisible, setAiPreviewVisible] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<TodoAISuggestion[]>([])
  const [aiLoading, setAiLoading] = useState(false)

  const template = useMemo(
    () => config.global?.obsidian?.content_files?.template || DEFAULT_TEMPLATE,
    [config]
  )
  const templateRelativePath = useMemo(() => {
    const vaultPath = obsidianManager.getVaultPath()
    if (!vaultPath) return undefined
    try {
      const absolute = obsidianManager.getTemplatePath(template)
      const normalizedVault = vaultPath.replace(/\\/g, '/').replace(/\/+$/, '')
      const normalizedAbsolute = absolute.replace(/\\/g, '/')
      if (normalizedAbsolute.startsWith(`${normalizedVault}/`)) {
        return normalizedAbsolute.slice(normalizedVault.length + 1)
      }
      return undefined
    } catch {
      return undefined
    }
  }, [template])
  const todoConfig = config.global?.obsidian?.todo
  const autoSaveEnabled = todoConfig?.auto_save !== false
  const autoSaveIntervalMs = Math.max(todoConfig?.save_interval || 10, 5) * 1000
  const noteFolder = todoConfig?.note_folder || 'TodoNotes'

  const handleObsidianError = useCallback(
    (err: Error) => {
      message.error(`Obsidian 同步失败: ${err.message}`)
    },
    [message]
  )

  const {
    isEnabled,
    syncing,
    reading,
    lastSyncTime,
    error: obsidianError,
    sync,
    read,
  } = useWidgetObsidian<TodoItem>({
    widgetId: TODO_WIDGET_METADATA.id,
    dataType: 'todo',
    template,
    autoSync: autoSaveEnabled && isVisible,
    syncInterval: autoSaveIntervalMs,
    onError: handleObsidianError,
  })

  useEffect(() => {
    if (obsidianError) {
      setError(obsidianError)
    } else {
      setError(null)
    }
  }, [obsidianError, setError])

  useEffect(() => {
    setAiParsingConfig(initialAiParserConfig)
    if (initialAiParserConfig.selected_provider_id) {
      setSelectedAiProviderId(initialAiParserConfig.selected_provider_id)
    }
  }, [initialAiParserConfig])

  const ensureTodoFilePresence = useCallback(async (): Promise<boolean> => {
    if (!isEnabled || !window.electronAPI?.readFile) {
      return true
    }

    const filePath = obsidianManager.getTemplatePath(template)
    try {
      await window.electronAPI.readFile(filePath)
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      widgetLogger.warn('TODO file missing, asking user to create', {
        path: filePath,
        error: errorMessage,
      })
      return await new Promise<boolean>((resolve) => {
        modal.confirm({
          title: 'TODO 文件缺失',
          content: `未找到当前模板对应的 TODO 文件：\n${filePath}\n是否立即创建？`,
          okText: '创建并继续',
          cancelText: '取消',
          onOk: async () => {
            try {
              await obsidianManager.ensureTodoFile(template)
              message.success('已创建 TODO 文件')
              resolve(true)
            } catch (createError) {
              const createMessage =
                createError instanceof Error ? createError.message : String(createError)
              message.error(`创建 TODO 文件失败：${createMessage}`)
              resolve(false)
            }
          },
          onCancel: () => resolve(false),
        })
      })
    }
  }, [isEnabled, template, modal, message, widgetLogger])

  const loadTodos = useCallback(async () => {
    if (!isEnabled) {
      setStatus('请先在设置中配置 Obsidian Vault')
      setTodoItems([])
      return
    }

    try {
      const fileReady = await ensureTodoFilePresence()
      if (!fileReady) {
        setStatus('等待创建 TODO 文件')
        return
      }

      setStatus('正在从 Obsidian 读取 TODO...')
      widgetLogger.info('Loading TODO items from Obsidian', { template })
      const items = await read()
      const normalizedItems = normalizeTodoItems(items)
      setTodoItems(normalizedItems)
      setStatus(`已加载 ${items.length} 个任务`)
      widgetLogger.info('Loaded TODO items', { count: items.length })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setError(`读取 TODO 失败: ${errorMessage}`)
      widgetLogger.error('Failed to load TODO items', error as Error)
    }
  }, [ensureTodoFilePresence, isEnabled, read, setStatus, setError, widgetLogger, template])

  const loadAiProviders = useCallback(async () => {
    try {
      const configs = await obsidianManager.getGenericAIConfigs()
      setAiProviders(configs)
      if (!selectedAiProviderId && configs.length > 0) {
        setSelectedAiProviderId(configs[0].id)
      }
    } catch (error) {
      widgetLogger.error('Failed to load AI providers', error as Error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateAiParserSettings = useCallback(
    async (updates: Partial<AIParserConfig>) => {
      const current = configManager.getConfig()
      const existing = current.todo?.ai_parser || initialAiParserConfig
      const merged = { ...existing, ...aiParsingConfig, ...updates }
      const nextConfig = {
        ...current,
        todo: {
          ...current.todo,
          ai_parser: merged,
        },
      }
      await configManager.saveConfig(nextConfig)
      setAiParsingConfig(merged)
    },
    [aiParsingConfig, initialAiParserConfig]
  )

  const handleManualSync = useCallback(async () => {
    if (!isEnabled) {
      return
    }
    widgetLogger.info('Manual sync triggered from TODO widget')
    await sync(todoItems)
  }, [isEnabled, sync, todoItems, widgetLogger])

  const { refresh, save, isActionInProgress } = useWidgetActions({
    widgetId: TODO_WIDGET_METADATA.id,
    onRefresh: loadTodos,
    onSave: handleManualSync,
  })

  const dedupeTodoItems = useCallback((items: TodoItem[]): TodoItem[] => {
    const seen = new Set<string>()
    const result: TodoItem[] = []
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const item = items[i]
      if (seen.has(item.id)) {
        continue
      }
      seen.add(item.id)
      result.push(item)
    }
    return result.reverse()
  }, [])

  const applyTodoUpdate = useCallback(
    (updater: (items: TodoItem[]) => TodoItem[]) => {
      setTodoItems((prev) => {
        const next = dedupeTodoItems(updater(prev))
        if (isEnabled) {
          void sync(next)
        }
        return next
      })
    },
    [dedupeTodoItems, isEnabled, sync]
  )

  const actionInProgress = isActionInProgress || syncing

  /**
   * Load data when Obsidian 可用
   * 使用 ref 防止重复加载
   */
  useEffect(() => {
    if (!isVisible) {
      // 当离开页面时，重置标记以便下次进入时重新加载
      initialLoadDoneRef.current = false
      return
    }

    // 防止重复加载
    if (initialLoadDoneRef.current) {
      return
    }

    if (isEnabled) {
      initialLoadDoneRef.current = true
      loadTodos()
    } else {
      setStatus('请在设置中配置 Obsidian Vault')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled, isVisible])

  useEffect(() => {
    loadAiProviders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Apply filter - use useMemo to avoid extra render cycles
   */
  const filteredItems = useMemo(() => {
    if (selectedCategory === '全部分类') {
      return todoItems
    }
    return todoItems.filter((item) => item.category === selectedCategory)
  }, [todoItems, selectedCategory])

  // 键盘快捷键：Tab 缩进、Shift+Tab 提升、Enter 新建同级、Ctrl+Enter 新建子级
  useEffect(() => {
    if (!isVisible) {
      return
    }

    const isEditableTarget = (el: EventTarget | null) => {
      const node = el as HTMLElement | null
      if (!node) return false
      const tag = (node.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return true
      if ((node as any).isContentEditable) return true
      return false
    }

    const handler = (e: KeyboardEvent) => {
      if (!selectedTodo) return
      // 不在编辑输入时才生效
      if (isEditableTarget(e.target)) return

      const activeItemsLocal = filteredItems.filter((it) => !it.done)
      const idx = activeItemsLocal.findIndex((it) => it.id === selectedTodo.id)
      if (idx === -1) return

      if (e.key === 'Tab') {
        e.preventDefault()
        // 当前仅对未完成任务列表生效
        const items = activeItemsLocal
        const current = items[idx]
        if (!current) return

        if (e.shiftKey) {
          // 提升（Outdent）：将当前任务的 parentId 设置为其父任务的 parentId（或 undefined）
          const parent = filteredItems.find((it) => it.id === current.parentId)
          const newParentId = parent?.parentId
          applyTodoUpdate((all) =>
            all.map((it) =>
              it.id === current.id ? { ...it, parentId: newParentId, updatedAt: Date.now() } : it
            )
          )
          message.success('已提升层级')
        } else {
          // 缩进（Indent）：将当前任务归为上一条任务的子任务
          if (idx > 0) {
            const prev = items[idx - 1]
            if (prev && prev.id !== current.id) {
              applyTodoUpdate((all) =>
                all.map((it) =>
                  it.id === current.id ? { ...it, parentId: prev.id, updatedAt: Date.now() } : it
                )
              )
              message.success('已缩进为子任务')
            }
          }
        }
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        const now = Date.now()
        const child: TodoItem = {
          id: `todo-${now}`,
          text: '',
          done: false,
          category: selectedTodo.category || quickAddCategory,
          priority: selectedTodo.priority || 'medium',
          createdAt: now,
          updatedAt: now,
          parentId: selectedTodo.id,
        }
        applyTodoUpdate((items) => [...items, child])
        message.success('已创建子任务（空文本，回车后编辑）')
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const now = Date.now()
        const sibling: TodoItem = {
          id: `todo-${now}`,
          text: '',
          done: false,
          category: selectedTodo.category || quickAddCategory,
          priority: selectedTodo.priority || 'medium',
          createdAt: now,
          updatedAt: now,
          parentId: selectedTodo.parentId,
        }
        applyTodoUpdate((items) => [...items, sibling])
        message.success('已创建同级任务（空文本，回车后编辑）')
      }
    }

    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [applyTodoUpdate, filteredItems, isVisible, message, quickAddCategory, selectedTodo])

  /**
   * Keep categories in sync with items
   */
  useEffect(() => {
    const uniqueCategories = new Set(DEFAULT_CATEGORIES)
    todoItems.forEach((item) => {
      if (item.category) {
        uniqueCategories.add(item.category)
      }
    })
    setCategories(Array.from(uniqueCategories).sort())
  }, [todoItems])

  /**
   * Update sync status indicator
   */
  useEffect(() => {
    if (!isEnabled) {
      setSyncStatus('❌ Obsidian 未启用')
      return
    }

    if (reading) {
      setSyncStatus('📥 正在读取 Obsidian...')
      return
    }

    if (syncing) {
      setSyncStatus('🔄 同步中...')
      return
    }

    if (obsidianError) {
      setSyncStatus(`❌ 同步失败: ${obsidianError}`)
      return
    }

    if (lastSyncTime) {
      const timeStr = lastSyncTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      setSyncStatus(`✅ 已同步 - ${timeStr}`)
    } else {
      setSyncStatus('等待同步...')
    }
  }, [isEnabled, reading, syncing, obsidianError, lastSyncTime])

  /**
   * Toggle completion
   * When a parent is completed/incompleted, propagate the same state to all descendants
   */
  const handleToggleComplete = useCallback(
    (record: TodoItem) => {
      applyTodoUpdate((items) => {
        const nextDone = !record.done
        const childMap = items.reduce<Map<string, string[]>>((map, item) => {
          if (item.parentId) {
            if (!map.has(item.parentId)) {
              map.set(item.parentId, [])
            }
            map.get(item.parentId)!.push(item.id)
          }
          return map
        }, new Map())

        const descendants = new Set<string>()
        const collectDescendants = (id: string) => {
          const children = childMap.get(id)
          if (!children) return
          for (const childId of children) {
            if (!descendants.has(childId)) {
              descendants.add(childId)
              collectDescendants(childId)
            }
          }
        }
        collectDescendants(record.id)

        const updatedAt = Date.now()
        return items.map((item) => {
          if (item.id === record.id || descendants.has(item.id)) {
            return { ...item, done: nextDone, updatedAt }
          }
          return item
        })
      })
    },
    [applyTodoUpdate]
  )

  const handleCategoryChange = useCallback(
    (id: string, category: string) => {
      applyTodoUpdate((items) =>
        items.map((item) => (item.id === id ? { ...item, category, updatedAt: Date.now() } : item))
      )
    },
    [applyTodoUpdate]
  )

  const handlePriorityChange = useCallback(
    (id: string, priority: 'low' | 'medium' | 'high') => {
      applyTodoUpdate((items) =>
        items.map((item) => (item.id === id ? { ...item, priority, updatedAt: Date.now() } : item))
      )
    },
    [applyTodoUpdate]
  )

  const handleReorderTodos = useCallback(
    (itemId: string, newParentId: string | null) => {
      applyTodoUpdate((items) => {
        const normalizedParentId = newParentId ?? undefined
        const updatedAt = Date.now()
        let changed = false
        const nextItems = items.map((item) => {
          if (item.id !== itemId) return item
          if (item.parentId === normalizedParentId) return item
          changed = true
          return {
            ...item,
            parentId: normalizedParentId,
            updatedAt,
          }
        })
        return changed ? nextItems : items
      })
    },
    [applyTodoUpdate]
  )

  /**
   * Quick add TODO
   */
  const handleQuickAdd = (text: string) => {
    if (!text.trim()) return

    const newItem: TodoItem = {
      id: `todo-${Date.now()}`,
      text: text.trim(),
      done: false,
      category: quickAddCategory,
      priority: 'medium',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    applyTodoUpdate((items) => [...items, newItem])
    message.success('已添加')
  }

  /**
   * 迁移上周未完成的任务到本周
   */
  // Quick add parser: 支持 "> 子" 和 "父 > 子 (> 孙)" 语法
  const handleQuickAddParsed = (text: string) => {
    const input = text.trim()
    if (!input) return

    const hasArrow = input.includes('>')
    const parts = input
      .split('>')
      .map((s) => s.trim())
      .filter(Boolean)

    const now = Date.now()

    // "> 子" => 作为当前选中任务的子任务
    if (hasArrow && parts.length === 1 && input.startsWith('>') && selectedTodo) {
      const child: TodoItem = {
        id: `todo-${now}`,
        text: parts[0],
        done: false,
        category: quickAddCategory,
        priority: 'medium',
        createdAt: now,
        updatedAt: now,
        parentId: selectedTodo.id,
      }
      applyTodoUpdate((items) => [...items, child])
      message.success('已添加子任务')
      return
    }

    // "父 > 子 (> 孙 ...)" => 构建层级链
    if (hasArrow && parts.length >= 2) {
      let parentId: string | undefined
      const created: TodoItem[] = []
      for (let i = 0; i < parts.length; i++) {
        const ts = now + i
        const it: TodoItem = {
          id: `todo-${ts}`,
          text: parts[i],
          done: false,
          category: quickAddCategory,
          priority: 'medium',
          createdAt: ts,
          updatedAt: ts,
          parentId,
        }
        created.push(it)
        parentId = it.id
      }
      applyTodoUpdate((items) => [...items, ...created])
      message.success(`已添加 ${created.length} 个任务`)
      return
    }

    // 普通单项退回到旧逻辑
    handleQuickAdd(input)
  }

  const handleMigrateLastWeekTasks = useCallback(async () => {
    if (!isEnabled) {
      message.warning('请先配置 Obsidian Vault')
      return
    }

    try {
      // 计算上周的日期（当前日期减去 7 天）
      const lastWeekDate = new Date()
      lastWeekDate.setDate(lastWeekDate.getDate() - 7)

      widgetLogger.info('Migrating last week tasks', { lastWeekDate: lastWeekDate.toISOString() })
      message.loading('正在读取上周的任务...', 0)

      // 读取上周的 TODO 数据
      const lastWeekTodos = await obsidianManager.readTodoItemsForDate(template, lastWeekDate)
      const normalizedLastWeekTodos = normalizeTodoItems(lastWeekTodos)

      message.destroy()

      if (normalizedLastWeekTodos.length === 0) {
        message.info('上周没有找到任务')
        return
      }

      // 过滤出未完成的任务
      const incompleteTasks = normalizedLastWeekTodos.filter((item) => !item.done)

      if (incompleteTasks.length === 0) {
        message.info('上周的任务已全部完成，无需迁移')
        return
      }

      // 确认迁移
      modal.confirm({
        title: '确认迁移任务',
        content: `发现上周有 ${incompleteTasks.length} 个未完成的任务，是否迁移到本周？`,
        onOk: async () => {
          const nowTs = Date.now()
          const idRemap = new Map<string, string>()
          // 更新任务的时间戳和 ID，避免冲突
          const migratedTasks = incompleteTasks.map((task, index) => {
            const newId = `todo-${nowTs}-${index}-${Math.random().toString(36).substr(2, 9)}`
            idRemap.set(task.id, newId)
            return {
              ...task,
              id: newId,
              createdAt: nowTs,
              updatedAt: nowTs,
            }
          })
          const migratedWithHierarchy = migratedTasks.map((task) => ({
            ...task,
            parentId: task.parentId ? idRemap.get(task.parentId) : undefined,
          }))
          // 添加到当前任务列表
          const nextTodos = [...migratedWithHierarchy, ...todoItems]

          setTodoItems(nextTodos)
          message.success(`已迁移 ${migratedTasks.length} 个任务到本周`)
          widgetLogger.info('Tasks migrated successfully', { count: migratedTasks.length })

          // 同步到 Obsidian
          if (isEnabled) {
            await sync(nextTodos)
          }
        },
      })
    } catch (error) {
      message.destroy()
      const errorMessage = error instanceof Error ? error.message : String(error)
      message.error(`迁移任务失败：${errorMessage}`)
      widgetLogger.error('Failed to migrate tasks', error as Error)
    }
  }, [isEnabled, template, todoItems, message, modal, widgetLogger, sync])

  const handleClipboardParse = useCallback(async () => {
    try {
      const clipboardText = await window.electronAPI.readClipboardText()
      if (!clipboardText || !clipboardText.trim()) {
        message.warning('剪贴板为空，请先复制一些内容')
        return
      }
      setAiClipboardText(clipboardText)
      setClipboardModalVisible(true)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      message.error(`读取剪贴板失败：${errorMessage}`)
    }
  }, [message, selectedAiProviderId])

  const loadPromptTemplate = useCallback(async () => {
    const templatePath = aiParsingConfig.prompt_template_path || 'prompts/ai_todo_parser.md'
    try {
      return await window.electronAPI.readFile(templatePath)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`读取提示词模板失败：${errorMessage}`)
    }
  }, [aiParsingConfig.prompt_template_path])

  const startAiParsing = useCallback(
    async (text: string, providerId: string) => {
      if (!providerId) {
        message.warning('请选择 AI 提供商')
        return
      }
      const provider = aiProviders.find((cfg) => cfg.id === providerId)
      if (!provider) {
        message.error('未找到对应的 AI 提供商配置')
        return
      }

      try {
        setAiLoading(true)
        const maxLength = aiParsingConfig.max_clipboard_length || 10000
        const truncatedText = text.length > maxLength ? text.slice(0, maxLength) : text
        const template = await loadPromptTemplate()
        const prompt = template
          .replace(/\{current_date\}/g, dayjs().format('YYYY-MM-DD'))
          .replace(/\{clipboard_text\}/g, truncatedText)

        const result = await aiClient.chatCompletion({
          config: provider,
          messages: [{ role: 'user', content: prompt }],
          feature: 'TODO 解析',
          metadata: { clipboard_length: truncatedText.length },
        })

        const parsed: ParsedAiTodoItem[] = parseAiTodoMarkdown(result.content)
        if (!parsed.length) {
          message.warning('AI 未能解析出待办事项，请调整剪贴板内容后重试')
          return
        }

        setAiSuggestions(
          parsed.map((todo) => ({
            ...todo,
            selected: true,
          }))
        )
        setAiPreviewVisible(true)
        setClipboardModalVisible(false)
        widgetLogger.info('AI parsing completed', { count: parsed.length })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        modal.confirm({
          title: '解析失败',
          content: (
            <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{errorMessage}</Paragraph>
          ),
          okText: '重试',
          cancelText: '取消',
          onOk: () => startAiParsing(text, providerId),
        })
      } finally {
        setAiLoading(false)
      }
    },
    [
      aiProviders,
      aiParsingConfig.max_clipboard_length,
      loadPromptTemplate,
      message,
      modal,
      widgetLogger,
    ]
  )

  const handleAiProviderChange = useCallback(
    (value: string) => {
      setSelectedAiProviderId(value)
      updateAiParserSettings({ selected_provider_id: value })
    },
    [updateAiParserSettings]
  )

  const handleAiClipboardConfirm = useCallback(() => {
    void startAiParsing(aiClipboardText, selectedAiProviderId)
  }, [aiClipboardText, selectedAiProviderId, startAiParsing])

  const handleSuggestionsChange = useCallback((items: TodoAISuggestion[]) => {
    setAiSuggestions(items)
  }, [])

  const handlePreviewConfirm = useCallback(async () => {
    const selected = aiSuggestions.filter((item) => item.selected)
    if (!selected.length) {
      message.info('请至少选择一个 TODO 项目')
      return
    }
    const suggestionMap = new Map(aiSuggestions.map((item) => [item.id, item]))
    const selectedIds = new Set(selected.map((item) => item.id))
    const resolveParentId = (item: TodoAISuggestion): string | undefined => {
      let currentParentId = item.parentId
      while (currentParentId) {
        if (selectedIds.has(currentParentId)) {
          return currentParentId
        }
        const parentItem = suggestionMap.get(currentParentId)
        currentParentId = parentItem?.parentId
      }
      return undefined
    }
    const nowTs = Date.now()
    const sanitized = selected.map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { selected: _ignored, indentLevel: _indent, ...rest } = item
      const parentId = resolveParentId(item)
      return {
        ...rest,
        parentId,
        createdAt: rest.createdAt || nowTs,
        updatedAt: nowTs,
      }
    })
    const nextTodos = [...sanitized, ...todoItems]
    setTodoItems(nextTodos)
    setAiPreviewVisible(false)
    message.success(`已添加 ${sanitized.length} 个 TODO`)
    if (isEnabled) {
      await sync(nextTodos)
    }
  }, [aiSuggestions, isEnabled, message, sync, todoItems])

  /**
   * Show add dialog
   */
  const showAddDialog = () => {
    form.resetFields()
    form.setFieldsValue({
      priority: 'medium',
      category: '默认',
    })
    setCurrentAttachments([])
    setAddDialogVisible(true)
  }

  /**
   * Handle add attachment
   */
  const handleAddAttachment = async () => {
    try {
      const result = await window.electronAPI.selectFile({
        filters: [{ name: 'All Files', extensions: ['*'] }],
      })
      if (result) {
        const attachment = await AttachmentManager.addAttachment(result)
        if (attachment) {
          setCurrentAttachments([...currentAttachments, attachment])
          if (attachment.storage_mode === 'local') {
            message.success('附件已保存到本地')
          } else {
            message.success('附件已上传到图床')
          }
        } else {
          message.error('添加附件失败')
        }
      }
    } catch (error) {
      console.error('Failed to add attachment:', error)
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      message.error(`添加附件失败: ${errorMessage}`)
    }
  }

  /**
   * Handle remove attachment
   */
  const handleRemoveAttachment = (index: number) => {
    const newAttachments = [...currentAttachments]
    newAttachments.splice(index, 1)
    setCurrentAttachments(newAttachments)
  }

  /**
   * Handle paste event - auto upload image from clipboard
   */
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    // Check if clipboard contains image
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault() // Prevent default paste behavior

        const blob = item.getAsFile()
        if (!blob) continue

        try {
          message.loading('正在上传剪贴板图片...', 0)

          // Save blob to temporary file
          const reader = new FileReader()
          reader.onload = async (event) => {
            try {
              const base64Data = event.target?.result as string
              const base64 = base64Data.split(',')[1]

              // Generate temporary filename
              const timestamp = Date.now()
              const extension = item.type.split('/')[1] || 'png'
              const tempFileName = `clipboard-${timestamp}.${extension}`

              // Get temp directory path
              const tempDir = await window.electronAPI.getTempDir()
              const tempPath = `${tempDir}/${tempFileName}`

              // Write base64 to file
              await window.electronAPI.writeFileBase64(tempPath, base64)

              // Upload using AttachmentManager
              const attachment = await AttachmentManager.addAttachment(tempPath, tempFileName)

              message.destroy()

              if (attachment) {
                setCurrentAttachments([...currentAttachments, attachment])
                message.success('剪贴板图片已上传')

                // Clean up temp file
                try {
                  await window.electronAPI.deleteFile(tempPath)
                } catch (err) {
                  console.warn('Failed to delete temp file:', err)
                }
              } else {
                message.error('上传剪贴板图片失败')
              }
            } catch (error) {
              message.destroy()
              console.error('Failed to upload clipboard image:', error)
              const errorMessage = error instanceof Error ? error.message : '未知错误'
              message.error(`上传失败: ${errorMessage}`)
            }
          }

          reader.readAsDataURL(blob)
        } catch (error) {
          message.destroy()
          console.error('Failed to process clipboard image:', error)
          message.error('处理剪贴板图片失败')
        }

        break // Only process first image
      }
    }
  }

  /**
   * Handle add TODO
   */
  const handleAdd = async () => {
    try {
      const values = await form.validateFields()
      const tags = values.tags ? values.tags.split(/[,，\s]+/).filter((t) => t.trim()) : []
      const newItem: TodoItem = {
        id: `todo-${Date.now()}`,
        text: values.text,
        done: false,
        category: values.category,
        priority: values.priority,
        tags,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        note: values.note || undefined,
        conclusion: values.conclusion || undefined,
        attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      }

      applyTodoUpdate((items) => [...items, newItem])
      setAddDialogVisible(false)
      setCurrentAttachments([])
      message.success('已添加')
    } catch (error) {
      console.error('Failed to add todo:', error)
    }
  }

  /**
   * Add subtask for selected item and open edit dialog
   */
  const handleAddSubtask = () => {
    if (!selectedTodo) {
      message.warning('请先选择一个任务')
      return
    }

    const now = Date.now()
    const child: TodoItem = {
      id: `todo-${now}`,
      text: '',
      done: false,
      category: selectedTodo.category || 'Ĭ��',
      priority: selectedTodo.priority || 'medium',
      createdAt: now,
      updatedAt: now,
      parentId: selectedTodo.id,
    }

    // 先加入列表，再进入编辑
    applyTodoUpdate((items) => [...items, child])
    setSelectedTodo(child)
    form.setFieldsValue({
      text: '',
      category: child.category || 'Ĭ��',
      priority: child.priority || 'medium',
      tags: '',
      note: '',
      conclusion: '',
    })
    setCurrentAttachments([])
    setEditDialogVisible(true)
  }

  /**
   * Show edit dialog
   */
  const showEditDialog = () => {
    if (!selectedTodo) {
      message.warning('请先选择一个任务')
      return
    }

    // Reset form fields first
    form.resetFields()

    // Then set new values
    form.setFieldsValue({
      text: selectedTodo.text,
      category: selectedTodo.category || '默认',
      priority: selectedTodo.priority || 'medium',
      tags: selectedTodo.tags?.join(', ') || '',
      note: selectedTodo.note || '',
      conclusion: selectedTodo.conclusion || '',
    })
    setCurrentAttachments(selectedTodo.attachments || [])
    setEditDialogVisible(true)
  }

  /**
   * Handle edit TODO
   */
  const handleEdit = async () => {
    if (!selectedTodo) return

    try {
      const values = await form.validateFields()
      const tags = values.tags ? values.tags.split(/[,，\s]+/).filter((t) => t.trim()) : []

      applyTodoUpdate((items) =>
        items.map((item) =>
          item.id === selectedTodo.id
            ? {
                ...item,
                text: values.text,
                category: values.category,
                priority: values.priority,
                tags,
                note: values.note || undefined,
                conclusion: values.conclusion || undefined,
                attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
                updatedAt: Date.now(),
              }
            : item
        )
      )
      setEditDialogVisible(false)
      setCurrentAttachments([])
      message.success('已更新')
    } catch (error) {
      console.error('Failed to edit todo:', error)
    }
  }

  /**
   * Delete TODO
   */
  const handleDelete = () => {
    if (!selectedTodo) {
      message.warning('请先选择一个任务')
      return
    }

    modal.confirm({
      title: '确认删除',
      content: '确定要删除这个待办事项吗？',
      onOk: () => {
        applyTodoUpdate((items) => items.filter((item) => item.id !== selectedTodo.id))
        setSelectedTodo(null)
        message.success('已删除')
      },
    })
  }

  const handleTodoNoteAction = useCallback(
    async (item: TodoItem) => {
      if (!isEnabled) {
        message.warning('请先启用 Obsidian Vault')
        return
      }

      const existingLink = extractObsidianLinkTarget(item.text)
      try {
        if (existingLink) {
          await obsidianManager.openNoteByLinkTarget(existingLink.target)
          message.success('已打开关联的 Obsidian 笔记')
          return
        }

        const cleanTitle = stripObsidianLinks(item.text).trim() || item.text || 'TODO 笔记'
        // 防止重复创建：同一条目创建进行中则忽略
        if (creatingNoteIds.has(item.id)) {
          return
        }
        setCreatingNoteIds((prev) => new Set(prev).add(item.id))

        const noteResult = await obsidianManager.createTodoNote({
          title: cleanTitle,
          folder: noteFolder,
          todoId: item.id,
          category: item.category,
          priority: item.priority,
          done: item.done,
          sourceFile: templateRelativePath,
          note: item.note,
          conclusion: item.conclusion,
        })

        const wikiLink = `[[${noteResult.wikiTarget}|📝]]`
        const wikiLinkDisplay = `[[${noteResult.wikiTarget}|笔记]]`
        void wikiLink
        const alreadyHasAnyLink = /\[\[[^\]]+\]\]/.test(item.text)
        const updatedText =
          item.text.includes(noteResult.wikiTarget) || alreadyHasAnyLink
            ? item.text
            : `${item.text} ${wikiLinkDisplay}`.trim()
        const updatedItem: TodoItem = { ...item, text: updatedText, updatedAt: Date.now() }

        applyTodoUpdate((items) => items.map((todo) => (todo.id === item.id ? updatedItem : todo)))
        setSelectedTodo((prev) => (prev && prev.id === item.id ? updatedItem : prev))
        message.success('已创建并关联 Obsidian 笔记')
      } catch (error) {
        widgetLogger.error('Failed to handle Obsidian note action', error as Error)
        const errMessage = error instanceof Error ? error.message : String(error)
        message.error(`处理 Obsidian 笔记失败: ${errMessage}`)
      }
    },
    [
      applyTodoUpdate,
      isEnabled,
      message,
      noteFolder,
      creatingNoteIds,
      setSelectedTodo,
      templateRelativePath,
      widgetLogger,
    ]
  )

  /**
   * Calculate statistics
   */
  const getStatistics = () => {
    const total = todoItems.length
    const completed = todoItems.filter((item) => item.done).length
    const active = total - completed
    const highPriority = todoItems.filter((item) => item.priority === 'high' && !item.done).length

    return {
      total,
      completed,
      active,
      highPriority,
    }
  }

  const stats = getStatistics()

  // （由 Table children 渲染层级，移除自定义缩进计算）

  return (
    <>
      <WidgetLayout
        title={TODO_WIDGET_METADATA.displayName}
        icon={TODO_WIDGET_METADATA.icon}
        loading={false}
        error={state.error}
        showRefresh={true}
        onRefresh={refresh}
        showSave={true}
        onSave={save}
        actionInProgress={actionInProgress}
        extra={
          <Text 
            type="secondary" 
            style={{ 
              minWidth: '200px', 
              display: 'inline-block'
            }}
          >
            {state.statusMessage || '\u00A0'}
          </Text>
        }
      >
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Row justify="space-between" align="middle" style={{ marginBottom: '16px' }}>
            <Col>
              <Space>
                <Button icon={<SettingOutlined />} onClick={() => message.info('配置功能待实现')}>
                  Obsidian配置
                </Button>
                <Button
                  icon={<SyncOutlined />}
                  disabled={!isEnabled || !save}
                  onClick={() => save?.()}
                >
                  同步
                </Button>
              </Space>
            </Col>
          </Row>

          <Row gutter={16} style={{ flex: 1, minHeight: 0 }} align="top" wrap={false}>
            {/* Left: TODO List */}
            <Col
              xs={24}
              sm={24}
              md={24}
              lg={selectedTodo ? 16 : 24} // 当有选中项时，缩小宽度
              xl={selectedTodo ? 17 : 24}
              xxl={selectedTodo ? 18 : 24}
              style={{ height: '100%', minWidth: 0, transition: 'all 0.3s ease' }} // 添加过渡动画
            >
              <TodoListPanel
                filteredItems={filteredItems}
                categories={categories}
                selectedCategory={selectedCategory}
                quickAddCategory={quickAddCategory}
                selectedTodo={selectedTodo}
                creatingNoteIds={creatingNoteIds}
                isEnabled={isEnabled}
                aiLoading={aiLoading}
                hasAiProvider={aiProviders.length > 0}
                onShowAdd={showAddDialog}
                onShowEdit={showEditDialog}
                onDelete={handleDelete}
                onAiClipboardParse={handleClipboardParse}
                onMigrateLastWeekTasks={handleMigrateLastWeekTasks}
                onCategoryFilterChange={setSelectedCategory}
                onQuickAddCategoryChange={setQuickAddCategory}
                onQuickAddParsed={handleQuickAddParsed}
                onSelectTodo={(todo) => setSelectedTodo(todo)}
                onToggleComplete={handleToggleComplete}
                onCategoryChange={handleCategoryChange}
                onPriorityChange={handlePriorityChange}
                onTodoNoteAction={handleTodoNoteAction}
                onReorderTodos={handleReorderTodos}
              />
            </Col>

            {/* Right: Details and Stats */}
            {selectedTodo && ( // 仅当选中时显示
              <Col
                xs={0}
                sm={0}
                md={0}
                lg={8}
                xl={7}
                xxl={6}
                style={{ height: '100%', overflow: 'auto' }}
              >
                <TodoDetailsPanel
                  selectedTodo={selectedTodo}
                  stats={stats}
                  syncStatus={syncStatus}
                  isEnabled={isEnabled}
                  onAddSubtask={handleAddSubtask}
                  onClose={() => setSelectedTodo(null)}
                  onEdit={showEditDialog}
                  onDelete={handleDelete}
                />
              </Col>
            )}
          </Row>

          {/* Add/Edit Dialog */}
          <TodoFormModal
            visible={addDialogVisible || editDialogVisible}
            isEdit={editDialogVisible}
            form={form}
            categories={categories}
            attachments={currentAttachments}
            onSubmit={editDialogVisible ? handleEdit : handleAdd}
            onCancel={() => {
              setAddDialogVisible(false)
              setEditDialogVisible(false)
            }}
            onAddAttachment={handleAddAttachment}
            onRemoveAttachment={handleRemoveAttachment}
            onPaste={handlePaste}
          />
        </div>
      </WidgetLayout>

      <TodoAiClipboardModal
        visible={clipboardModalVisible}
        aiProviders={aiProviders}
        selectedProviderId={selectedAiProviderId}
        aiParsingConfig={aiParsingConfig}
        aiClipboardText={aiClipboardText}
        loading={aiLoading}
        onProviderChange={handleAiProviderChange}
        onCancel={() => setClipboardModalVisible(false)}
        onConfirm={handleAiClipboardConfirm}
      />

      <TodoAIPreviewModal
        visible={aiPreviewVisible}
        items={aiSuggestions}
        categories={categories}
        onItemsChange={handleSuggestionsChange}
        onCancel={() => setAiPreviewVisible(false)}
        onConfirm={handlePreviewConfirm}
        loading={aiLoading}
      />
    </>
  )
}
