/**
 * Incremental parser for streaming chat responses.
 *
 * Handles both wire shapes that VisionBridge speaks:
 *  - OpenAI-compatible SSE: `data: {json}` lines terminated by `data: [DONE]`.
 *    Reasoning models (DeepSeek-R1, Qwen3, LM Studio, OpenRouter) stream the
 *    thinking part in `delta.reasoning_content` (OpenRouter: `delta.reasoning`).
 *  - Ollama NDJSON: one JSON object per line, thinking in `message.thinking`.
 *
 * Pure string logic — no DOM, no Node APIs — so the same module runs in the
 * Electron main process and inside the Tauri WebView.
 */
export interface StreamDelta {
  content?: string
  reasoning?: string
}

export interface ChatStreamParser {
  /** Feed a raw network chunk; returns the deltas completed by it. */
  feed: (chunk: string) => StreamDelta[]
  /** Call once the stream ends; parses any trailing un-newlined data. */
  flush: () => StreamDelta[]
}

function deltaFromObject(obj: any): StreamDelta | null {
  // OpenAI-compatible chat chunk
  const delta = obj?.choices?.[0]?.delta
  if (delta) {
    const content = typeof delta.content === 'string' ? delta.content : ''
    const reasoning =
      typeof delta.reasoning_content === 'string' ? delta.reasoning_content
      : typeof delta.reasoning === 'string' ? delta.reasoning
      : ''
    if (content || reasoning) return reasoning ? { content, reasoning } : { content }
    return null // role-only bookkeeping chunk
  }
  // Some servers stream the final message without deltas (non-SSE JSON body)
  const message = obj?.choices?.[0]?.message
  if (message && typeof message === 'object') {
    const content = typeof message.content === 'string' ? message.content : ''
    const reasoning =
      typeof message.reasoning_content === 'string' ? message.reasoning_content
      : typeof message.reasoning === 'string' ? message.reasoning
      : ''
    if (content || reasoning) return reasoning ? { content, reasoning } : { content }
  }
  // Ollama NDJSON: {"message":{"content":"…","thinking":"…"},"done":false}
  const ollama = obj?.message
  if (ollama && typeof ollama === 'object') {
    const content = typeof ollama.content === 'string' ? ollama.content : ''
    const thinking = typeof ollama.thinking === 'string' ? ollama.thinking : ''
    if (content || thinking) return thinking ? { content, reasoning: thinking } : { content }
  }
  return null
}

function parseLine(line: string): StreamDelta | null {
  let payload = line.trim()
  if (payload.startsWith('data:')) payload = payload.slice(5).trim()
  if (!payload || payload === '[DONE]') return null
  let obj: any
  try {
    obj = JSON.parse(payload)
  } catch {
    return null // keepalives, comments, partial junk — ignore
  }
  return deltaFromObject(obj)
}

export function createChatStreamParser(): ChatStreamParser {
  let buffer = ''
  return {
    feed(chunk: string): StreamDelta[] {
      buffer += chunk
      const out: StreamDelta[] = []
      let idx: number
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 1)
        const d = parseLine(line)
        if (d) out.push(d)
      }
      return out
    },
    flush(): StreamDelta[] {
      const rest = buffer
      buffer = ''
      const d = parseLine(rest)
      return d ? [d] : []
    },
  }
}
