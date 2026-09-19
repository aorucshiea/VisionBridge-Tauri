/**
 * Renderer-side AI client — the Tauri port of `electron/ai.ts`.
 *
 * In Electron every model call had to bounce through the main process because
 * the renderer could not open sockets. In Tauri the renderer *is* a normal
 * WebView, so `fetch` reaches the vendor directly. That removes an entire IPC
 * hop and, more importantly for the size story, keeps `reqwest` + `rustls` out
 * of the Rust binary.
 *
 * Semantics are kept identical to the Electron implementation:
 *  - the same three wire formats (openai / anthropic / ollama)
 *  - one retry on transient network failures
 *  - a single in-flight request, abortable via `cancelActiveRequest()`
 *  - gateway errors wrapped in HTTP 200 bodies are surfaced verbatim
 */
import { wireOf } from './providers'
import { createChatStreamParser } from './sse'
// The plugin's fetch tunnels through IPC into Rust: no origin, therefore no
// CORS preflight. Required because WebView2 blocks every renderer fetch to
// local servers (LM Studio, llama.cpp) whose OPTIONS response lacks CORS
// headers. See the Rust-side plugin registration.
import { fetch } from '@tauri-apps/plugin-http'

export { fetch }

export interface AIRequestPayload {
  prompt: string
  images?: string[] // base64 (no data: prefix)
  messages?: Array<{ role: string; content: any }>
}

export interface AIServiceConfig {
  provider: string
  apiKey: string
  baseUrl: string
  model: string
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------
let activeController: AbortController | null = null

function beginRequest(): AbortSignal {
  activeController?.abort()
  const controller = new AbortController()
  activeController = controller
  return controller.signal
}

function endRequest(signal: AbortSignal): void {
  if (activeController?.signal === signal) activeController = null
}

export function cancelActiveRequest(): void {
  activeController?.abort()
  activeController = null
}

function imageBase64(img: string): string {
  // Sources vary: canvas toDataURL gives a clean prefix-stripped payload here,
  // but the Rust GDI capture returns a full data URL. Normalise to bare base64.
  return img.replace(/^data:image\/\w+;base64,/, '').replace(/\s+/g, '')
}

function abortError(): Error {
  const err = new Error('Request aborted')
  err.name = 'AbortError'
  return err
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function cleanUrl(url: string): string {
  if (!url) return ''
  let cleaned = url.trim()
  cleaned = cleaned.replace(/\/+$/, '')
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned
  }
  // Windows resolves `localhost` to ::1 first; the vendors listen on IPv4.
  cleaned = cleaned.replace('://localhost', '://127.0.0.1')
  return cleaned
}

/** HTTP statuses worth one silent retry. */
const RETRIABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])

async function readBody(res: Response): Promise<any> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function extractErrorMessage(e: any): string {
  if (e?.name === 'AbortError') return 'Request aborted'
  return (
    e?.payload?.error?.message ||
    e?.payload?.message ||
    e?.payload?.msg ||
    (typeof e?.payload === 'string' ? e.payload : null) ||
    e?.message ||
    String(e)
  )
}

/**
 * Some gateways answer HTTP 200 with the real failure wrapped in the body
 * (`{"status":434,"msg":"Invalid apiKey…"}` is the observed iflow pattern).
 * When `choices` is missing, surface that message instead of a generic
 * "empty content" error that hides the actual cause.
 */
function unwrapGatewayError(body: any, model: string): Error {
  const wrapped =
    body?.msg ||
    body?.message ||
    body?.error?.message ||
    (typeof body?.error === 'string' ? body.error : null) ||
    (body?.status != null && body?.status !== 200 && typeof body?.status !== 'object'
      ? `网关返回状态 ${body.status}`
      : null)
  return new Error(wrapped ? String(wrapped) : `模型 ${model} 返回了空内容。`)
}

interface RawResponse {
  status: number
  data: any
  ok: boolean
}

/** POST JSON (or a FormData body) with one retry, honouring the cancel signal. */
async function post(
  url: string,
  body: any,
  opts: {
    headers?: Record<string, string>
    timeout?: number
    signal: AbortSignal
    binary?: boolean
  },
): Promise<Response> {
  const { headers = {}, timeout = 120000, signal, binary = false } = opts
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData

  const attempt = async (): Promise<Response> => {
    const timer = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), timeout)
    })
    const res = await Promise.race([
      fetch(url, {
        method: 'POST',
        headers: isForm ? headers : { 'Content-Type': 'application/json', ...headers },
        body: isForm ? body : JSON.stringify(body),
        signal,
      }),
      timer,
    ])
    if (!res.ok && RETRIABLE_STATUS.has(res.status)) {
      const clone = res.clone()
      void clone.text()
      throw Object.assign(new Error(`HTTP ${res.status}`), { retriableStatus: res.status })
    }
    return res
  }

  let res: Response
  try {
    res = await attempt()
  } catch (e: any) {
    if (signal.aborted) throw abortError()
    const transient = !e.retriableStatus
    if (transient && !e.code?.startsWith?.('ERR_') ) {
      // Network-level failure (DNS, reset, refused) — retry once.
    }
    await new Promise(r => window.setTimeout(r, 900))
    try {
      res = await attempt()
    } catch (e2: any) {
      if (signal.aborted) throw abortError()
      throw e2
    }
  }
  void binary
  return res
}

async function postJson(url: string, body: any, opts: { headers?: Record<string, string>; timeout?: number; signal: AbortSignal }): Promise<RawResponse> {
  const res = await post(url, body, opts)
  const data = await readBody(res)
  return { status: res.status, data, ok: res.ok }
}

// ---------------------------------------------------------------------------
// Chat / vision
// ---------------------------------------------------------------------------
export async function callAI(config: AIServiceConfig, payload: AIRequestPayload): Promise<string> {
  const { apiKey, baseUrl, model } = config
  const wire = wireOf(config.provider)
  const safeUrl = cleanUrl(baseUrl)
  const trimmedModel = model ? model.trim() : ''

  if (!trimmedModel) throw new Error('Model is required but not provided')

  const signal = beginRequest()
  try {
    if (wire === 'ollama') {
      const messages = payload.messages || [{ role: 'user', content: payload.prompt, images: payload.images?.map(imageBase64) }]
      const r = await postJson(`${safeUrl}/api/chat`, { model: trimmedModel, messages, stream: false }, { signal, timeout: 300000 })
      const content = r.data?.message?.content
      if (!content || String(content).trim() === '') throw unwrapGatewayError(r.data, trimmedModel)
      return String(content)
    }

    if (wire === 'openai' || wire === 'custom') {
      const messages: any[] = payload.messages || [{ role: 'user', content: payload.prompt }]
      if (payload.images && payload.images.length > 0 && !payload.messages) {
        messages[0].content = [
          { type: 'text', text: payload.prompt },
          ...payload.images.map(img => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64(img)}` } })),
        ]
      }
      const r = await postJson(`${safeUrl}/v1/chat/completions`, { model: trimmedModel, messages, stream: false }, {
        signal,
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      const result = r.data?.choices?.[0]?.message?.content
      if (!result || String(result).trim() === '') throw unwrapGatewayError(r.data, trimmedModel)
      return String(result)
    }

    if (wire === 'anthropic') {
      const content: any[] = []
      payload.images?.forEach(img => {
        content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } })
      })
      content.push({ type: 'text', text: payload.prompt })
      const r = await postJson(`${safeUrl}/v1/messages`, {
        model: trimmedModel,
        max_tokens: 2048,
        messages: [{ role: 'user', content }],
      }, {
        signal,
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      })
      return r.data?.content?.[0]?.text || '(No text content returned from Claude)'
    }

    throw new Error(`Unsupported AI Provider: ${config.provider}`)
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e
    if (e?.name === 'TimeoutError') {
      throw new Error('AI 请求超时。建议：1) 使用更小的模型 2) 启用GPU加速 3) 检查Ollama服务状态')
    }
    throw new Error(`${config.provider} AI Error: ${extractErrorMessage(e)}`)
  } finally {
    endRequest(signal)
  }
}

// ---------------------------------------------------------------------------
// Streaming chat (OpenAI SSE / Ollama NDJSON). Deltas go through `send` as
// they arrive; the resolved value carries the full {content, reasoning}.
// Falls back to one non-streaming request (still extracting reasoning_content)
// when the server refuses to stream. Anthropic keeps its non-streaming shape
// but surfaces thinking blocks.
// ---------------------------------------------------------------------------
export interface AIStreamResult {
  content: string
  reasoning: string
}

export type StreamSend = (delta: { content?: string; reasoning?: string }) => void

export async function callAIStream(
  config: AIServiceConfig,
  payload: AIRequestPayload,
  send?: StreamSend,
): Promise<AIStreamResult> {
  const { apiKey, baseUrl, model } = config
  const wire = wireOf(config.provider)
  const safeUrl = cleanUrl(baseUrl)
  const trimmedModel = model ? model.trim() : ''

  if (!trimmedModel) throw new Error('Model is required but not provided')

  if (wire === 'anthropic') {
    const content: any[] = []
    payload.images?.forEach(img => {
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } })
    })
    content.push({ type: 'text', text: payload.prompt })
    const signal = beginRequest()
    try {
      const res = await fetch(`${safeUrl}/v1/messages`, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: trimmedModel, max_tokens: 2048, messages: [{ role: 'user', content }] }),
        signal,
      })
      const data = await res.json().catch(() => null)
      const blocks: any[] = data?.content || []
      const text = blocks.filter(b => b?.type === 'text').map(b => String(b.text || '')).join('')
      const thinking = blocks.filter(b => b?.type === 'thinking').map(b => String(b.thinking || '')).join('')
      if (thinking) send?.({ reasoning: thinking })
      if (text) send?.({ content: text })
      return { content: text || '(No text content returned from Claude)', reasoning: thinking }
    } finally {
      endRequest(signal)
    }
  }

  const url = wire === 'ollama' ? `${safeUrl}/api/chat` : `${safeUrl}/v1/chat/completions`
  let messages: any[]
  if (payload.messages) {
    messages = payload.messages
  } else if (wire === 'ollama') {
    messages = [{ role: 'user', content: payload.prompt, images: payload.images?.map(imageBase64) }]
  } else if (payload.images && payload.images.length > 0) {
    messages = [{
      role: 'user',
      content: [
        { type: 'text', text: payload.prompt },
        ...payload.images.map(img => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64(img)}` } })),
      ],
    }]
  } else {
    messages = [{ role: 'user', content: payload.prompt }]
  }

  const body = { model: trimmedModel, messages, stream: true }
  const headers: Record<string, string> = wire === 'ollama'
    ? { 'Content-Type': 'application/json' }
    : { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }

  const signal = beginRequest()
  let gotDelta = false
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const parser = createChatStreamParser()
    let content = ''
    let reasoning = ''
    const emit = (d: { content?: string; reasoning?: string }) => {
      if (d.content) content += d.content
      if (d.reasoning) reasoning += d.reasoning
      gotDelta = true
      try { send?.(d) } catch { /* listener errors must not kill the stream */ }
    }

    const reader = (res.body as ReadableStream<Uint8Array> | null)?.getReader?.()
    if (reader) {
      const decoder = new TextDecoder()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        for (const d of parser.feed(decoder.decode(value, { stream: true }))) emit(d)
      }
      for (const d of parser.flush()) emit(d)
    } else {
      // Older plugin-http without a streaming body: parse the whole payload.
      const text = await res.text()
      for (const d of [...parser.feed(text), ...parser.flush()]) emit(d)
    }

    if (!content && !reasoning) throw new Error('流式响应为空')
    return { content, reasoning }
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e
    // Mid-stream failure: surface it instead of silently restarting.
    if (gotDelta) throw e
    // One non-streaming retry that still extracts the reasoning part.
    try {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ ...body, stream: false }), signal })
      const data = await res.json().catch(() => null)
      const msg = wire === 'ollama' ? data?.message : data?.choices?.[0]?.message
      const text = typeof msg?.content === 'string' ? msg.content : ''
      const reasoning =
        typeof msg?.reasoning_content === 'string' ? msg.reasoning_content
        : typeof msg?.reasoning === 'string' ? msg.reasoning
        : typeof msg?.thinking === 'string' ? msg.thinking
        : ''
      if (!text || text.trim() === '') throw unwrapGatewayError(data, trimmedModel)
      if (reasoning) send?.({ reasoning })
      send?.({ content: text })
      return { content: text, reasoning }
    } catch (fallbackError: any) {
      if (fallbackError?.name === 'AbortError') throw fallbackError
      throw new Error(`${config.provider} AI Error: ${extractErrorMessage(fallbackError) || e?.message}`)
    }
  } finally {
    endRequest(signal)
  }
}

// ---------------------------------------------------------------------------
// Chat with tools (function calling) — openai-compat and ollama wires.
// Non-streaming MVP: the agent UI shows tool activity instead of tokens.
// ---------------------------------------------------------------------------
export interface LlmChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  images?: string[]
  toolCalls?: Array<{ id: string; name: string; arguments: string }>
  toolCallId?: string
}

export interface ToolCallOut {
  id: string
  name: string
  arguments: string
}

export interface ChatToolsResult {
  content: string
  reasoning: string
  toolCalls: ToolCallOut[]
}

function toWireMessages(wire: string, messages: LlmChatMessage[]): any[] {
  return messages.map(m => {
    if (m.role === 'tool') return { role: 'tool', tool_call_id: m.toolCallId, content: m.content }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } })),
      }
    }
    if (m.role === 'user' && m.images?.length) {
      if (wire === 'ollama') return { role: 'user', content: m.content, images: m.images }
      return {
        role: 'user',
        content: [
          { type: 'text', text: m.content },
          ...m.images.map(img => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64(img)}` } })),
        ],
      }
    }
    return { role: m.role, content: m.content }
  })
}

export async function callChatTools(
  config: AIServiceConfig,
  payload: { messages: LlmChatMessage[]; tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }> },
): Promise<ChatToolsResult> {
  const { apiKey, baseUrl, model } = config
  const wire = wireOf(config.provider)
  const safeUrl = cleanUrl(baseUrl)
  const trimmedModel = model ? model.trim() : ''
  if (!trimmedModel) throw new Error('Model is required but not provided')
  if (wire === 'anthropic') throw new Error('Anthropic 工具调用暂未支持，请使用 OpenAI 兼容或 Ollama 端点。')

  // Always streaming: the streaming-with-images path is the one every vendor
  // setup already proves (the screenshot pipelines); some engines reject
  // non-streaming multimodal requests outright.
  const url = wire === 'ollama' ? `${safeUrl}/api/chat` : `${safeUrl}/v1/chat/completions`
  const body = wire === 'ollama'
    ? { model: trimmedModel, messages: toWireMessages('ollama', payload.messages), tools: payload.tools, stream: true }
    : {
        model: trimmedModel,
        messages: toWireMessages('openai', payload.messages),
        tools: payload.tools.map(t => ({ type: 'function', function: t })),
        stream: true,
      }
  const headers: Record<string, string> = wire === 'ollama'
    ? { 'Content-Type': 'application/json' }
    : { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }

  const signal = beginRequest()
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    let content = ''
    let reasoning = ''
    const toolAcc = new Map<number, ToolCallOut>()
    const handleDelta = (delta: any) => {
      if (typeof delta?.content === 'string') content += delta.content
      const rc = delta?.reasoning_content ?? delta?.reasoning
      if (typeof rc === 'string') reasoning += rc
      if (Array.isArray(delta?.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = typeof tc.index === 'number' ? tc.index : toolAcc.size
          const acc = toolAcc.get(idx) || { id: '', name: '', arguments: '' }
          if (tc.id) acc.id = String(tc.id)
          if (tc.function?.name) acc.name += String(tc.function.name)
          const rawArgs = tc.function?.arguments
          if (rawArgs != null) {
            if (typeof rawArgs === 'string') acc.arguments += rawArgs
            else { try { acc.arguments = JSON.stringify(rawArgs) } catch { /* ignore */ } }
          }
          toolAcc.set(idx, acc)
        }
      }
    }

    const reader = (res.body as ReadableStream<Uint8Array> | null)?.getReader?.()
    const decoder = new TextDecoder()
    const feed = (chunk: string) => {
      if (wire === 'ollama') {
        // NDJSON: one JSON object per line.
        for (const line of chunk.split('\n')) {
          const t = line.trim()
          if (!t) continue
          try { handleDelta(JSON.parse(t)?.message) } catch { /* partial line — ignored */ }
        }
        return
      }
      // SSE: `data: {...}` frames, terminated by data: [DONE].
      for (const line of chunk.split('\n')) {
        const t = line.trim()
        if (!t.startsWith('data:')) continue
        const dataStr = t.slice(5).trim()
        if (!dataStr || dataStr === '[DONE]') continue
        try {
          const json = JSON.parse(dataStr)
          handleDelta(json?.choices?.[0]?.delta)
        } catch { /* partial frame — ignored */ }
      }
    }

    if (reader) {
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        feed(lines.join('\n'))
      }
      feed(buf)
    } else {
      feed(await res.text())
    }

    const toolCalls = [...toolAcc.values()]
      .map((tc, i) => ({ id: tc.id || `call_${Date.now()}_${i}`, name: tc.name, arguments: tc.arguments || '{}' }))
      .filter(tc => tc.name)
    return { content, reasoning, toolCalls }
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e
    throw new Error(`${config.provider} AI Error: ${extractErrorMessage(e)}`)
  } finally {
    endRequest(signal)
  }
}

// ---------------------------------------------------------------------------
// OCR (vision model asked to transcribe)
// ---------------------------------------------------------------------------
const OCR_PROMPT_OLLAMA = "识别图片中的所有文字，只输出文字内容，不要添加任何解释或说明。如果图片中没有文字，输出'无'。"
const OCR_PROMPT_OPENAI = "识别图片中的所有文字，只输出文字内容。如果图片中没有文字，输出'无'。"

export async function callOCR(config: AIServiceConfig, imageBase64: string): Promise<string> {
  const { provider, apiKey, baseUrl, model } = config
  const rawWire: string = wireOf(provider)
  const wire = rawWire === 'local' ? 'ollama' : rawWire
  const safeUrl = cleanUrl(baseUrl)
  const trimmedModel = model ? model.trim() : ''

  if (!trimmedModel) throw new Error('Model is required but not provided')

  const signal = beginRequest()
  try {
    if (wire === 'ollama') {
      const r = await postJson(`${safeUrl}/api/chat`, {
        model: trimmedModel,
        messages: [{ role: 'user', content: OCR_PROMPT_OLLAMA, images: [imageBase64] }],
        stream: false,
      }, { signal, timeout: 300000 })
      const content = r.data?.message?.content
      if (!content || String(content).trim() === '' || String(content).trim() === '无') {
        throw new Error('OCR未能识别到文字。请确保图片中包含清晰的文字内容。')
      }
      return String(content)
    }

    if (wire === 'openai' || wire === 'custom') {
      const r = await postJson(`${safeUrl}/v1/chat/completions`, {
        model: trimmedModel,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: OCR_PROMPT_OPENAI },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        }],
        stream: false,
        max_tokens: 4096,
      }, { signal, headers: { Authorization: `Bearer ${apiKey}` } })
      const content = r.data?.choices?.[0]?.message?.content
      if (!content || String(content).trim() === '' || String(content).trim() === '无') {
        throw unwrapGatewayError(r.data, trimmedModel)
      }
      return String(content)
    }

    if (provider === 'baidu' || provider === 'google') {
      throw new Error(`OCR provider "${provider}" 尚未集成，请选择 Ollama 或自定义端点。`)
    }
    throw new Error(`Unsupported OCR provider: ${provider}`)
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e
    if (e?.message?.includes('OCR provider') || e?.message?.includes('尚未集成')) throw e
    throw new Error(`OCR Failed: ${extractErrorMessage(e)}`)
  } finally {
    endRequest(signal)
  }
}

// ---------------------------------------------------------------------------
// Media nodes — OpenAI-compatible only; Ollama has no equivalents.
// ---------------------------------------------------------------------------
const mediaUnsupported = (provider: string, kind: string): Error =>
  new Error(`节点类别 "${kind}" 需要 OpenAI 兼容端点（自定义/OpenAI 均可），${provider === 'ollama' ? 'Ollama 暂不支持' : `当前 provider "${provider}" 不支持`}`)

export async function callImageGen(config: AIServiceConfig, prompt: string): Promise<string> {
  const { apiKey, baseUrl, model, provider } = config
  if (wireOf(provider) === 'ollama') throw mediaUnsupported(provider, 'imagegen')
  const signal = beginRequest()
  try {
    const r = await postJson(`${cleanUrl(baseUrl)}/v1/images/generations`, {
      model: model.trim(), prompt, n: 1, size: '1024x1024', response_format: 'b64_json',
    }, { signal, headers: { Authorization: `Bearer ${apiKey}` }, timeout: 300000 })
    const item = r.data?.data?.[0]
    if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`
    if (item?.url) return String(item.url)
    throw new Error('图像生成接口未返回图片数据')
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e
    throw new Error(`ImageGen Failed: ${extractErrorMessage(e)}`)
  } finally {
    endRequest(signal)
  }
}

export async function callTTS(config: AIServiceConfig & { voice?: string }, text: string): Promise<string> {
  const { apiKey, baseUrl, model, voice, provider } = config
  if (wireOf(provider) === 'ollama') throw mediaUnsupported(provider, 'tts')
  const signal = beginRequest()
  try {
    const res = await post(`${cleanUrl(baseUrl)}/v1/audio/speech`, {
      model: model.trim(), input: text, voice: voice || 'alloy', response_format: 'mp3',
    }, { signal, headers: { Authorization: `Bearer ${apiKey}` }, timeout: 300000, binary: true })
    const buf = await res.arrayBuffer()
    if (buf.byteLength === 0) throw new Error('语音合成接口返回了空音频')
    let binary = ''
    const bytes = new Uint8Array(buf)
    const CHUNK = 0x8000
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
    }
    return btoa(binary)
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e
    throw new Error(`TTS Failed: ${extractErrorMessage(e)}`)
  } finally {
    endRequest(signal)
  }
}

export async function callASR(config: AIServiceConfig, audioBase64: string): Promise<string> {
  const { apiKey, baseUrl, model, provider } = config
  if (wireOf(provider) === 'ollama') throw mediaUnsupported(provider, 'asr')
  const signal = beginRequest()
  try {
    const raw = atob(audioBase64)
    const bytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: 'audio/mpeg' }), 'speech.mp3')
    form.append('model', model.trim())
    const res = await post(`${cleanUrl(baseUrl)}/v1/audio/transcriptions`, form, {
      signal, headers: { Authorization: `Bearer ${apiKey}` }, timeout: 300000,
    })
    const data = await readBody(res)
    const text = data?.text
    if (!text || String(text).trim() === '') throw new Error('语音识别接口未返回文本')
    return String(text)
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e
    throw new Error(`ASR Failed: ${extractErrorMessage(e)}`)
  } finally {
    endRequest(signal)
  }
}

// ---------------------------------------------------------------------------
// Model list (获取模型列表 — the vendor's live catalogue)
// ---------------------------------------------------------------------------
export async function listModels(config: AIServiceConfig): Promise<string[]> {
  const { provider, apiKey, baseUrl } = config
  const wire = wireOf(provider)
  try {
    const base = cleanUrl(baseUrl)
    if (wire === 'ollama') {
      const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(10000) })
      const data = await readBody(res)
      return ((data?.models || []) as Array<{ name: string }>).map(m => m.name)
    }
    const headers: Record<string, string> = wire === 'anthropic'
      ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
      : { Authorization: `Bearer ${apiKey}` }
    const res = await fetch(`${base}/v1/models`, { headers, signal: AbortSignal.timeout(15000) })
    const data = await readBody(res)
    if (!res.ok) throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}`)
    const list = data?.data || data?.models || []
    return (list as Array<{ id?: string; name?: string }>)
      .map(m => String(m.id || m.name || ''))
      .filter(id => id !== '')
      .sort()
  } catch (e: any) {
    throw new Error(`获取模型列表失败: ${extractErrorMessage(e)}`)
  }
}
