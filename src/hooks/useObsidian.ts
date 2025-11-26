/**
 * useObsidian Hook - Obsidian 集成读写封装
 *
 * 提供对 Obsidian 的统一读写接口
 */

import { obsidianManager } from '../core/ObsidianManager'
import { TodoItem, CalendarEvent, PomodoroSession } from '../shared/types'

/**
 * 轻量级 Obsidian Hook
 *
 * 说明：
 * - 是否启用通过 obsidianManager.isEnabled() 获取
 * - 不直接订阅配置变化，依赖外层组件的重渲染
 */
export function useObsidian() {
  const isEnabled = obsidianManager.isEnabled()

  const syncTodoItems = async (items: TodoItem[], template: string) => {
    await obsidianManager.syncTodoItems(items, template)
  }

  const readTodoItems = async (template: string) => {
    return await obsidianManager.readTodoItems(template)
  }

  const syncCalendarEvents = async (events: CalendarEvent[], template: string) => {
    await obsidianManager.syncCalendarEvents(events, template)
  }

  const readCalendarEvents = async (template: string) => {
    return await obsidianManager.readCalendarEvents(template)
  }

  const syncPomodoroSessions = async (sessions: PomodoroSession[], template: string) => {
    await obsidianManager.syncPomodoroSessions(sessions, template)
  }

  const readPomodoroSessions = async (template: string) => {
    return await obsidianManager.readPomodoroSessions(template)
  }

  const readSecrets = async () => {
    return await obsidianManager.readSecrets()
  }

  const writeSecrets = async (secrets: Record<string, string>) => {
    await obsidianManager.writeSecrets(secrets)
  }

  const updateSecret = async (key: string, value: string) => {
    return await obsidianManager.updateSecret(key, value)
  }

  return {
    isEnabled,
    syncTodoItems,
    readTodoItems,
    syncCalendarEvents,
    readCalendarEvents,
    syncPomodoroSessions,
    readPomodoroSessions,
    readSecrets,
    writeSecrets,
    updateSecret,
  }
}

export default useObsidian
