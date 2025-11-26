import { join } from 'path'
import { promises as fs } from 'fs'
import { performance } from 'perf_hooks'
import {
  GenericAIConfig,
  AIChatMessage,
  AICompletionResult,
  AIConversationLogEntry,
  AITestConnectionResult,
} from '@shared/ai'

export interface ChatCompletionOptions {
  config: GenericAIConfig
  messages: AIChatMessage[]
  temperature?: number
  maxTokens?: number
  feature?: string
  metadata?: Record<string, unknown>
  log?: boolean
}

interface ProviderRequestPayload {
  url: string
  init: RequestInit
  parse: (response: any) => AICompletionResult
}

class ConversationLogger {
  private baseDir: string

  constructor(baseDir?: string) {
    this.baseDir = baseDir || join(process.cwd(), 'AI调用历史')
  }

  private async ensureDir(path: string) {
    await fs.mkdir(path, { recursive: true })
  }

  async logConversation(options: AIConversationLogEntry): Promise<string> {
    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const dateStr = `${yearMonth}-${String(now.getDate()).padStart(2, '0')}`
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(
      now.getSeconds()
    ).padStart(2, '0')}`

    const monthDir = join(this.baseDir, yearMonth)
    await this.ensureDir(monthDir)

    const logFile = join(monthDir, `${dateStr}.md`)
    let fileExists = true
    try {
      await fs.access(logFile)
    } catch {
      fileExists = false
    }

    const lines: string[] = []
    if (!fileExists) {
      lines.push(`# AI 调用历史 - ${dateStr}`, '')
    }

    const statusEmoji = options.success ? '✅' : '❌'
    lines.push(`## ${timeStr} - ${options.feature} ${statusEmoji}`, '')
    lines.push(`**提供商**: ${options.provider}${options.model ? ` (${options.model})` : ''}  `)
    lines.push(`**功能**: ${options.feature}  `)
    if (typeof options.duration === 'number') {
      lines.push(`**耗时**: ${options.duration.toFixed(2)} 秒  `)
    }

    if (options.usage) {
      lines.push(
        `**Token 使用**: 输入 ${options.usage.promptTokens ?? 0} | 输出 ${
          options.usage.completionTokens ?? 0
        } | 总计 ${options.usage.totalTokens ?? 0}  `
      )
    }

    if (typeof options.cost === 'number' && options.cost > 0) {
      lines.push(`**成本**: $${options.cost.toFixed(6)}  `)
    }

    lines.push('')

    if (!options.success && options.errorMessage) {
      lines.push('### ❌ 错误信息', '', '```', options.errorMessage, '```', '')
    }

    lines.push('### 📥 用户输入（提示词）', '', '<details>', `<summary>点击展开完整提示词 (${options.prompt.length} 字符)</summary>`, '', '```', options.prompt, '```', '', '</details>', '')

    if (options.success && options.response) {
      lines.push('### 🤖 AI 响应', '', '```markdown', options.response, '```', '')
    }

    if (options.metadata && Object.keys(options.metadata).length > 0) {
      lines.push('### 📊 解析结果', '')
      for (const [key, value] of Object.entries(options.metadata)) {
        if (key === 'todo_items' && Array.isArray(value)) {
          lines.push(`- ✅ 成功解析 ${value.length} 个 TODO 项目`)
        } else {
          lines.push(`- **${key}**: ${JSON.stringify(value)}`)
        }
      }
      lines.push('')
    }

    lines.push('---', '')

    await fs.appendFile(logFile, lines.join('\n'), { encoding: 'utf-8' })
    return logFile
  }
}

const conversationLogger = new ConversationLogger()

function combineMessages(messages: AIChatMessage[]): string {
  return messages.map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n')
}

function normalizeProvider(provider: string): string {
  return provider?.toLowerCase() || 'custom'
}

function toAnthropicMessages(messages: AIChatMessage[]) {
  const converted = []
  let systemPrompt = ''

  for (const message of messages) {
    if (message.role === 'system') {
      systemPrompt = `${systemPrompt}\n${message.content}`.trim()
      continue
    }
    converted.push({
      role: message.role,
      content: [{ type: 'text', text: message.content }],
    })
  }

  return { systemPrompt, converted }
}

function toGoogleParts(messages: AIChatMessage[]) {
  const content = combineMessages(messages)
  return [
    {
      role: 'user',
      parts: [{ text: content }],
    },
  ]
}

function estimateCost(provider: string, model: string | undefined, usage?: AICompletionResult['usage']) {
  if (!usage) return 0
  const prompt = usage.promptTokens ?? 0
  const completion = usage.completionTokens ?? 0
  const lowerModel = (model || '').toLowerCase()
  const p = provider.toLowerCase()

  if (p.includes('deepseek')) {
    return (prompt / 1000) * 0.0001 + (completion / 1000) * 0.0002
  }
  if (p.includes('google') || lowerModel.includes('gemini')) {
    return (prompt / 1000) * 0.00025 + (completion / 1000) * 0.0005
  }
  if (lowerModel.includes('gpt-3.5')) {
    return (prompt / 1000) * 0.0015 + (completion / 1000) * 0.002
  }
  if (lowerModel.includes('gpt-4')) {
    return (prompt / 1000) * 0.03 + (completion / 1000) * 0.06
  }
  return 0
}

async function performRequest(payload: ProviderRequestPayload, timeoutMs: number): Promise<AICompletionResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(payload.url, {
      ...payload.init,
      signal: controller.signal,
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`HTTP ${response.status}: ${text}`)
    }
    const json = await response.json()
    return payload.parse(json)
  } finally {
    clearTimeout(timeout)
  }
}

function buildOpenAIPayload(options: ChatCompletionOptions): ProviderRequestPayload {
  const provider = normalizeProvider(options.config.provider)
  let endpoint = options.config.url?.trim()
  if (!endpoint) {
    endpoint = provider === 'deepseek' ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/chat/completions'
  }

  if (provider === 'deepseek') {
    endpoint = endpoint.replace(/\/+$/, '')
    if (endpoint.endsWith('/v1')) {
      endpoint = endpoint.slice(0, -3)
    }
    if (!endpoint.endsWith('/chat/completions')) {
      endpoint = `${endpoint}/chat/completions`
    }
  }

  const model = options.config.model || 'gpt-3.5-turbo'
  const body = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 512,
  }

  return {
    url: endpoint,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.config.key}`,
      },
      body: JSON.stringify(body),
    },
    parse: (data: any) => {
      const content = data?.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('OpenAI 响应缺少内容')
      }
      return {
        content,
        usage: {
          promptTokens: data?.usage?.prompt_tokens,
          completionTokens: data?.usage?.completion_tokens,
          totalTokens: data?.usage?.total_tokens,
        },
        rawResponse: data,
      }
    },
  }
}

function buildAnthropicPayload(options: ChatCompletionOptions): ProviderRequestPayload {
  const endpoint = options.config.url?.trim() || 'https://api.anthropic.com/v1/messages'
  const model = options.config.model || 'claude-3-sonnet-20240229'
  const { systemPrompt, converted } = toAnthropicMessages(options.messages)
  const body: any = {
    model,
    messages: converted,
    max_tokens: options.maxTokens ?? 512,
    temperature: options.temperature ?? 0.2,
  }
  if (systemPrompt) {
    body.system = systemPrompt
  }

  return {
    url: endpoint,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': options.config.key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    },
    parse: (data: any) => {
      const content = data?.content?.[0]?.text ?? data?.content?.[0]?.content?.[0]?.text
      if (!content) {
        throw new Error('Anthropic 响应缺少内容')
      }
      return {
        content,
        usage: {
          promptTokens: data?.usage?.input_tokens,
          completionTokens: data?.usage?.output_tokens,
          totalTokens:
            data?.usage?.input_tokens !== undefined && data?.usage?.output_tokens !== undefined
              ? data.usage.input_tokens + data.usage.output_tokens
              : undefined,
        },
        rawResponse: data,
      }
    },
  }
}

function buildGooglePayload(options: ChatCompletionOptions): ProviderRequestPayload {
  const model = options.config.model || 'gemini-pro'
  const baseUrl = options.config.url?.trim() || `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const url = baseUrl.includes('?') ? `${baseUrl}&key=${options.config.key}` : `${baseUrl}?key=${options.config.key}`
  const contents = toGoogleParts(options.messages)

  return {
    url,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: options.temperature ?? 0.2,
        },
      }),
    },
    parse: (data: any) => {
      const content = data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text).join('\n')
      if (!content) {
        throw new Error('Gemini 响应缺少内容')
      }
      return {
        content,
        rawResponse: data,
      }
    },
  }
}

function buildGenericPayload(options: ChatCompletionOptions): ProviderRequestPayload {
  const endpoint = options.config.url?.trim()
  if (!endpoint) {
    throw new Error('未配置 API 端点 URL')
  }

  const body = {
    model: options.config.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 512,
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (options.config.key) {
    headers.Authorization = `Bearer ${options.config.key}`
  }

  return {
    url: endpoint,
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    },
    parse: (data: any) => {
      const content =
        data?.choices?.[0]?.message?.content ??
        data?.result ??
        data?.content ??
        (Array.isArray(data) ? data.join('\n') : '')
      if (!content) {
        throw new Error('API 响应缺少内容')
      }
      return {
        content,
        rawResponse: data,
      }
    },
  }
}

export async function callChatCompletion(options: ChatCompletionOptions): Promise<AICompletionResult> {
  const provider = normalizeProvider(options.config.provider)
  const timeoutMs = (options.config.timeout || 30) * 1000

  let payload: ProviderRequestPayload
  switch (provider) {
    case 'openai':
    case 'deepseek':
      payload = buildOpenAIPayload(options)
      break
    case 'anthropic':
      payload = buildAnthropicPayload(options)
      break
    case 'google':
    case 'gemini':
      payload = buildGooglePayload(options)
      break
    default:
      payload = buildGenericPayload(options)
      break
  }

  const start = performance.now()
  const result = await performRequest(payload, timeoutMs)
  const end = performance.now()

  if (options.log !== false) {
    try {
      const usage = result.usage
      const cost = estimateCost(provider, options.config.model, usage)
      await conversationLogger.logConversation({
        feature: options.feature || 'AI 对话',
        provider: options.config.provider,
        model: options.config.model,
        prompt: combineMessages(options.messages),
        response: result.content,
        usage,
        duration: (end - start) / 1000,
        success: true,
        metadata: options.metadata,
        cost,
      })
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Failed to log AI conversation', error)
    }
  }

  return result
}

export async function testConnection(config: GenericAIConfig): Promise<AITestConnectionResult> {
  const start = performance.now()
  try {
    await callChatCompletion({
      config,
      messages: [{ role: 'user', content: 'ping' }],
      maxTokens: 8,
      temperature: 0,
      log: false,
      feature: '连接测试',
    })
    return {
      success: true,
      latency: performance.now() - start,
    }
  } catch (error) {
    return {
      success: false,
      latency: performance.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function logConversation(entry: AIConversationLogEntry) {
  return conversationLogger.logConversation(entry)
}
