/**
 * Harness service seams.
 *
 * VisionBridge is becoming a plugin-based agent runtime (the DeepSeek Harness
 * / cordis model): every capability is a named service on the cordis Context,
 * contributed by a plugin, replaceable without touching consumers.
 *
 * M1 keeps behaviour identical — `ctx.llm` routes to the same platform backend
 * the app used before (Tauri renderer fetch via ipc shim / Electron main
 * process via preload). Later milestones can register alternative providers,
 * agent loops, or tool pipelines against the same seams.
 */

export interface LlmChatConfig {
  provider: string
  apiKey: string
  baseUrl: string
  model: string
}

export interface LlmChatPayload {
  prompt: string
  images?: string[] // base64, no data: prefix
  messages?: Array<{ role: string; content: any }>
}

export interface LlmChatResult {
  content: string
  reasoning: string
}

export type LlmDeltaSender = (delta: { content?: string; reasoning?: string }) => void

export interface LlmService {
  /** Chat completion; streams through `onDelta` when provided. */
  chat(config: LlmChatConfig, payload: LlmChatPayload, onDelta?: LlmDeltaSender): Promise<LlmChatResult>
  /** Non-streaming chat (plain text result). */
  chatOnce(config: LlmChatConfig, payload: LlmChatPayload): Promise<string>
  /** Vision OCR — model asked to transcribe an image. */
  ocr(config: LlmChatConfig, imageBase64: string): Promise<string>
  /** Image generation (OpenAI-compatible endpoints only). */
  imagegen(config: LlmChatConfig, prompt: string): Promise<string>
  /** Text to speech; returns base64 mp3. */
  tts(config: LlmChatConfig & { voice?: string }, text: string): Promise<string>
  /** Speech to text from base64 mp3. */
  asr(config: LlmChatConfig, audioBase64: string): Promise<string>
  /** The vendor's live model catalogue. */
  listModels(config: Omit<LlmChatConfig, 'model'> & { model?: string }): Promise<string[]>
}

export interface ScreenshotRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface CaptureService {
  /** Capture a screen region, returns base64 (no data: prefix). */
  region(region: ScreenshotRegion): Promise<string>
}

// Typed seams for the cordis context: `ctx.llm` / `ctx.capture`.
declare module '@cordisjs/core' {
  interface Context {
    llm: LlmService
    capture: CaptureService
  }
}
