export type AIProvider =
  | 'OpenAI'
  | 'Anthropic'
  | 'Google'
  | 'Azure'
  | 'DeepSeek'
  | 'Custom'
  | string

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GenericAIConfig {
  id: string
  name: string
  key: string
  url?: string
  provider: AIProvider
  model?: string
  timeout?: number
  enabled?: boolean
}

export interface AICompletionUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface AICompletionResult {
  content: string
  usage?: AICompletionUsage
  rawResponse: unknown
}

export interface AIConversationLogEntry {
  feature: string
  provider: string
  model?: string
  prompt: string
  response?: string
  usage?: AICompletionUsage
  duration?: number
  success: boolean
  errorMessage?: string
  metadata?: Record<string, unknown>
  cost?: number
}

export interface AITestConnectionResult {
  success: boolean
  latency: number
  error?: string
}
