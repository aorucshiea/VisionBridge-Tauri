/**
 * Builtin `ctx.llm` provider.
 *
 * M1: delegates to the platform IPC bridge — Tauri's ipc.ts shims these to the
 * renderer-side fetch client (src/lib/ai.ts), Electron's preload bounces to the
 * main process. Routing through the bridge keeps behaviour byte-identical on
 * both platforms; a direct-fetch provider plugin can replace this later
 * without touching consumers.
 *
 * Every call is timed and recorded through `ctx.sessions` (调用记录).
 */
import { Context, Service } from '@cordisjs/core'
import type {
  LlmChatConfig, LlmChatMessage, LlmChatPayload, LlmChatResult, LlmChatToolsResult, LlmDeltaSender, LlmService, ToolSchema,
} from '../services'

function ipc(): any {
  return window.ipcRenderer as any
}

export class Llm extends Service implements LlmService {
  static [Service.provide] = 'llm'
  static [Service.immediate] = true

  constructor(ctx: Context) {
    super(ctx)
  }

  private sessions() {
    return this.ctx.sessions
  }

  /** Streaming when the platform bridge supports it; falls back like before. */
  async chat(
    config: LlmChatConfig,
    payload: LlmChatPayload,
    onDelta?: LlmDeltaSender,
  ): Promise<LlmChatResult> {
    return await this.sessions().track(
      'chat', config,
      () => this._chat(config, payload, onDelta),
      { inputChars: payload.prompt?.length || 0, images: payload.images?.length || 0 },
    )
  }

  private async _chat(
    config: LlmChatConfig,
    payload: LlmChatPayload,
    onDelta?: LlmDeltaSender,
  ): Promise<LlmChatResult> {
    const bridge = ipc()
    if (onDelta && typeof bridge.callAIStream === 'function') {
      return await bridge.callAIStream(config, payload, onDelta)
    }
    return { content: await bridge.callAI(config, payload), reasoning: '' }
  }

  async chatOnce(config: LlmChatConfig, payload: LlmChatPayload): Promise<string> {
    return await this.chat(config, payload).then(r => r.content)
  }

  async chatTools(
    config: LlmChatConfig,
    payload: { messages: LlmChatMessage[]; tools: ToolSchema[] },
  ): Promise<LlmChatToolsResult> {
    const bridge = ipc()
    if (typeof bridge.chatTools !== 'function') {
      throw new Error('当前平台桥不支持工具调用（chatTools）')
    }
    return await this.sessions().track('chat', config, () => bridge.chatTools(config, payload), {
      inputChars: payload.messages.reduce((n, m) => n + (m.content?.length || 0), 0),
      images: payload.messages.reduce((n, m) => n + (m.images?.length || 0), 0),
    })
  }

  async ocr(config: LlmChatConfig, imageBase64: string): Promise<string> {
    return await this.sessions().track('ocr', config, () => ipc().callOCR(config, imageBase64), { images: 1 })
  }

  async imagegen(config: LlmChatConfig, prompt: string): Promise<string> {
    return await this.sessions().track('imagegen', config, () => ipc().callImageGen(config, prompt), { inputChars: prompt.length })
  }

  async tts(config: LlmChatConfig & { voice?: string }, text: string): Promise<string> {
    return await this.sessions().track('tts', config, () => ipc().callTTS(config, text), { inputChars: text.length })
  }

  async asr(config: LlmChatConfig, audioBase64: string): Promise<string> {
    return await this.sessions().track('asr', config, () => ipc().callASR(config, audioBase64))
  }

  async listModels(config: Omit<LlmChatConfig, 'model'> & { model?: string }): Promise<string[]> {
    return await this.sessions().track(
      'listModels', { provider: config.provider, model: config.model || '', baseUrl: config.baseUrl },
      () => ipc().listModels(config),
    )
  }
}
