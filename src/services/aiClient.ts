import {
  GenericAIConfig,
  AIChatMessage,
  AICompletionResult,
  AITestConnectionResult,
  AIConversationLogEntry,
} from '@/shared/ai'

export interface AIChatCompletionPayload {
  config: GenericAIConfig
  messages: AIChatMessage[]
  temperature?: number
  maxTokens?: number
  feature?: string
  metadata?: Record<string, unknown>
  log?: boolean
}

export const aiClient = {
  async testConnection(config: GenericAIConfig): Promise<AITestConnectionResult> {
    return window.electronAPI.aiTestConnection(config)
  },

  async chatCompletion(payload: AIChatCompletionPayload): Promise<AICompletionResult> {
    return window.electronAPI.aiChatCompletion(payload)
  },

  async logConversation(entry: AIConversationLogEntry): Promise<string> {
    return window.electronAPI.aiLogConversation(entry)
  },
}

export default aiClient
