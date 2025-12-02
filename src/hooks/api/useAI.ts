/**
 * AI 聊天 Hook
 * 封装 AI 相关的 IPC 调用
 */

import { useState, useCallback } from 'react'
import { ipc } from '@/core/ipc-client'

// ==================== 类型定义 ====================

export interface AIConfig {
  provider: string
  apiKey: string
  baseUrl?: string
  model?: string
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AICompletionResult {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

interface UseAIReturn {
  messages: AIMessage[]
  loading: boolean
  error: Error | null
  sendMessage: (content: string) => Promise<string>
  clearMessages: () => void
  testConnection: (config: AIConfig) => Promise<boolean>
}

interface UseAIOptions {
  config: AIConfig
  systemPrompt?: string
  feature?: string
  enableLogging?: boolean
}

// ==================== Hook 实现 ====================

/**
 * AI 聊天 Hook
 * 
 * @example
 * ```tsx
 * function AIChat() {
 *   const { messages, loading, sendMessage } = useAI({
 *     config: { provider: 'openai', apiKey: '...', model: 'gpt-4' },
 *     systemPrompt: 'You are a helpful assistant.',
 *     feature: 'chat',
 *   })
 *   
 *   const handleSend = async (input: string) => {
 *     const response = await sendMessage(input)
 *     console.log('AI responded:', response)
 *   }
 *   
 *   return (
 *     <div>
 *       {messages.map((msg, i) => (
 *         <Message key={i} role={msg.role} content={msg.content} />
 *       ))}
 *       <Input onSubmit={handleSend} disabled={loading} />
 *     </div>
 *   )
 * }
 * ```
 */
export function useAI(options: UseAIOptions): UseAIReturn {
  const { config, systemPrompt, feature = 'chat', enableLogging = true } = options

  const [messages, setMessages] = useState<AIMessage[]>(() =>
    systemPrompt ? [{ role: 'system', content: systemPrompt }] : []
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // 发送消息
  const sendMessage = useCallback(
    async (content: string): Promise<string> => {
      const userMessage: AIMessage = { role: 'user', content }
      const newMessages = [...messages, userMessage]
      setMessages(newMessages)
      setLoading(true)
      setError(null)

      try {
        const result = await ipc.invoke('ai:chatCompletion', {
          config,
          messages: newMessages,
          feature,
          log: enableLogging,
        })

        const completion = result as AICompletionResult
        const assistantMessage: AIMessage = {
          role: 'assistant',
          content: completion.content,
        }

        setMessages([...newMessages, assistantMessage])
        return completion.content
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e))
        setError(err)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [messages, config, feature, enableLogging]
  )

  // 清除消息
  const clearMessages = useCallback(() => {
    setMessages(systemPrompt ? [{ role: 'system', content: systemPrompt }] : [])
    setError(null)
  }, [systemPrompt])

  // 测试连接
  const testConnection = useCallback(
    async (testConfig: AIConfig): Promise<boolean> => {
      try {
        const result = await ipc.invoke('ai:testConnection', testConfig)
        const testResult = result as { success: boolean }
        return testResult.success
      } catch {
        return false
      }
    },
    []
  )

  return {
    messages,
    loading,
    error,
    sendMessage,
    clearMessages,
    testConnection,
  }
}
