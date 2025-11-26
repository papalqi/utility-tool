import { TodoItem } from '@/shared/types'

const PRIORITY_MAP: Record<string, TodoItem['priority']> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
}

const randomId = () =>
  window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random()}`

export interface ParsedAiTodoItem extends TodoItem {
  /**
   * Number of leading tab characters in the original markdown.
   * Tabs are preferred, but spaces are also supported (2 spaces = 1 level) for compatibility.
   */
  indentLevel: number
}

export function parseAiTodoMarkdown(markdown: string): ParsedAiTodoItem[] {
  const lines = markdown.split('\n')
  const todos: ParsedAiTodoItem[] = []
  const now = Date.now()
  const parentStack: ParsedAiTodoItem[] = []

  for (const rawLine of lines) {
    // 匹配 TAB 或空格缩进的 TODO 项
    const match = rawLine.match(/^(\s*)- \[( |x)\]\s*(.+)$/i)
    if (!match) continue

    const indent = match[1] || ''
    // 优先计算 TAB 数量作为层级，如果没有 TAB 则按空格计算（兼容：每2个空格为一层）
    const tabCount = (indent.match(/\t/g) || []).length
    const spaceCount = (indent.match(/ /g) || []).length
    const requestedIndent = tabCount > 0 ? tabCount : Math.floor(spaceCount / 2)
    const indentLevel = Math.min(requestedIndent, parentStack.length)
    const parent = indentLevel > 0 ? parentStack[indentLevel - 1] : undefined

    const done = match[2].toLowerCase() === 'x'
    let body = match[3].trim()

    let priority: TodoItem['priority'] = 'medium'
    if (body.startsWith('🔴')) {
      priority = 'high'
      body = body.replace(/^🔴\s*/, '')
    } else if (body.startsWith('🔵')) {
      priority = 'low'
      body = body.replace(/^🔵\s*/, '')
    }

    let category: string | undefined
    const categoryMatch = body.match(/^🏷️([^\s]+)\s*/)
    if (categoryMatch) {
      category = categoryMatch[1]
      body = body.replace(categoryMatch[0], '')
    }

    let dueDate: string | undefined
    const dueMatch = body.match(/📅(\d{4}-\d{2}-\d{2})/)
    if (dueMatch) {
      dueDate = dueMatch[1]
      body = body.replace(dueMatch[0], '').trim()
    }

    const tags = Array.from(body.matchAll(/#([\w-]+)/g)).map((matchItem) => matchItem[1])
    if (tags.length) {
      body = body.replace(/#([\w-]+)/g, '').trim()
    }

    // 提取笔记字段（📝 后面的内容）
    let note: string | undefined
    const noteMatch = body.match(/📝(.+)/)
    if (noteMatch) {
      note = noteMatch[1].trim()
      body = body.replace(/📝.+/, '').trim()
    }

    body = body.replace(/📎|📌|✅|⏰/g, '').trim()
    if (!body) continue

    const todo: ParsedAiTodoItem = {
      id: randomId(),
      text: body,
      done,
      category,
      priority: PRIORITY_MAP[priority] || 'medium',
      tags,
      dueDate,
      note: note || '',
      conclusion: '',
      createdAt: now,
      updatedAt: now,
      attachments: [],
      parentId: parent?.id,
      indentLevel,
    }

    todos.push(todo)
    parentStack[indentLevel] = todo
    parentStack.length = indentLevel + 1
  }

  return todos
}
