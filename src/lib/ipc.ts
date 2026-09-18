/**
 * Tauri IPC shim.
 *
 * The whole UI was written against the Electron preload contract
 * (`window.ipcRenderer.*`). Rather than rewrite 20 components, this module
 * *re-creates that exact object* on top of Tauri:
 *
 *   native concerns (windows, tray, capture, shortcuts, settings, selection)
 *      → `invoke(...)` into Rust
 *   everything HTTP (model calls, OCR, model list, test connection,
 *   models.dev catalogue)
 *      → plain `fetch` straight from the WebView
 *
 * Keeping HTTP in the renderer is what makes the Rust side small — no reqwest,
 * no async runtime, no TLS stack — and that is precisely what this port is
 * meant to measure.
 *
 * Import for the side effect: `import './lib/ipc'`.
 */
import { invoke } from '@tauri-apps/api/core'
import { emit, listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  callAI, callAIStream, callASR, callImageGen, callOCR, callTTS, cancelActiveRequest, cleanUrl, extractErrorMessage, fetch, listModels,
  type AIServiceConfig, type AIRequestPayload,
} from './ai'
import { wireOf } from './providers'
import type { SavedConfiguration } from '../types'

// ---------------------------------------------------------------------------
// Which window is this?
//
// Rust injects `window.__VB_WINDOW__` via an initialisation script. That is
// deliberately more robust than reading it from the URL: a query string has to
// survive Tauri's asset-URL resolution, and if it does not the window silently
// behaves as the main window. The URL is still consulted as a fallback so the
// same bundle keeps working under the Electron harness and in a plain browser.
// ---------------------------------------------------------------------------
const windowType = (() => {
  if (typeof window === 'undefined') return 'main'
  const injected = (window as any).__VB_WINDOW__
  if (typeof injected === 'string' && injected) return injected
  const p = new URLSearchParams(window.location.search).get('window')
  if (p) return p
  const hash = window.location.hash
  if (hash.includes('mask')) return 'mask'
  if (hash.includes('result')) return 'result'
  if (hash.includes('toolbar')) return 'selection-toolbar'
  return 'main'
})()

// Handshake for the harness: if the window title still says "VB-BUNDLE-MISSING"
// after load, the bundle never executed.
if (typeof window !== 'undefined') {
  ;(window as any).__VB_BUNDLE_LOADED__ = true
  try {
    document.title = `VB:${windowType}`
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Diagnostic sink (mirrors `frontend_report` in Rust)
// ---------------------------------------------------------------------------
function report(message: string): void {
  try {
    void invoke('frontend_report', { text: `${windowType} ${message}` })
  } catch { /* diagnostics must never break the app */ }
}

// ---------------------------------------------------------------------------
// Event subscription helper (mirrors electron's `subscribe`)
//
// Failures are surfaced rather than swallowed: Tauri v2 rejects every plugin
// command unless a capability grants it, and a rejected `listen` looks exactly
// like "the feature does nothing".
// ---------------------------------------------------------------------------
function subscribe<T>(event: string, cb: (payload: T) => void): () => void {
  let unlisten: (() => void) | null = null
  let disposed = false
  void listen<T>(event, e => {
    if ((window as any).__VB_DIAG__) report(`event "${event}" arrived`)
    cb(e.payload)
  })
    .then(fn => {
      if (disposed) fn()
      else unlisten = fn
    })
    .catch(err => report(`event listen failed for "${event}": ${err?.message || err}`))
  return () => {
    disposed = true
    unlisten?.()
  }
}

// ---------------------------------------------------------------------------
// models.dev capability catalogue (24h in localStorage — the WebView's own
// persistent store, so no Rust-side file cache is needed)
// ---------------------------------------------------------------------------
export interface CatalogEntry {
  id: string
  name: string
  vision: boolean
  reasoning: boolean
  tools: boolean
  context: number | null
}

const CATALOG_CACHE_KEY = 'vb.modelCatalog.v1'
const CATALOG_TTL = 24 * 60 * 60 * 1000

async function fetchCatalog(): Promise<Record<string, any> | null> {
  try {
    const cached = localStorage.getItem(CATALOG_CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Date.now() - parsed.at < CATALOG_TTL) return parsed.data
    }
  } catch { /* corrupted cache — refetch */ }

  try {
    const res = await fetch('https://models.dev/api.json')
    const data = await res.json()
    try {
      localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ at: Date.now(), data }))
    } catch { /* quota exceeded — best effort */ }
    return data
  } catch {
    return null
  }
}

async function loadModelCatalog(mdIds: string[]): Promise<CatalogEntry[]> {
  const data = await fetchCatalog()
  if (!data) return []
  const seen = new Set<string>()
  const entries: CatalogEntry[] = []
  for (const id of mdIds.filter(Boolean)) {
    const vendor = data[id]
    if (!vendor?.models) continue
    for (const m of Object.values(vendor.models) as any[]) {
      if (!m?.id || seen.has(m.id)) continue
      seen.add(m.id)
      entries.push({
        id: m.id,
        name: m.name || m.id,
        vision: m.attachment === true || (Array.isArray(m.modalities?.input) && m.modalities.input.includes('image')),
        reasoning: !!m.reasoning,
        tools: !!m.tool_call,
        context: m.limit?.context ?? null,
      })
    }
  }
  return entries
}

// ---------------------------------------------------------------------------
// Settings cache — read often (chat routing, text runner), so keep it warm.
// ---------------------------------------------------------------------------
let settingsCache: any = null

async function getSettings(): Promise<any> {
  settingsCache = await invoke('get_settings')
  return settingsCache
}

async function saveSettings(settings: any): Promise<{ success: boolean; error?: string }> {
  try {
    settingsCache = settings
    await invoke('save_settings', { settings })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) }
  }
}

// ---------------------------------------------------------------------------
// Text runner — the text-only side of the active pipeline.
// Port of `resolveTextRunner` from electron/main.ts so Alt+T, the selection
// toolbar and text mode all resolve to the same model.
// ---------------------------------------------------------------------------
function resolveTextRunner(settings: any): {
  config: AIServiceConfig
  promptFor: (task: string, text: string) => string
} {
  if (settings?.mode === 'CUSTOM') {
    const pipeline = (settings.pipelines || []).find((p: any) => p.id === settings.activePipelineId)
    const node = (pipeline?.nodes || []).find((n: any) => n.enabled && n.api === 'chat')
    if (node) {
      return {
        config: { provider: node.provider, apiKey: node.apiKey, baseUrl: node.baseUrl, model: node.model },
        promptFor: (task, text) => {
          const template = task === 'explain' && node.promptExplain?.trim() ? node.promptExplain : node.prompt
          const base = template?.trim() ? template : (task === 'explain' ? settings.llmExplainPrompt : settings.llmTranslatePrompt)
          return base.includes('{input}') ? base.replace('{input}', text) : `${base}\n\n${text}`
        },
      }
    }
  }
  if (settings?.mode === 'VLM+LLM') {
    return {
      config: { provider: settings.llm2Provider, apiKey: settings.llm2ApiKey, baseUrl: settings.llm2BaseUrl, model: settings.llm2Model },
      promptFor: (task, text) => (task === 'explain' ? settings.llm2ExplainPrompt : settings.llm2TranslatePrompt).replace('{json_data}', text),
    }
  }
  return {
    config: { provider: settings.llmProvider, apiKey: settings.llmApiKey, baseUrl: settings.llmBaseUrl, model: settings.llmModel },
    promptFor: (task, text) => `${task === 'explain' ? settings.llmExplainPrompt : settings.llmTranslatePrompt}\n\n${text}`,
  }
}

// ---------------------------------------------------------------------------
// chat-with-ai routing — mirrors the Electron main-process handler.
// ---------------------------------------------------------------------------
async function chatWithAI(
  messages: Array<{ role: string; content: string }>,
  settings: any,
  images?: string[],
): Promise<string> {
  const config: AIServiceConfig = settings?.mode === 'TEXT'
    ? resolveTextRunner(settings).config
    : settings?.mode === 'VLM'
      ? { provider: settings.vlmProvider, apiKey: settings.vlmApiKey, baseUrl: settings.vlmBaseUrl, model: settings.vlmModel }
      : resolveTextRunner(settings).config

  return callAI(config, {
    prompt: messages[messages.length - 1].content,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    images: images && images.length ? images : undefined,
  })
}

/** Streaming twin of chatWithAI — same routing, deltas via `onDelta`. */
async function chatWithAIStream(
  messages: Array<{ role: string; content: string }>,
  settings: any,
  onDelta?: (d: { content?: string; reasoning?: string }) => void,
  images?: string[],
): Promise<{ content: string; reasoning: string }> {
  const config: AIServiceConfig = settings?.mode === 'TEXT'
    ? resolveTextRunner(settings).config
    : settings?.mode === 'VLM'
      ? { provider: settings.vlmProvider, apiKey: settings.vlmApiKey, baseUrl: settings.vlmBaseUrl, model: settings.vlmModel }
      : resolveTextRunner(settings).config

  return callAIStream(config, {
    prompt: messages[messages.length - 1].content,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    images: images && images.length ? images : undefined,
  }, onDelta)
}

// ---------------------------------------------------------------------------
// Test connection — port of the Electron `test-connection` handler.
// ---------------------------------------------------------------------------
const TEST_I18N: Record<string, Record<string, (a?: string, b?: string) => string>> = {
  zh: {
    connected: () => '连接成功',
    modelAvailable: () => '模型可用',
    modelNotFound: (model, list) => `模型 ${model} 未找到，可用模型: ${list}`,
    unsupported: (provider) => `不支持的 provider: ${provider}`,
    failed: (msg) => `连接失败: ${msg}`,
    modelLoadTimeout: (model) => `服务器已连通，但模型 ${model} 加载超时（大模型冷加载可能需要 1-3 分钟）。请先在 LM Studio 中手动加载模型，或稍后重试`,
  },
  en: {
    connected: () => 'Connection successful',
    modelAvailable: () => 'Model available',
    modelNotFound: (model, list) => `Model ${model} not found. Available models: ${list}`,
    unsupported: (provider) => `Unsupported provider: ${provider}`,
    failed: (msg) => `Connection failed: ${msg}`,
    modelLoadTimeout: (model) => `Server reachable, but model ${model} timed out while loading (cold start can take minutes). Load the model manually in LM Studio first, then retry`,
  },
}

async function testConnection(config: any): Promise<{ success: boolean; available: boolean; message: string }> {
  const { apiKey, model } = config
  const provider: string = config.provider
  const wire = wireOf(provider)
  const lang = settingsCache?.language || 'zh'
  const i18n = TEST_I18N[lang] || TEST_I18N.zh
  const base = cleanUrl(config.baseUrl)

  try {
    if (wire === 'ollama') {
      const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(5000) })
      const data = await res.json()
      const models: Array<{ name: string }> = data?.models || []
      const exists = models.some(m => m.name === model || m.name.startsWith(model))
      return {
        success: true,
        available: exists,
        message: exists ? i18n.modelAvailable() : i18n.modelNotFound(model, models.map(m => m.name).join(', ')),
      }
    }

    const headers: Record<string, string> = wire === 'anthropic'
      ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }
      : { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    const body = wire === 'anthropic'
      ? { model, max_tokens: 1, messages: [{ role: 'user', content: 'OK' }] }
      : { model, messages: [{ role: 'user', content: 'OK' }], max_tokens: 1, stream: false }
    const url = wire === 'anthropic' ? `${base}/v1/messages` : `${base}/v1/chat/completions`

    // Two-stage test (LM Studio JIT loading friendly):
    //  1. GET /v1/models — never triggers a model load, proves the server is reachable
    //  2. POST /v1/chat/completions — real generation test; may trigger a cold model
    //     load (a 35B Q4 can take minutes), hence the generous timeout.
    if (wire !== 'anthropic') {
      try {
        const list = await fetch(`${base}/v1/models`, {
          headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(8000),
        })
        if (list.ok) {
          const data = await list.json()
          const ids: string[] = (data?.data || [])
            .map((m: any) => String(m.id || m.name || ''))
            .filter(Boolean)
          if (ids.length > 0 && model && !ids.some((id) => id === model || model.startsWith(id) || id.startsWith(model))) {
            return { success: true, available: false, message: i18n.modelNotFound(model, ids.join(', ')) }
          }
        }
        // 非 2xx：服务器可达但 models 接口异常 → 继续走补全测试
      } catch (e: any) {
        return { success: false, available: false, message: i18n.failed(extractErrorMessage(e)) }
      }
    }

    try {
      const res = await fetch(url, {
        method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(180000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return { success: true, available: true, message: i18n.connected() }
    } catch (e: any) {
      if (e?.name === 'TimeoutError') {
        // Client gave up while the server was (most likely) still cold-loading the model.
        return { success: false, available: true, message: i18n.modelLoadTimeout(model) }
      }
      throw e
    }
  } catch (e: any) {
    return { success: false, available: false, message: i18n.failed(extractErrorMessage(e)) }
  }
}

// ---------------------------------------------------------------------------
// Text-selection actions (Alt+T and the floating toolbar).
//
// The *native* half (clipboard round-trip, Ctrl+C simulation, cursor position)
// lives in Rust. The *model* half runs here in the main window, which is the
// only renderer guaranteed to stay alive — the toolbar window is hidden the
// moment an action starts and its timers would be throttled.
// ---------------------------------------------------------------------------
let lastSelection: { text: string; x: number; y: number } = { text: '', x: 0, y: 0 }

/** Run one toolbar action against the last captured selection. */
async function runSelectionAction(payload: { action: string; text: string; x: number; y: number; hint?: string }): Promise<void> {
  const { action, text, x, y, hint } = payload
  if (hint) {
    await invoke('show_result', { x: x + 12, y: y + 12, content: hint })
    return
  }
  if (!text) return

  const settings = settingsCache || (await getSettings())
  const working = settings?.language === 'en' ? 'Translating...' : '翻译中...'
  try {
    await invoke('show_result', { x: x + 12, y: y + 12, content: working, processing: true })

    let prompt: string
    if (action === 'explain') {
      prompt = `${settings.llmExplainPrompt}\n\n${text}`
    } else {
      const custom = action !== 'translate'
        ? (settings.toolbarActions || []).find((a: any) => a.id === action)
        : null
      const template = custom?.prompt?.trim() ? String(custom.prompt) : settings.llmTranslatePrompt
      prompt = template.includes('{input}') ? template.replace('{input}', text) : `${template}\n\n${text}`
    }

    const result = await callAI(resolveTextRunner(settings).config, { prompt })
    await invoke('show_result', { x: x + 12, y: y + 12, content: result })
  } catch (error: any) {
    await invoke('show_result', { x: x + 12, y: y + 12, content: `Error: ${error?.message || error}` }).catch(() => {})
  }
}

if (typeof window !== 'undefined' && windowType === 'main') {
  // Cache every selection the native side pushes, so toolbar actions have the
  // text even though the toolbar window owns the visible buttons.
  void listen<{ text: string }>('selection-text', e => {
    lastSelection = { text: e.payload?.text || '', x: lastSelection.x, y: lastSelection.y }
  }).then(fn => { /* keep alive for the window's lifetime */ void fn })
  void listen<any>('selection-position', e => {
    lastSelection = { text: lastSelection.text, x: e.payload?.x ?? 0, y: e.payload?.y ?? 0 }
  })
  void listen<any>('selection-action', e => { void runSelectionAction(e.payload) })
}

// ---------------------------------------------------------------------------
// The API object — same shape as electron/preload.ts
// ---------------------------------------------------------------------------
const api = {
  // ---- events ------------------------------------------------------------
  onProcessScreenshot: (cb: (data: { region: any; action: string }) => void) =>
    subscribe('process-screenshot', cb),
  onCancelRequests: (cb: () => void) => subscribe('cancel-requests', () => cb()),
  onDisplayContent: (cb: (content: string) => void) => subscribe('display-content', cb),
  /** Result card enters the "working" animation state (no content yet). */
  onDisplayProcessing: (cb: () => void) => subscribe('display-processing', () => cb()),
  onDisplayDelta: (cb: (delta: { content?: string; reasoning?: string }) => void) =>
    subscribe('display-delta', cb),
  onSelectionText: (cb: (payload: { text: string; actions: Array<{ id: string; label: string }> }) => void) =>
    subscribe('selection-text', cb),
  onAppendScreenshot: (cb: (data: any) => void) => subscribe('append-screenshot', cb),

  selectionToolbarAction: (action: string) => invoke('selection_toolbar_action', { action }),

  /** Diagnostics: no-op unless the app was started with `VB_DIAG=1`. */
  diag: (message: string) => {
    if ((window as any).__VB_DIAG__) report(message)
  },

  // ---- settings ----------------------------------------------------------
  getSettings,
  saveSettings,

  // ---- screenshot / windows ---------------------------------------------
  captureScreen: () => invoke<string>('capture_screen'),
  sendProcessScreenshot: (data: { region: any; action: string }) => {
    void invoke('process_screenshot', { region: data.region, action: data.action })
  },
  showResult: (data: { x: number; y: number; content: string; processing?: boolean }) =>
    invoke('show_result', { x: data.x, y: data.y, content: data.content, processing: data.processing === true }),
  hideResult: () => invoke('hide_result'),
  /** Forward pipeline deltas (main window) to the result card. */
  streamResultDelta: (delta: { content?: string; reasoning?: string }) => {
    void emit('display-delta', delta)
  },
  /** Report the result card's natural content height so Rust can resize its window. */
  resizeResult: (height: number) => invoke('resize_result', { height }),
  openMask: (target?: 'main' | 'result') => invoke('open_mask', { target: target ?? 'main' }),
  hideMask: () => invoke('hide_mask'),
  closeMask: () => invoke('close_mask'),

  // ---- AI (renderer-side HTTP) ------------------------------------------
  callAI: (config: AIServiceConfig, payload: AIRequestPayload) => callAI(config, payload),
  callAIStream: (
    config: AIServiceConfig,
    payload: AIRequestPayload,
    onDelta?: (d: { content?: string; reasoning?: string }) => void,
  ) => callAIStream(config, payload, onDelta),
  callOCR: (config: AIServiceConfig, imageBase64: string) => callOCR(config, imageBase64),
  callImageGen: (config: AIServiceConfig, prompt: string) => callImageGen(config, prompt),
  callTTS: (config: AIServiceConfig & { voice?: string }, text: string) => callTTS(config, text),
  callASR: (config: AIServiceConfig, audioBase64: string) => callASR(config, audioBase64),
  cancelAiRequests: async () => { cancelActiveRequest() },
  chatWithAI: async (messages: Array<{ role: string; content: string }>, images?: string[]) => {
    const settings = settingsCache || (await getSettings())
    return chatWithAI(messages, settings, images)
  },
  chatWithAIStream: async (
    messages: Array<{ role: string; content: string }>,
    onDelta?: (d: { content?: string; reasoning?: string }) => void,
    images?: string[],
  ) => {
    const settings = settingsCache || (await getSettings())
    return chatWithAIStream(messages, settings, onDelta, images)
  },
  testConnection: (config: any, _type: 'vlm' | 'ocr' | 'llm' | 'vlm2' | 'llm2') => testConnection(config),
  listModels: (config: { provider: string; apiKey: string; baseUrl: string; model?: string }) =>
    listModels(config as AIServiceConfig),
  modelCatalog: (payload: { mdIds: string[] }) => loadModelCatalog(payload.mdIds || []),

  // ---- chat history ------------------------------------------------------
  saveChatHistory: (data: { messages: Array<{ role: string; content: string }>; originalContent: string }) =>
    saveChatHistory(data),
  getChatHistory: () => invoke<unknown[]>('get_chat_history'),
  deleteChatHistory: (id: number) => invoke<{ success: boolean }>('delete_chat_history', { id }),

  // ---- saved configurations ---------------------------------------------
  saveConfiguration: (data: any) =>
    invoke<{ success: boolean; id?: string }>('save_configuration', { data }),
  getSavedConfigurations: () => invoke<SavedConfiguration[]>('get_saved_configurations'),
  deleteConfiguration: (id: string) =>
    invoke<{ success: boolean }>('delete_configuration', { id }),

  // ---- window controls ---------------------------------------------------
  minimizeWindow: () => getCurrentWindow().minimize(),
  maximizeWindow: () => getCurrentWindow().toggleMaximize(),
  closeWindow: () => invoke('window_control', { action: 'close' }),
}

export type IpcApi = typeof api

/**
 * Chat history entry: the AI-generated title is produced here (the renderer
 * already speaks HTTP) and Rust only appends the finished record to disk.
 */
async function saveChatHistory(data: { messages: Array<{ role: string; content: string }>; originalContent: string }) {
  try {
    const settings = settingsCache || (await getSettings())
    let title = `对话 ${new Date().toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    try {
      const titlePrompt = `请为以下对话生成一个简短的标题（不超过15个字），概括对话的主题：\n\n对话内容：\n${data.messages.map(m => `${m.role}: ${m.content}`).join('\n\n')}\n\n只输出标题，不要其他内容。`
      const generated = await callAI(resolveTextRunner(settings).config, { prompt: titlePrompt })
      if (generated?.trim()) title = generated.trim().replace(/^["'“”]|["'“”]$/g, '').slice(0, 30)
    } catch { /* keep the timestamp title */ }

    await invoke('save_chat_history', {
      entry: {
        id: Date.now(),
        title,
        createdAt: new Date().toISOString(),
        messages: data.messages,
        originalContent: data.originalContent,
      },
    })
  } catch { /* history is best-effort */ }
}

// Install eagerly so every component can keep using `window.ipcRenderer`.
if (typeof window !== 'undefined') {
  ;(window as any).ipcRenderer = api
}
