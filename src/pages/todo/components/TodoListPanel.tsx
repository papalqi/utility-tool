/* eslint-disable react/prop-types */
import React, { useCallback, useMemo, useState } from 'react'
import {
  Card,
  Tabs,
  Checkbox,
  Select,
  Tooltip,
  Row,
  Col,
  Input,
  Space,
  Button,
  Empty,
  Badge,
} from 'antd'
import { LinkOutlined, FileAddOutlined, RightOutlined, DownOutlined, DragOutlined } from '@ant-design/icons'
import type { TabsProps } from 'antd'
import { AttachmentThumbnail } from '@/components/AttachmentThumbnail'
import type { TodoItem } from '@/shared/types'
import { extractObsidianLinkTarget, stripObsidianLinks } from '../constants'
import { TodoActionBar } from './TodoActionBar'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type TreeTodo = TodoItem & { children?: TreeTodo[]; level?: number }

interface TodoListPanelProps {
  filteredItems: TodoItem[]
  categories: string[]
  selectedCategory: string
  quickAddCategory: string
  selectedTodo: TodoItem | null
  creatingNoteIds: Set<string>
  isEnabled: boolean
  aiLoading: boolean
  hasAiProvider: boolean
  onShowAdd: () => void
  onShowEdit: () => void
  onDelete: () => void
  onAiClipboardParse: () => void
  onMigrateLastWeekTasks: () => void
  onCategoryFilterChange: (value: string) => void
  onQuickAddCategoryChange: (value: string) => void
  onQuickAddParsed: (value: string) => void
  onSelectTodo: (todo: TodoItem) => void
  onToggleComplete: (item: TodoItem) => void
  onCategoryChange: (id: string, category: string) => void
  onPriorityChange: (id: string, priority: 'low' | 'medium' | 'high') => void
  onTodoNoteAction: (todo: TodoItem) => void
  onReorderTodos?: (itemId: string, newParentId: string | null) => void
}

const buildTree = (items: TodoItem[], doneFlag: boolean): TreeTodo[] => {
  // 去重：有时同一个 id 会在 filteredItems 中出现多份，这里统一按 id 去重
  const normalizedItems = Array.from(
    items.reduce<Map<string, TodoItem>>((map, item) => {
      map.set(item.id, item)
      return map
    }, new Map()).values()
  )

  // Robust check for done status, handling boolean, string 'true'/'false', and undefined
  const isDone = (d: boolean | string | undefined): boolean => {
    // Explicitly check for truthy done values
    if (d === true || d === 'true' || String(d).toLowerCase() === 'true') {
      return true
    }
    // Everything else (false, undefined, null, etc.) is considered not done
    return false
  }

  // Strategy: 
  // 1. For "active" tab (doneFlag=false): Show incomplete tasks and their children (regardless of children's status)
  // 2. For "completed" tab (doneFlag=true): Show completed tasks and their children (regardless of children's status)
  // This preserves the complete hierarchy for each parent task

  // Cache items for parent lookup
  const itemMap = new Map<string, TodoItem>(normalizedItems.map((it) => [it.id, it]))

  // First, get all items that match the done status
  const matchingRootItems = normalizedItems.filter((it) => {
    const itemDone = isDone(it.done)
    if (itemDone !== doneFlag) {
      return false
    }

    if (!it.parentId) {
      return true
    }

    const parent = itemMap.get(it.parentId)
    if (!parent) {
      return true
    }

    const parentDone = isDone(parent.done)
    if (doneFlag && !parentDone) {
      // parent is still active, do not show child in completed tab
      return false
    }

    // Only treat as non-root when parent is in the same tab (same doneFlag)
    return parentDone !== doneFlag
  })

  // Recursive function to collect all children of a given item
  const collectChildren = (itemId: string): TreeTodo[] => {
    const children = normalizedItems
      .filter((it) => it.parentId === itemId)
      .map((child) => {
        const treeNode: TreeTodo = { ...child }
        const grandChildren = collectChildren(child.id)
        if (grandChildren.length > 0) {
          treeNode.children = grandChildren
        }
        return treeNode
      })
    return children
  }

  // Build the tree starting from matching root items
  const roots: TreeTodo[] = matchingRootItems.map((rootItem) => {
    const treeNode: TreeTodo = { ...rootItem }
    const children = collectChildren(rootItem.id)
    if (children.length > 0) {
      treeNode.children = children
    }
    return treeNode
  })

  // Sort recursively
  const sortRec = (arr: TreeTodo[]) => {
    arr.sort((a, b) => a.createdAt - b.createdAt)
    for (const n of arr) if (n.children) sortRec(n.children)
  }
  sortRec(roots)

  // Assign levels
  const assignLevel = (arr: TreeTodo[], level: number) => {
    for (const n of arr) {
      n.level = level
      if (n.children) assignLevel(n.children, level + 1)
    }
  }
  assignLevel(roots, 0)

  return roots
}

const flattenTreeIds = (nodes: TreeTodo[]): string[] => {
  const ids: string[] = []
  const walk = (arr: TreeTodo[]) => {
    for (const node of arr) {
      ids.push(node.id)
      if (node.children) {
        walk(node.children)
      }
    }
  }
  walk(nodes)
  return ids
}

interface ThemeColors {
  primary: string
  primaryDark: string
  primaryLight: string
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
  textPrimary: string
  textSecondary: string
  borderPrimary: string
  success: string
  warning: string
  danger: string
  info: string
}

type DropHint = 'child' | 'root' | null

const ROOT_DROP_ZONE_IDS = {
  active: 'todo-root-drop-active',
  completed: 'todo-root-drop-completed',
} as const

const RootDropZone: React.FC<{
  id: string
  colors: ThemeColors
  dropHint: DropHint
}> = ({ id, colors, dropHint }) => {
  const { setNodeRef, isOver } = useDroppable({ id })
  const highlight = isOver || dropHint === 'root'

  return (
    <div
      ref={setNodeRef}
      style={{
        border: `2px dashed ${highlight ? colors.primary : colors.borderPrimary}`,
        borderRadius: 12,
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        background: highlight ? `${colors.primary}15` : colors.bgSecondary,
        color: highlight ? colors.primary : colors.textSecondary,
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      <DragOutlined />
      <span>拖到这里可将任务提升为顶层</span>
    </div>
  )
}

// 可拖拽的任务卡片包装组件
const SortableTodoItemCard: React.FC<{
  item: TreeTodo
  selected: boolean
  expanded: boolean
  onToggleExpand: () => void
  onSelect: () => void
  onToggle: () => void
  onCategoryChange: (val: string) => void
  onPriorityChange: (val: 'low' | 'medium' | 'high') => void
  onNoteAction: () => void
  creatingNote: boolean
  categories: string[]
  colors: ThemeColors
  onShowEdit: () => void
}> = (props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TodoItemCard {...props} />
    </div>
  )
}

// 卡片式任务组件
const TodoItemCard: React.FC<{
  item: TreeTodo
  selected: boolean
  expanded: boolean
  onToggleExpand: () => void
  onSelect: () => void
  onToggle: () => void
  onCategoryChange: (val: string) => void
  onPriorityChange: (val: 'low' | 'medium' | 'high') => void
  onNoteAction: () => void
  creatingNote: boolean
  categories: string[]
  colors: ThemeColors
  onShowEdit: () => void
}> = ({
  item,
  selected,
  expanded,
  onToggleExpand,
  onSelect,
  onToggle,
  onCategoryChange,
  onPriorityChange,
  onNoteAction,
  creatingNote,
  categories,
  colors,
  onShowEdit,
}) => {
  const displayText = stripObsidianLinks(item.text)
  const linkInfo = extractObsidianLinkTarget(item.text)
  const isParentTask = !item.parentId
  const hasChildren = item.children && item.children.length > 0

  // 优先级样式
  const getPriorityColor = (p: string) => {
    if (p === 'high') return colors.danger
    if (p === 'low') return colors.info
    return colors.warning
  }

  const priorityColor = getPriorityColor(item.priority || 'medium')

  return (
    <motion.div
      layout
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.01, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
      transition={{ duration: 0.2 }}
      onClick={onSelect}
      onDoubleClick={onShowEdit}
      style={{
        marginBottom: 8,
        marginLeft: (item.level || 0) * 24,
        background: selected ? 'rgba(var(--primary-rgb), 0.1)' : colors.bgSecondary,
        border: selected ? `1px solid ${colors.primary}` : `1px solid ${colors.borderPrimary}`,
        borderRadius: 12,
        padding: '12px 8px 12px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 左侧优先级指示条 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: priorityColor,
        }}
      />

      {/* 展开/折叠按钮 */}
      <div
        style={{ width: 20, display: 'flex', justifyContent: 'center', cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation()
          onToggleExpand()
        }}
      >
        {hasChildren &&
          (expanded ? (
            <DownOutlined style={{ fontSize: 10, color: colors.textSecondary }} />
          ) : (
            <RightOutlined style={{ fontSize: 10, color: colors.textSecondary }} />
          ))}
      </div>

      <Checkbox
        checked={item.done}
        onChange={(e) => {
          e.stopPropagation()
          onToggle()
        }}
      />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: item.done ? colors.textSecondary : colors.textPrimary,
            textDecoration: item.done ? 'line-through' : 'none',
            fontWeight: item.level === 0 ? 500 : 400,
            minWidth: 0,
          }}
        >
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{displayText}</span>
          {hasChildren && !expanded && (
            <Badge
              count={item.children!.length}
              style={{ backgroundColor: colors.bgTertiary, color: colors.textSecondary }}
            />
          )}
        </div>

        {/* Right Side Meta */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            flexShrink: 0,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {item.attachments && item.attachments.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <AttachmentThumbnail attachments={item.attachments} maxDisplay={2} />
            </div>
          )}

          <Select
            value={item.category || '默认'}
            size="small"
            variant="borderless"
            onChange={onCategoryChange}
            style={{ width: 'auto', minWidth: 60, textAlign: 'right', fontSize: 12, opacity: 0.8 }}
            popupMatchSelectWidth={false}
            suffixIcon={null}
          >
            {categories.map((cat) => (
              <Select.Option key={cat} value={cat}>
                {cat}
              </Select.Option>
            ))}
          </Select>

          <Select
            value={item.priority || 'medium'}
            size="small"
            variant="borderless"
            onChange={(val) => onPriorityChange(val as any)}
            style={{
              width: 'auto',
              minWidth: 50,
              textAlign: 'right',
              fontSize: 12,
              color: priorityColor,
              fontWeight: 500,
            }}
            suffixIcon={null}
          >
            <Select.Option value="high">High</Select.Option>
            <Select.Option value="medium">Med</Select.Option>
            <Select.Option value="low">Low</Select.Option>
          </Select>
        </div>
      </div>

      {isParentTask && (
        <Tooltip title={linkInfo ? '打开笔记' : '创建笔记'}>
          <Button
            type="text"
            size="small"
            icon={linkInfo ? <LinkOutlined /> : <FileAddOutlined />}
            disabled={creatingNote}
            onClick={(e) => {
              e.stopPropagation()
              onNoteAction()
            }}
            style={{ opacity: 0.6, marginLeft: 4 }}
          />
        </Tooltip>
      )}
    </motion.div>
  )
}

// 递归渲染列表
const TodoListRenderer: React.FC<{
  items: TreeTodo[]
  props: TodoListPanelProps
  colors: ThemeColors
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
  overItemId: string | null
}> = ({ items, props, colors, expandedIds, onToggleExpand, overItemId }) => {
  return (
    <>
      {items.map((item) => {
        const isDropTarget = overItemId === item.id

        return (
          <React.Fragment key={item.id}>
            <div
              style={{
                position: 'relative',
                border: isDropTarget ? `2px dashed ${colors.primary}` : 'none',
                borderRadius: isDropTarget ? 12 : 0,
                padding: isDropTarget ? 4 : 0,
                backgroundColor: isDropTarget ? `${colors.primary}15` : 'transparent',
                transition: 'all 0.2s ease',
              }}
            >
              <SortableTodoItemCard
                item={item}
                selected={props.selectedTodo?.id === item.id}
                expanded={expandedIds.has(item.id)}
                onToggleExpand={() => onToggleExpand(item.id)}
                onSelect={() => props.onSelectTodo(item)}
                onToggle={() => props.onToggleComplete(item)}
                onCategoryChange={(val) => props.onCategoryChange(item.id, val)}
                onPriorityChange={(val) => props.onPriorityChange(item.id, val)}
                onNoteAction={() => props.onTodoNoteAction(item)}
                creatingNote={props.creatingNoteIds.has(item.id)}
                categories={props.categories}
                colors={colors}
                onShowEdit={props.onShowEdit}
              />
            </div>
            <AnimatePresence initial={false}>
              {item.children && expandedIds.has(item.id) && (
                <motion.div
                  initial={false}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <TodoListRenderer
                    items={item.children}
                    props={props}
                    colors={colors}
                    expandedIds={expandedIds}
                    onToggleExpand={onToggleExpand}
                    overItemId={overItemId}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </React.Fragment>
        )
      })}
    </>
  )
}

export const TodoListPanel: React.FC<TodoListPanelProps> = (props) => {
  const { colors } = useTheme()
  const {
    filteredItems,
    categories,
    selectedCategory,
    quickAddCategory,
    isEnabled,
    onCategoryFilterChange,
    onQuickAddCategoryChange,
    onQuickAddParsed,
    onReorderTodos,
  } = props

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState('active')
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [overItemId, setOverItemId] = useState<string | null>(null)
  const [dropHint, setDropHint] = useState<DropHint>(null)
  const [dragOverlaySize, setDragOverlaySize] = useState<{ width: number; height: number } | null>(null)
  const [activeDragItem, setActiveDragItem] = useState<TodoItem | null>(null)

  const activeItems = useMemo(() => buildTree(filteredItems, false), [filteredItems])
  const completedItems = useMemo(() => buildTree(filteredItems, true), [filteredItems])

  // DnD 传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 拖动8px后才激活，避免误触
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const flattenTreeIds = useCallback((nodes: TreeTodo[]): string[] => {
    const ids: string[] = []
    const walk = (arr: TreeTodo[]) => {
      for (const node of arr) {
        ids.push(node.id)
        if (node.children) {
          walk(node.children)
        }
      }
    }
    walk(nodes)
    return ids
  }, [])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // 处理拖拽开始
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const activeId = event.active.id as string
      setActiveDragId(activeId)
      setOverItemId(null)
      setDropHint(null)

      const rect = event.active.rect.current
      const width = rect?.initial?.width ?? rect?.translated?.width
      const height = rect?.initial?.height ?? rect?.translated?.height
      if (width && height) {
        setDragOverlaySize({ width, height })
      } else {
        setDragOverlaySize(null)
      }

      const activeItem = filteredItems.find((item) => item.id === activeId) || null
      setActiveDragItem(activeItem)

    },
    [filteredItems]
  )

  // 处理拖拽覆盖（hover 状态）
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      const currentRootDropZoneId =
        activeTab === 'active' ? ROOT_DROP_ZONE_IDS.active : ROOT_DROP_ZONE_IDS.completed

      if (!over) {
        setOverItemId(null)
        setDropHint('root')
        return
      }

      if (over.id === currentRootDropZoneId) {
        setOverItemId(null)
        setDropHint('root')
        return
      }

      if (active.id === over.id) {
        setOverItemId(null)
        setDropHint(null)
        return
      }

      // 找到被拖拽的任务和目标任务
      const activeItem = filteredItems.find((item) => item.id === active.id)
      const overItem = filteredItems.find((item) => item.id === over.id)

      if (!activeItem || !overItem) {
        setOverItemId(null)
        setDropHint(null)
        return
      }

      // 防止将父任务拖到自己的子任务下（会造成循环引用）
      const isDescendant = (parentId: string, childId: string): boolean => {
        let current = filteredItems.find((item) => item.id === childId)
        while (current?.parentId) {
          if (current.parentId === parentId) {
            return true
          }
          current = filteredItems.find((item) => item.id === current!.parentId)
        }
        return false
      }

      if (isDescendant(activeItem.id, overItem.id)) {
        setOverItemId(null)
        setDropHint(null)
        return // 不允许拖拽
      }

      // 设置当前 hover 的目标
      setOverItemId(over.id as string)
      setDropHint('child')
    },
    [activeTab, filteredItems]
  )

  // 处理拖拽结束
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveDragId(null)
      setOverItemId(null)
      setDropHint(null)
      setDragOverlaySize(null)
      setActiveDragItem(null)

      if (!onReorderTodos) {
        return
      }

      const activeItem = filteredItems.find((item) => item.id === active.id)
      if (!activeItem) {
        return
      }

      if (!over) {
        onReorderTodos(activeItem.id, null)
        return
      }

      const currentRootDropZoneId =
        activeTab === 'active' ? ROOT_DROP_ZONE_IDS.active : ROOT_DROP_ZONE_IDS.completed

      if (over.id === currentRootDropZoneId) {
        onReorderTodos(activeItem.id, null)
        return
      }

      if (active.id === over.id) {
        return
      }

      const overItem = filteredItems.find((item) => item.id === over.id)
      if (!overItem) {
        return
      }

      // 防止循环引用
      const isDescendant = (parentId: string, childId: string): boolean => {
        let current = filteredItems.find((item) => item.id === childId)
        while (current?.parentId) {
          if (current.parentId === parentId) {
            return true
          }
          current = filteredItems.find((item) => item.id === current!.parentId)
        }
        return false
      }

      if (isDescendant(activeItem.id, overItem.id)) {
        return
      }

      onReorderTodos(activeItem.id, overItem.id)
    },
    [activeTab, filteredItems, onReorderTodos]
  )

  // 渲染当前 Tab 的内容
  const renderTabContent = (items: TreeTodo[], emptyText: string, tabKey: 'active' | 'completed') => {
    const rootDropZoneId =
      tabKey === 'active' ? ROOT_DROP_ZONE_IDS.active : ROOT_DROP_ZONE_IDS.completed
    const sortableIds = flattenTreeIds(items)

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
        <div style={{ height: '100%', overflow: 'auto', padding: '4px 12px 4px 4px' }}>
          {activeDragId ? (
            <RootDropZone id={rootDropZoneId} colors={colors} dropHint={dropHint} />
          ) : null}
          {items.length === 0 ? (
            <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <AnimatePresence initial={false} mode="sync">
                <TodoListRenderer
                  items={items}
                  props={props}
                  colors={colors}
                  expandedIds={expandedIds}
                  onToggleExpand={toggleExpand}
                  overItemId={overItemId}
                />
              </AnimatePresence>
            </SortableContext>
          )}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeDragId ? (
            <div
              style={{
                padding: '12px 16px',
                background: colors.bgSecondary,
                border: `1px solid ${colors.primary}`,
                borderRadius: 12,
                opacity: 0.95,
                boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
                width: dragOverlaySize?.width ?? 320,
                maxWidth: 520,
                fontSize: 13,
                color: colors.textPrimary,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                pointerEvents: 'none',
              }}
            >
              <DragOutlined style={{ color: colors.primary, fontSize: 14 }} />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {stripObsidianLinks(activeDragItem?.text || '拖动中...')}
                </span>
                {dropHint === 'child' ? (
                  <span style={{ fontSize: 11, color: colors.textSecondary }}>→ 成为子任务</span>
                ) : null}
                {dropHint === 'root' ? (
                  <span style={{ fontSize: 11, color: colors.textSecondary }}>→ 成为顶层任务</span>
                ) : null}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    )
  }

  const tabItems: TabsProps['items'] = [
    {
      key: 'active',
      label: `进行中 (${activeItems.length})`,
      children: renderTabContent(activeItems, '暂无待办任务', 'active'),
    },
    {
      key: 'completed',
      label: `已完成 (${completedItems.length})`,
      children: renderTabContent(completedItems, '暂无已完成任务', 'completed'),
    },
  ]

  return (
    <Card
      style={{
        height: '100%',
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
      }}
      styles={{ body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' } }}
    >
      <TodoActionBar
        isEnabled={isEnabled}
        aiLoading={props.aiLoading}
        hasAiProvider={props.hasAiProvider}
        onAdd={props.onShowAdd}
        onEdit={props.onShowEdit}
        onDelete={props.onDelete}
        onAiParse={props.onAiClipboardParse}
        onMigrateLastWeek={props.onMigrateLastWeekTasks}
      />

      <Space style={{ margin: '16px 0' }} wrap>
        <Select
          value={selectedCategory}
          onChange={onCategoryFilterChange}
          style={{ width: 150 }}
          disabled={!isEnabled}
          variant="filled"
        >
          <Select.Option value="全部分类">全部分类</Select.Option>
          {categories.map((cat) => (
            <Select.Option key={cat} value={cat}>
              {cat}
            </Select.Option>
          ))}
        </Select>
      </Space>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          background: colors.bgSecondary,
          borderRadius: 16,
          padding: 16,
          border: `1px solid ${colors.borderPrimary}`,
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          destroyInactiveTabPane={true}
          className="full-height-tabs"
          style={{ height: '100%' }}
          animated={false}
        />
      </div>

      <Row gutter={8} style={{ marginTop: '16px' }}>
        <Col flex="auto">
          <Input.Search
            placeholder="快速添加任务... (使用 > 分隔层级)"
            enterButton="添加"
            size="large"
            onSearch={(v) => onQuickAddParsed(v)}
            disabled={!isEnabled}
          />
        </Col>
        <Col>
          <Select
            value={quickAddCategory}
            onChange={onQuickAddCategoryChange}
            style={{ width: 120 }}
            size="large"
            disabled={!isEnabled}
          >
            {categories.map((cat) => (
              <Select.Option key={cat} value={cat}>
                {cat}
              </Select.Option>
            ))}
          </Select>
        </Col>
      </Row>
    </Card>
  )
}
