import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  App,
  Button,
  ColorPicker,
  DatePicker,
  Divider,
  Form,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import isBetween from 'dayjs/plugin/isBetween'
import {
  BgColorsOutlined,
  CalendarOutlined,
  CopyOutlined,
  FieldTimeOutlined,
  FileTextOutlined,
  HighlightOutlined,
  PlusOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import FullCalendar from '@fullcalendar/react'
import interactionPlugin from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import type {
  DateSelectArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventInput,
} from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import { WidgetLayout, WidgetSection, WidgetEmpty } from '@/components/widgets'
import { useWidget } from '@/hooks/useWidget'
import { useWidgetActions } from '@/hooks/useWidgetActions'
import { useWidgetObsidian } from '@/hooks/useWidgetObsidian'
import { useWidgetConfig } from '@/hooks/useWidgetConfig'
import { useConfig } from '@/hooks/useConfig'
import { useTheme } from '@/contexts/ThemeContext'
import type { WidgetMetadata } from '@/shared/widget-types'
import type { CalendarCategory, CalendarEvent } from '@/shared/types'

type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'

interface CalendarFormValues {
  title: string
  datetime: Dayjs
  category: string
  description?: string
  isAllDay?: boolean
  duration?: number
}

const DEFAULT_TEMPLATE = '{year}-W{week}.md'
const DEFAULT_CATEGORY_KEY = 'default'

dayjs.extend(relativeTime)
dayjs.extend(isBetween)

const { RangePicker } = DatePicker
const DEFAULT_DURATION = 60
const DURATION_OPTIONS = [30, 45, 60, 75, 90, 120, 150, 180]

const metadata: WidgetMetadata = {
  id: 'calendar',
  displayName: '日历排期',
  icon: <CalendarOutlined />,
  description: '拖拽排期 + 分类颜色，支持与 Obsidian Vault 双向同步',
  category: 'productivity',
  order: 3,
  enabled: true,
  requiresObsidian: true,
}

const SAMPLE_EVENTS: CalendarEvent[] = [
  {
    id: 'sample-1',
    title: '示例：项目例会',
    date: dayjs().format('YYYY-MM-DD'),
    time: '10:00',
    endTime: '11:00',
    durationMinutes: 60,
    category: DEFAULT_CATEGORY_KEY,
    description: '与团队同步本周任务',
    createdAt: Date.now(),
  },
  {
    id: 'sample-2',
    title: '示例：代码评审',
    date: dayjs().add(1, 'day').format('YYYY-MM-DD'),
    time: '15:30',
    endTime: '16:30',
    durationMinutes: 60,
    category: DEFAULT_CATEGORY_KEY,
    description: 'Review PR #428',
    createdAt: Date.now(),
  },
  {
    id: 'sample-3',
    title: '示例：周报撰写',
    date: dayjs().add(3, 'day').format('YYYY-MM-DD'),
    time: '00:00',
    allDay: true,
    category: DEFAULT_CATEGORY_KEY,
    description: '整理 Calendar 事件生成周报',
    createdAt: Date.now(),
  },
]

const CalendarWidget: React.FC = () => {
  const { message } = App.useApp()
  const config = useConfig()
  const { colors } = useTheme()
  const [form] = Form.useForm<CalendarFormValues>()

  const { state, setStatus, setError, setLoading, widgetLogger } = useWidget({ metadata })

  const {
    config: calendarConfig,
    updateConfig: updateCalendarConfig,
    loading: calendarConfigLoading,
  } = useWidgetConfig<{
    categories: Record<string, CalendarCategory>
  }>({
    section: 'calendar',
    defaultConfig: {
      categories: {
        [DEFAULT_CATEGORY_KEY]: { name: '默认', color: '#546E7A' },
      },
    },
  })

  const template = useMemo(
    () => config.global?.obsidian?.content_files?.template || DEFAULT_TEMPLATE,
    [config]
  )

  const handleObsidianError = useCallback(
    (err: Error) => {
      message.error(`Obsidian 同步失败：${err.message}`)
    },
    [message]
  )

  const {
    isEnabled,
    sync,
    read,
    syncing,
    reading,
    lastSyncTime,
    error: obsidianError,
  } = useWidgetObsidian<CalendarEvent>({
    widgetId: metadata.id,
    dataType: 'calendar',
    template,
    onError: handleObsidianError,
  })

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [modalVisible, setModalVisible] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [modalSubmitting, setModalSubmitting] = useState(false)
  const [selectedView, setSelectedView] = useState<CalendarView>('dayGridMonth')
  const calendarRef = useRef<FullCalendar | null>(null)
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, CalendarCategory>>({})
  const [addingCategoryName, setAddingCategoryName] = useState('')
  const [addingCategoryColor, setAddingCategoryColor] = useState('#1890ff')
  const [reportRange, setReportRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('week'),
    dayjs().endOf('week'),
  ])
  const [reportModalVisible, setReportModalVisible] = useState(false)
  const [reportContent, setReportContent] = useState('')
  const eventsCountInReportRange = useMemo(() => {
    const [start, end] = reportRange
    if (!start || !end) return 0
    const startBoundary = start.startOf('day')
    const endBoundary = end.endOf('day')
    return events.filter((event) => {
      const eventStart = event.allDay
        ? dayjs(event.date).startOf('day')
        : dayjs(`${event.date} ${event.time || '00:00'}`)
      return eventStart.isBetween(startBoundary, endBoundary, null, '[]')
    }).length
  }, [events, reportRange])

  useEffect(() => {
    setCategoryDrafts(
      calendarConfig?.categories || {
        [DEFAULT_CATEGORY_KEY]: { name: '默认', color: '#546E7A' },
      }
    )
  }, [calendarConfig?.categories])

  const categoryEntries = useMemo(() => Object.entries(categoryDrafts), [categoryDrafts])

  useEffect(() => {
    if (filterCategory !== 'all' && !categoryDrafts[filterCategory]) {
      setFilterCategory('all')
    }
  }, [categoryDrafts, filterCategory])

  const categoryColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    categoryEntries.forEach(([key, value]) => {
      map[key] = value.color
    })
    return map
  }, [categoryEntries])

  const categoryNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    categoryEntries.forEach(([key, value]) => {
      map[key] = value.name
    })
    return map
  }, [categoryEntries])

  const defaultCategory = categoryEntries[0]?.[0] || DEFAULT_CATEGORY_KEY
  const [savingCategories, setSavingCategories] = useState(false)
  const deriveDurationMinutes = useCallback((event?: CalendarEvent | null) => {
    if (!event) return DEFAULT_DURATION
    if (event.durationMinutes && event.durationMinutes > 0) {
      return event.durationMinutes
    }
    if (event.time && event.endTime) {
      const start = dayjs(`1970-01-01 ${event.time}`)
      const end = dayjs(`1970-01-01 ${event.endTime}`)
      const diff = end.diff(start, 'minute')
      if (diff > 0) return diff
    }
    return DEFAULT_DURATION
  }, [])

  const sortEvents = useCallback((list: CalendarEvent[]) => {
    return [...list].sort((a, b) => {
      const startA = dayjs(`${a.date} ${a.time || '00:00'}`).valueOf()
      const startB = dayjs(`${b.date} ${b.time || '00:00'}`).valueOf()
      return startA - startB
    })
  }, [])

  const persistCategories = useCallback(
    async (nextCategories: Record<string, CalendarCategory>) => {
      setSavingCategories(true)
      try {
        await updateCalendarConfig({ categories: nextCategories })
        setCategoryDrafts(nextCategories)
        message.success('分类设置已保存')
      } catch (error) {
        message.error(`保存分类失败：${error instanceof Error ? error.message : String(error)}`)
      } finally {
        setSavingCategories(false)
      }
    },
    [message, updateCalendarConfig]
  )

  const handleCategoryFieldChange = useCallback(
    (key: string, field: keyof CalendarCategory, value: string) => {
      setCategoryDrafts((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          [field]: value,
        },
      }))
    },
    []
  )

  const handleDeleteCategory = useCallback(
    (key: string) => {
      if (key === DEFAULT_CATEGORY_KEY) {
        message.warning('默认分类不可删除')
        return
      }
      const next = { ...categoryDrafts }
      delete next[key]
      void persistCategories(next)
    },
    [categoryDrafts, message, persistCategories]
  )

  const handleAddCategory = useCallback(() => {
    const name = addingCategoryName.trim()
    if (!name) {
      message.warning('请输入分类名称')
      return
    }
    const key =
      name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-_]/g, '') || `category-${Date.now().toString(36)}`
    if (categoryDrafts[key]) {
      message.warning('分类标识已存在，请更换名称')
      return
    }
    const next = {
      ...categoryDrafts,
      [key]: {
        name,
        color: addingCategoryColor,
      },
    }
    setAddingCategoryName('')
    void persistCategories(next)
  }, [addingCategoryColor, addingCategoryName, categoryDrafts, message, persistCategories])

  const handleSaveCategoryDrafts = useCallback(() => {
    void persistCategories(categoryDrafts)
  }, [categoryDrafts, persistCategories])

  const handleGenerateReport = useCallback(() => {
    const [start, end] = reportRange
    if (!start || !end) {
      message.warning('请选择周报时间范围')
      return
    }
    const startBoundary = start.startOf('day')
    const endBoundary = end.endOf('day')
    const filtered = sortEvents(
      events.filter((event) => {
        const eventStart = event.allDay
          ? dayjs(event.date).startOf('day')
          : dayjs(`${event.date} ${event.time || '00:00'}`)
        return eventStart.isBetween(startBoundary, endBoundary, null, '[]')
      })
    )

    if (filtered.length === 0) {
      message.info('该时间范围内暂无事件')
      return
    }

    const lines: string[] = []
    lines.push(
      `# Calendar 周报 (${startBoundary.format('YYYY-MM-DD')} - ${endBoundary.format('YYYY-MM-DD')})`
    )
    lines.push('')

    const summary: Record<string, number> = {}
    let currentDateLabel = ''

    filtered.forEach((event) => {
      const eventStart = event.allDay
        ? dayjs(event.date).startOf('day')
        : dayjs(`${event.date} ${event.time || '00:00'}`)
      const dateLabel = eventStart.format('YYYY-MM-DD dddd')
      if (dateLabel !== currentDateLabel) {
        lines.push(`## ${dateLabel}`)
        currentDateLabel = dateLabel
      }
      const categoryKey = event.category || DEFAULT_CATEGORY_KEY
      const categoryName = categoryNameMap[categoryKey] || '未分类'
      const timeLabel = event.allDay
        ? '全天'
        : event.endTime
          ? `${event.time}-${event.endTime}`
          : `${event.time}`
      const description = event.description ? ` - ${event.description}` : ''
      lines.push(`- [${categoryName}] ${timeLabel} ${event.title}${description}`)
      summary[categoryName] = (summary[categoryName] || 0) + 1
    })

    lines.push('')
    lines.push('## 分类统计')
    Object.entries(summary)
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => {
        lines.push(`- ${name}: ${count} 个`)
      })

    setReportContent(lines.join('\n'))
    setReportModalVisible(true)
  }, [categoryNameMap, events, message, reportRange, sortEvents])

  const handleCopyReport = useCallback(async () => {
    if (!reportContent) return
    try {
      const clipboardIPC = (
        window.electronAPI as { writeClipboard?: (text: string) => Promise<void> } | undefined
      )?.writeClipboard
      if (clipboardIPC) {
        await clipboardIPC(reportContent)
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(reportContent)
      } else {
        throw new Error('当前环境不支持剪贴板写入')
      }
      message.success('周报 Markdown 已复制')
    } catch (error) {
      message.warning(`复制失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }, [message, reportContent])

  const filteredEvents = useMemo(() => {
    if (filterCategory === 'all') return events
    return events.filter((event) => (event.category || DEFAULT_CATEGORY_KEY) === filterCategory)
  }, [events, filterCategory])

  const calendarEventInputs = useMemo<EventInput[]>(() => {
    return filteredEvents.map((event) => {
      const start = event.allDay
        ? dayjs(event.date).startOf('day')
        : dayjs(`${event.date} ${event.time || '00:00'}`)
      const end = event.allDay
        ? start.add(1, 'day')
        : event.endTime
          ? dayjs(`${event.date} ${event.endTime}`)
          : start.add(event.durationMinutes || DEFAULT_DURATION, 'minute')
      return {
        id: event.id,
        title: event.title,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: Boolean(event.allDay),
        backgroundColor: categoryColorMap[event.category || DEFAULT_CATEGORY_KEY],
        borderColor: categoryColorMap[event.category || DEFAULT_CATEGORY_KEY],
        extendedProps: {
          categoryKey: event.category || DEFAULT_CATEGORY_KEY,
          description: event.description,
          allDay: event.allDay,
        },
      }
    })
  }, [filteredEvents, categoryColorMap])

  const upcomingEvents = useMemo(() => {
    const now = dayjs()
    const startOfToday = now.startOf('day')
    return [...events]
      .filter((event) => {
        const start = event.allDay
          ? dayjs(event.date).startOf('day')
          : dayjs(`${event.date} ${event.time || '00:00'}`)
        if (event.allDay) {
          return start.isSame(startOfToday, 'day') || start.isAfter(startOfToday)
        }
        return start.isAfter(now.subtract(1, 'hour'))
      })
      .sort((a, b) => {
        const startA = a.allDay
          ? dayjs(a.date).valueOf()
          : dayjs(`${a.date} ${a.time || '00:00'}`).valueOf()
        const startB = b.allDay
          ? dayjs(b.date).valueOf()
          : dayjs(`${b.date} ${b.time || '00:00'}`).valueOf()
        return startA - startB
      })
      .slice(0, 5)
  }, [events])

  const openCreateModal = useCallback(
    (preset?: Dayjs, options?: { isAllDay?: boolean; durationMinutes?: number }) => {
      setEditingEvent(null)
      form.resetFields()
      form.setFieldsValue({
        datetime: preset || dayjs().minute(0).second(0),
        category: defaultCategory,
        isAllDay: options?.isAllDay || false,
        duration: options?.durationMinutes || DEFAULT_DURATION,
      })
      setModalVisible(true)
    },
    [defaultCategory, form]
  )

  const openEditModal = useCallback(
    (event: CalendarEvent) => {
      setEditingEvent(event)
      form.setFieldsValue({
        title: event.title,
        datetime: dayjs(`${event.date} ${event.time}`),
        category: event.category || defaultCategory,
        description: event.description,
        isAllDay: Boolean(event.allDay),
        duration: deriveDurationMinutes(event),
      })
      setModalVisible(true)
    },
    [defaultCategory, deriveDurationMinutes, form]
  )

  const persistEvents = useCallback(
    async (nextEvents: CalendarEvent[], successMessage?: string) => {
      const sorted = sortEvents(nextEvents)
      setEvents(sorted)
      if (!isEnabled) {
        if (successMessage) {
          message.info('Obsidian 未启用，数据仅保存在当前会话。')
        }
        return
      }
      try {
        setLoading(true)
        await sync(sorted)
        if (successMessage) {
          message.success(successMessage)
        }
        setStatus(`已同步 ${sorted.length} 个事件`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        setError(errorMessage)
        message.error(`同步失败：${errorMessage}`)
      } finally {
        setLoading(false)
      }
    },
    [isEnabled, message, setError, setLoading, setStatus, sortEvents, sync]
  )

  const loadEvents = useCallback(async () => {
    if (!isEnabled) {
      setStatus('Obsidian 未启用，展示示例数据')
      setEvents(sortEvents(SAMPLE_EVENTS))
      return
    }
    try {
      setLoading(true)
      setStatus('正在从 Obsidian 读取日程...')
      widgetLogger.info('Loading calendar events', { template })
      const data = await read()
      setEvents(sortEvents(data))
      setStatus(data.length ? `已加载 ${data.length} 个事件` : '暂无事件，请添加')
      widgetLogger.info('Calendar events loaded', { count: data.length })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setError(errorMessage)
      message.error(`读取日程失败：${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }, [
    isEnabled,
    message,
    read,
    setError,
    setLoading,
    setStatus,
    sortEvents,
    template,
    widgetLogger,
  ])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  useEffect(() => {
    if (obsidianError) {
      setError(obsidianError)
    }
  }, [obsidianError, setError])

  useEffect(() => {
    if (!calendarRef.current) return
    const api = calendarRef.current.getApi()
    if (api.view.type === selectedView) return
    const schedule =
      typeof queueMicrotask === 'function' ? queueMicrotask : (cb: () => void) => setTimeout(cb, 0)
    schedule(() => {
      api.changeView(selectedView)
    })
  }, [selectedView])

  const handleCalendarSelect = useCallback(
    (selection: DateSelectArg) => {
      const preset = dayjs(selection.start)
      selection.view.calendar.unselect()
      const durationGuess =
        selection.end && selection.start
          ? Math.max(dayjs(selection.end).diff(dayjs(selection.start), 'minute'), 15)
          : DEFAULT_DURATION
      openCreateModal(preset, {
        isAllDay: selection.allDay,
        durationMinutes: durationGuess || DEFAULT_DURATION,
      })
    },
    [openCreateModal]
  )

  const handleEventClick = useCallback(
    (click: EventClickArg) => {
      const target = events.find((event) => event.id === click.event.id)
      if (target) {
        openEditModal(target)
      }
    },
    [events, openEditModal]
  )

  const handleModalSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields()
      setModalSubmitting(true)
      const datetime = (values.datetime || dayjs()).second(0).millisecond(0)
      const isAllDay = Boolean(values.isAllDay)
      const duration = values.duration || DEFAULT_DURATION
      const category = values.category || defaultCategory

      let startTime = datetime.format('HH:mm')
      let endTime: string | null = null
      let durationMinutes: number | undefined = undefined

      if (isAllDay) {
        startTime = '00:00'
      } else {
        durationMinutes = duration
        endTime = datetime.add(duration, 'minute').format('HH:mm')
      }

      const normalized: CalendarEvent = {
        id:
          editingEvent?.id ||
          `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        title: values.title.trim(),
        date: datetime.format('YYYY-MM-DD'),
        time: startTime,
        endTime,
        durationMinutes,
        allDay: isAllDay,
        category,
        description: values.description?.trim(),
        createdAt: editingEvent?.createdAt || Date.now(),
      }
      const nextEvents = editingEvent
        ? events.map((event) => (event.id === editingEvent.id ? normalized : event))
        : [...events, normalized]
      await persistEvents(nextEvents, editingEvent ? '事件已更新' : '事件已创建')
      setModalVisible(false)
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    } finally {
      setModalSubmitting(false)
    }
  }, [defaultCategory, editingEvent, events, form, message, persistEvents])

  const handleDeleteEvent = useCallback(async () => {
    if (!editingEvent) return
    const nextEvents = events.filter((event) => event.id !== editingEvent.id)
    await persistEvents(nextEvents, '事件已删除')
    setModalVisible(false)
  }, [editingEvent, events, persistEvents])

  const applyCalendarInteraction = useCallback(
    async (eventId: string, start: Date | null, end: Date | null, allDayEvent: boolean) => {
      if (!start) return false
      const target = events.find((evt) => evt.id === eventId)
      if (!target) return false

      const startMoment = dayjs(start)
      let endMoment: Dayjs

      if (allDayEvent) {
        endMoment = dayjs(end || startMoment)
          .startOf('day')
          .add(1, 'day')
      } else if (end) {
        endMoment = dayjs(end)
      } else {
        endMoment = startMoment.add(deriveDurationMinutes(target), 'minute')
      }

      const updated: CalendarEvent = {
        ...target,
        date: startMoment.format('YYYY-MM-DD'),
        time: allDayEvent ? '00:00' : startMoment.format('HH:mm'),
        endTime: allDayEvent ? null : endMoment.format('HH:mm'),
        durationMinutes: allDayEvent ? undefined : endMoment.diff(startMoment, 'minute'),
        allDay: allDayEvent,
      }

      await persistEvents(
        events.map((evt) => (evt.id === eventId ? updated : evt)),
        '事件已更新'
      )
      return true
    },
    [deriveDurationMinutes, events, persistEvents]
  )

  const handleEventDrop = useCallback(
    async (info: EventDropArg) => {
      const success = await applyCalendarInteraction(
        info.event.id,
        info.event.start,
        info.event.end,
        info.event.allDay
      )
      if (!success) {
        info.revert()
      }
    },
    [applyCalendarInteraction]
  )

  const handleEventResize = useCallback(
    async (info: EventResizeDoneArg) => {
      const success = await applyCalendarInteraction(
        info.event.id,
        info.event.start,
        info.event.end,
        info.event.allDay
      )
      if (!success) {
        info.revert()
      }
    },
    [applyCalendarInteraction]
  )

  const { refresh, save, isActionInProgress } = useWidgetActions({
    widgetId: metadata.id,
    onRefresh: async () => {
      await loadEvents()
    },
    onSave: async () => {
      if (!isEnabled) {
        message.warning('Obsidian 未启用，无法写入 Vault')
        return
      }
      await sync(events)
      message.success('已同步到 Obsidian')
      setStatus(`已同步 ${events.length} 个事件`)
    },
  })

  const renderEventContent = useCallback(
    (arg: EventContentArg) => {
      const categoryKey = (arg.event.extendedProps.categoryKey as string) || DEFAULT_CATEGORY_KEY
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 12, color: colors.eventTextSecondary }}>
            {arg.timeText}
          </span>
          <strong style={{ color: colors.eventTextPrimary }}>{arg.event.title}</strong>
          {arg.event.extendedProps?.description && (
            <span style={{ fontSize: 11, color: colors.eventTextSecondary }}>
              {(arg.event.extendedProps.description as string).slice(0, 60)}
            </span>
          )}
          <span style={{ fontSize: 11, color: colors.eventTextSecondary }}>
            {categoryNameMap[categoryKey] || '未分类'}
          </span>
        </div>
      )
    },
    [categoryNameMap, colors]
  )

  return (
    <>
      <WidgetLayout
        title={metadata.displayName}
        icon={metadata.icon}
        loading={state.loading || reading || calendarConfigLoading}
        error={state.error}
        showRefresh
        onRefresh={() => void refresh?.()}
        showSave={isEnabled}
        onSave={isEnabled ? () => void save?.() : undefined}
        actionInProgress={isActionInProgress || syncing}
        extra={
          <Space size="small">
            <Tag icon={<SyncOutlined />} color={isEnabled ? 'success' : 'default'}>
              {isEnabled ? 'Obsidian 已启用' : 'Obsidian 未启用'}
            </Tag>
            {lastSyncTime && (
              <Tag color="geekblue">上次同步 {dayjs(lastSyncTime).format('HH:mm')}</Tag>
            )}
          </Space>
        }
      >
        <WidgetSection
          title="日历视图"
          icon={<CalendarOutlined />}
          extra={
            <Space size="small">
              <Segmented
                options={[
                  { label: '月', value: 'dayGridMonth' },
                  { label: '周', value: 'timeGridWeek' },
                  { label: '日', value: 'timeGridDay' },
                ]}
                value={selectedView}
                onChange={(val) => setSelectedView(val as CalendarView)}
                size="small"
              />
              <Select
                size="small"
                style={{ width: 140 }}
                value={filterCategory}
                onChange={setFilterCategory}
                options={[
                  { label: '全部分类', value: 'all' },
                  ...categoryEntries.map(([key, value]) => ({
                    label: value.name,
                    value: key,
                  })),
                ]}
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateModal()}>
                新增事件
              </Button>
            </Space>
          }
        >
          <div style={{ width: '100%' }}>
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={selectedView}
              headerToolbar={false}
              height="auto"
              selectable
              selectMirror
              editable
              eventDurationEditable
              eventResizableFromStart
              events={calendarEventInputs}
              select={handleCalendarSelect}
              eventClick={handleEventClick}
              eventContent={renderEventContent}
              eventDrop={(info) => void handleEventDrop(info)}
              eventResize={(info) => void handleEventResize(info)}
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }}
              slotLabelFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }}
              dayMaxEvents={3}
            />
          </div>
        </WidgetSection>

        <WidgetSection title="即将开始" icon={<FieldTimeOutlined />}>
          {upcomingEvents.length === 0 ? (
            <WidgetEmpty
              description="未来 48 小时暂无事件"
              actionText="创建第一个事件"
              onAction={() => openCreateModal()}
            />
          ) : (
            <Space direction="vertical" style={{ width: '100%' }}>
              {upcomingEvents.map((event) => {
                const start = event.allDay
                  ? dayjs(event.date).startOf('day')
                  : dayjs(`${event.date} ${event.time || '00:00'}`)
                const categoryKey = event.category || DEFAULT_CATEGORY_KEY
                const timeLabel = event.allDay ? '全天' : start.format('HH:mm')
                return (
                  <div
                    key={event.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: colors.eventBg,
                      cursor: 'pointer',
                    }}
                    onClick={() => openEditModal(event)}
                  >
                    <Space direction="vertical" size={0}>
                      <Space size="small">
                        <Tag color={categoryColorMap[categoryKey] || 'default'}>
                          {categoryNameMap[categoryKey] || '未分类'}
                        </Tag>
                        <Typography.Text strong>{event.title}</Typography.Text>
                      </Space>
                      <Typography.Text type="secondary">
                        {start.format('M月D日')} {timeLabel}
                        {event.description ? ` · ${event.description}` : ''}
                      </Typography.Text>
                    </Space>
                    <Typography.Text type="secondary">
                      {event.allDay ? '全天事件' : start.fromNow()}
                    </Typography.Text>
                  </div>
                )
              })}
            </Space>
          )}
        </WidgetSection>

        <WidgetSection
          title="分类管理"
          icon={<BgColorsOutlined />}
          extra={
            <Space>
              <Button
                size="small"
                type="primary"
                loading={savingCategories}
                onClick={() => handleSaveCategoryDrafts()}
              >
                保存分类
              </Button>
            </Space>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {categoryEntries.map(([key, value]) => (
              <Space
                key={key}
                align="center"
                style={{ width: '100%', justifyContent: 'space-between' }}
              >
                <Space size="small" wrap>
                  <Space.Compact size="small">
                    <Input value={key} disabled size="small" style={{ width: 100 }} />
                    <Input
                      value={value.name}
                      onChange={(e) => handleCategoryFieldChange(key, 'name', e.target.value)}
                      style={{ width: 200 }}
                      size="small"
                    />
                  </Space.Compact>
                  <ColorPicker
                    value={value.color}
                    onChange={(_, hex) => handleCategoryFieldChange(key, 'color', hex)}
                    size="small"
                  />
                </Space>
                <Button
                  size="small"
                  danger
                  disabled={key === DEFAULT_CATEGORY_KEY}
                  onClick={() => handleDeleteCategory(key)}
                >
                  删除
                </Button>
              </Space>
            ))}

            <Divider plain>新增分类</Divider>
            <Space wrap align="center">
              <Input
                placeholder="分类名称"
                value={addingCategoryName}
                onChange={(e) => setAddingCategoryName(e.target.value)}
                style={{ width: 200 }}
                size="small"
              />
              <ColorPicker
                value={addingCategoryColor}
                onChange={(_, hex) => setAddingCategoryColor(hex)}
                size="small"
              />
              <Button icon={<PlusOutlined />} size="small" onClick={() => handleAddCategory()}>
                新增分类
              </Button>
            </Space>
            <Typography.Text type="secondary">
              修改后点击“保存分类”写入 config.toml，所有 Widget 会实时共享分类及颜色。
            </Typography.Text>
          </Space>
        </WidgetSection>

        <WidgetSection
          title="周报导出"
          icon={<FileTextOutlined />}
          extra={
            <Button
              type="primary"
              icon={<HighlightOutlined />}
              onClick={() => handleGenerateReport()}
            >
              生成 Markdown
            </Button>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <RangePicker
              value={reportRange}
              onChange={(value) => {
                if (!value || !value[0] || !value[1]) return
                setReportRange([value[0], value[1]])
              }}
              allowClear={false}
            />
            <Typography.Text type="secondary">
              选区内共有 {eventsCountInReportRange} 个事件
            </Typography.Text>
          </Space>
        </WidgetSection>
      </WidgetLayout>

      <Modal
        open={modalVisible}
        title={editingEvent ? '编辑事件' : '创建事件'}
        onCancel={() => setModalVisible(false)}
        onOk={() => void handleModalSubmit()}
        confirmLoading={modalSubmitting}
        okText={editingEvent ? '保存修改' : '创建'}
        destroyOnHidden
        footer={[
          editingEvent ? (
            <Button key="delete" danger onClick={() => void handleDeleteEvent()}>
              删除
            </Button>
          ) : null,
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={modalSubmitting}
            onClick={() => void handleModalSubmit()}
          >
            {editingEvent ? '保存修改' : '创建事件'}
          </Button>,
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            category: defaultCategory,
            datetime: dayjs().minute(0).second(0),
            isAllDay: false,
            duration: DEFAULT_DURATION,
          }}
        >
          <Form.Item
            name="title"
            label="事件标题"
            rules={[{ required: true, message: '请输入事件标题' }]}
          >
            <Input placeholder="例如：项目例会 / 周报 / 复盘" />
          </Form.Item>
          <Form.Item
            name="datetime"
            label="开始时间"
            rules={[{ required: true, message: '请选择日期与时间' }]}
          >
            <DatePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="isAllDay" label="全天事件" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.isAllDay !== curr.isAllDay}>
            {({ getFieldValue }) =>
              !getFieldValue('isAllDay') && (
                <Form.Item
                  name="duration"
                  label="持续时长"
                  rules={[{ required: true, message: '请选择持续时长' }]}
                >
                  <Select
                    options={DURATION_OPTIONS.map((value) => ({
                      label: `${value} 分钟`,
                      value,
                    }))}
                  />
                </Form.Item>
              )
            }
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Select
              options={categoryEntries.map(([key, value]) => ({
                label: value.name,
                value: key,
              }))}
              placeholder="选择分类"
            />
          </Form.Item>
          <Form.Item name="description" label="备注">
            <Input.TextArea rows={3} placeholder="可选：补充会议信息或周报摘要" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={reportModalVisible}
        title="周报 Markdown"
        onCancel={() => setReportModalVisible(false)}
        width={720}
        footer={[
          <Button
            key="copy"
            icon={<CopyOutlined />}
            onClick={() => handleCopyReport()}
            disabled={!reportContent}
          >
            复制 Markdown
          </Button>,
          <Button key="close" onClick={() => setReportModalVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        <Typography.Paragraph>
          <pre
            style={{
              background: colors.codeBg,
              padding: 16,
              borderRadius: 8,
              color: colors.codeText,
              maxHeight: 320,
              overflow: 'auto',
            }}
          >
            {reportContent}
          </pre>
        </Typography.Paragraph>
      </Modal>
    </>
  )
}

export default CalendarWidget
