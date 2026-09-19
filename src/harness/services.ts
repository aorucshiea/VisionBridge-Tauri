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

// ---------------------------------------------------------------------------
// ctx.sessions — conversation & invocation records (the harness "logbook").
//
// Every model call flowing through ctx.llm is recorded automatically; capture
// runs and opt-in follow-up chats are recorded as conversations. Storage is a
// window-local kv store (one record per key, no cross-window write races).
// ---------------------------------------------------------------------------

export type CallKind = 'chat' | 'ocr' | 'imagegen' | 'tts' | 'asr' | 'listModels'

export interface CallRecord {
  id: string
  ts: number
  kind: CallKind
  provider: string
  model: string
  baseUrl: string
  durationMs: number
  ok: boolean
  error?: string
  inputChars?: number
  images?: number
  outputChars?: number
  preview?: string
}

export interface SessionMessage {
  role: 'user' | 'assistant'
  content: string
  reasoning?: string
  /** Downscaled preview of the first attached image (data URL). */
  image?: string
  ts: number
}

export interface SessionRecord {
  id: string
  ts: number
  updatedAt: number
  type: 'capture' | 'chat'
  title: string
  mode?: string
  model?: string
  messages: SessionMessage[]
}

export interface SessionsService {
  /** Time a model call and append a call record; rethrows on failure. */
  track<T>(
    kind: CallKind,
    config: { provider: string; model: string; baseUrl: string },
    fn: () => Promise<T>,
    meta?: { inputChars?: number; images?: number },
  ): Promise<T>
  startSession(init: { type: SessionRecord['type']; title: string; mode?: string; model?: string }): SessionRecord
  /** Append the user turn; `image` (base64/dataURL) is stored as a thumbnail. */
  appendUserMessage(sessionId: string, content: string, image?: string): Promise<void>
  appendAssistantMessage(sessionId: string, content: string, reasoning?: string): void
  listSessions(): SessionRecord[]
  listCalls(): CallRecord[]
  deleteSession(id: string): void
  deleteCall(id: string): void
  clearSessions(): void
  clearCalls(): void
}

// Typed seams for the cordis context: `ctx.llm` / `ctx.capture` / `ctx.sessions`.
declare module '@cordisjs/core' {
  interface Context {
    llm: LlmService
    capture: CaptureService
    sessions: SessionsService
  }
}
