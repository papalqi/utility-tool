/**
 * AI Service IPC handlers
 */

import { ipcMain } from 'electron'
import {
  testConnection as aiTestConnection,
  callChatCompletion as aiChatCompletion,
  logConversation as aiLogConversation,
} from '../ai-service'
import type { GenericAIConfig, AIChatMessage, AIConversationLogEntry } from '@shared/ai'
import type { IpcContext } from './index'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerAiIpc(_context: IpcContext): void {
  ipcMain.handle('ai:testConnection', async (_event, config: GenericAIConfig) => {
    return aiTestConnection(config)
  })

  ipcMain.handle(
    'ai:chatCompletion',
    async (
      _event,
      payload: {
        config: GenericAIConfig
        messages: AIChatMessage[]
        temperature?: number
        maxTokens?: number
        feature?: string
        metadata?: Record<string, unknown>
        log?: boolean
      }
    ) => {
      return aiChatCompletion(payload)
    }
  )

  ipcMain.handle('ai:logConversation', async (_event, entry: AIConversationLogEntry) => {
    return aiLogConversation(entry)
  })
}
