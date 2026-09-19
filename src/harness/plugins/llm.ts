/**
 * Builtin `ctx.llm` provider.
 *
 * M1: delegates to the platform IPC bridge — Tauri's ipc.ts shims these to the
 * renderer-side fetch client (src/lib/ai.ts), Electron's preload bounces to the
 * main process. Routing through the bridge keeps behaviour byte-identical on
 * both platforms; a direct-fetch provider plugin can replace this later
 * without touching consumers.
 */
import { Context, Service } from '@cordisjs/core'
import type {
  LlmChatConfig, LlmChatPayload, LlmChatResult, LlmDeltaSender, LlmService,
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

  /** Streaming when the platform bridge supports it; falls back like before. */
  async chat(
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

  async ocr(config: LlmChatConfig, imageBase64: string): Promise<string> {
    return await ipc().callOCR(config, imageBase64)
  }

  async imagegen(config: LlmChatConfig, prompt: string): Promise<string> {
    return await ipc().callImageGen(config, prompt)
  }

  async tts(config: LlmChatConfig & { voice?: string }, text: string): Promise<string> {
    return await ipc().callTTS(config, text)
  }

  async asr(config: LlmChatConfig, audioBase64: string): Promise<string> {
    return await ipc().callASR(config, audioBase64)
  }

  async listModels(config: Omit<LlmChatConfig, 'model'> & { model?: string }): Promise<string[]> {
    return await ipc().listModels(config)
  }
}
