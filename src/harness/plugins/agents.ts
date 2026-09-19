/**
 * Builtin `ctx.agents` provider — the turn/step agent loop, after the dsh
 * model: the conversation history is the single model-visible context, each
 * step is one model request plus its tool calls, and a tool failure becomes
 * structured content for the next step instead of killing the turn.
 */
import { Context, Service } from '@cordisjs/core'
import type { AgentEvent, AgentsService, LlmChatMessage } from '../services'

const SYSTEM_PROMPT = [
  '你是 VisionBridge 的屏幕助手（Agent 模式）。',
  '你可以调用工具来截屏、读取屏幕文字、针对屏幕内容提问、查询历史记录。',
  '规则：',
  '1. 需要屏幕信息时先调用 capture_screen，再用 ask_about_screen 或 ocr_screen 获取内容。',
  '2. 工具返回 JSON 带 error 字段说明调用失败，可修正参数重试。',
  '3. 回答用简洁的中文；仅在信息足够时给出最终答案，不要编造屏幕内容。',
].join('\n')

/** Agent 跑在哪条对话模型上：按当前模式取主对话模型，为空时逐级回退到第一个有模型名的配置。 */
function resolveAgentConfig(s: any): { provider: string; apiKey: string; baseUrl: string; model: string } {
  const candidates = [
    s?.mode === 'VLM' || s?.mode === 'VLM+LLM'
      ? { provider: s?.vlmProvider, apiKey: s?.vlmApiKey, baseUrl: s?.vlmBaseUrl, model: s?.vlmModel }
      : { provider: s?.llmProvider, apiKey: s?.llmApiKey, baseUrl: s?.llmBaseUrl, model: s?.llmModel },
    { provider: s?.llmProvider, apiKey: s?.llmApiKey, baseUrl: s?.llmBaseUrl, model: s?.llmModel },
    { provider: s?.vlmProvider, apiKey: s?.vlmApiKey, baseUrl: s?.vlmBaseUrl, model: s?.vlmModel },
    { provider: s?.llm2Provider, apiKey: s?.llm2ApiKey, baseUrl: s?.llm2BaseUrl, model: s?.llm2Model },
  ]
  const ok = (c: any) => c && c.model && String(c.model).trim() !== ''
  const pick = candidates.find(ok)
  if (!pick) {
    throw new Error('Agent 需要至少一个已配置模型：请在设置的模型页填写模型名称。')
  }
  return { provider: pick.provider || 'ollama', apiKey: pick.apiKey || '', baseUrl: pick.baseUrl || '', model: String(pick.model).trim() }
}

export class Agents extends Service implements AgentsService {
  static [Service.provide] = 'agents'
  static [Service.immediate] = true

  constructor(ctx: Context) {
    super(ctx)
  }

  async run(opts: {
    userText: string
    images?: string[]
    maxSteps?: number
    onEvent?: (e: AgentEvent) => void
  }): Promise<{ content: string; steps: number }> {
    const { userText, images, onEvent } = opts
    const maxSteps = Math.max(1, opts.maxSteps ?? 8)
    const settings = await (window.ipcRenderer as any).getSettings()
    const config = resolveAgentConfig(settings)

    const messages: LlmChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userText, images: images?.length ? images : undefined },
    ]
    const tools = this.ctx.tools.list()
    let lastContent = ''

    for (let step = 0; step < maxSteps; step++) {
      onEvent?.({ type: 'step', index: step })
      const r = await this.ctx.llm.chatTools(config, { messages, tools })
      lastContent = r.content
      if (!r.toolCalls.length) {
        return { content: r.content || '（模型未返回内容）', steps: step + 1 }
      }

      // Assistant message carrying the issued calls, then each tool result.
      messages.push({ role: 'assistant', content: r.content, toolCalls: r.toolCalls })
      for (const call of r.toolCalls) {
        let args: Record<string, unknown> = {}
        try { args = JSON.parse(call.arguments || '{}') } catch { /* keep {} */ }
        onEvent?.({ type: 'tool-call', name: call.name, args })
        const t0 = Date.now()
        const result = await this.ctx.tools.execute(call.name, args)
        const preview = result.content.length > 300 ? result.content.slice(0, 300) + '…' : result.content
        const ok = !result.content.includes('"error"')
        onEvent?.({ type: 'tool-result', name: call.name, ok, ms: Date.now() - t0, preview })
        messages.push({ role: 'tool', content: result.content, toolCallId: call.id })
      }
    }

    return { content: lastContent || `已达到最大步数（${maxSteps}），模型仍在调用工具。`, steps: maxSteps }
  }
}
