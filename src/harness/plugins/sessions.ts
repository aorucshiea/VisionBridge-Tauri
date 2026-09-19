/**
 * Builtin `ctx.sessions` provider — the record store for invocation logs
 * (调用记录) and conversations (对话记录).
 *
 * Storage: one localStorage key per record (`vb.rec.call.<ts>.<rand>` /
 * `vb.rec.sess.<ts>.<rand>`). Appends never mutate existing keys, so the main
 * window (pipeline calls) and the result card (chat calls) can write
 * concurrently without read-modify-write races; listing scans by prefix and
 * trimming drops the oldest keys beyond the caps.
 */
import { Context, Service } from '@cordisjs/core'
import type {
  CallKind, CallRecord, SessionMessage, SessionRecord, SessionsService,
} from '../services'

const PREFIX_CALL = 'vb.rec.call.'
const PREFIX_SESS = 'vb.rec.sess.'
const MAX_CALLS = 500
const MAX_SESSIONS = 150
const MAX_MESSAGES = 40
const MAX_CONTENT_CHARS = 8000
const PREVIEW_CHARS = 240

const clip = (s: string | undefined, max: number): string =>
  !s ? '' : s.length > max ? s.slice(0, max) : s

function nextId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function scanKeys(prefix: string): Array<{ key: string; ts: number }> {
  const out: Array<{ key: string; ts: number }> = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(prefix)) continue
    const ts = parseInt(key.slice(prefix.length), 36)
    out.push({ key, ts: Number.isFinite(ts) ? ts : 0 })
  }
  return out.sort((a, b) => b.ts - a.ts)
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : null
  } catch {
    return null
  }
}

function write(prefix: string, rec: { ts: number }, json: string, cap: number): void {
  const key = `${prefix}${rec.ts.toString(36)}.${nextId()}`
  try {
    localStorage.setItem(key, json)
  } catch {
    // Quota pressure: drop the oldest half, then retry once.
    trim(prefix, Math.floor(cap / 2))
    try { localStorage.setItem(key, json) } catch { /* give up silently */ }
  }
  trim(prefix, cap)
}

function trim(prefix: string, cap: number): void {
  const keys = scanKeys(prefix)
  for (const { key } of keys.slice(cap)) {
    try { localStorage.removeItem(key) } catch { /* ignore */ }
  }
}

function listRecords<T extends { ts: number }>(prefix: string): T[] {
  return scanKeys(prefix)
    .map(({ key }) => read<T>(key))
    .filter((r): r is T => !!r)
    .sort((a, b) => b.ts - a.ts)
}

/** Downscale the first attached image into a small JPEG preview. */
async function thumbnail(image: string, maxW = 240): Promise<string | undefined> {
  try {
    const src = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('image load failed'))
      img.src = src
    })
    const scale = Math.min(1, maxW / (img.naturalWidth || maxW))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round((img.naturalWidth || maxW) * scale))
    canvas.height = Math.max(1, Math.round((img.naturalHeight || maxW * (img.naturalHeight / img.naturalWidth)) * scale))
    const g = canvas.getContext('2d')
    if (!g) return undefined
    g.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.55)
  } catch {
    return undefined
  }
}

export class Sessions extends Service implements SessionsService {
  static [Service.provide] = 'sessions'
  static [Service.immediate] = true

  constructor(ctx: Context) {
    super(ctx)
  }

  async track<T>(
    kind: CallKind,
    config: { provider: string; model: string; baseUrl: string },
    fn: () => Promise<T>,
    meta?: { inputChars?: number; images?: number },
  ): Promise<T> {
    const t0 = Date.now()
    try {
      const result = await fn()
      const outputChars =
        typeof (result as any)?.content === 'string' ? (result as any).content.length
        : typeof result === 'string' ? result.length
        : undefined
      const rec: CallRecord = {
        id: nextId(),
        ts: t0,
        kind,
        provider: config.provider || '',
        model: config.model || '',
        baseUrl: config.baseUrl || '',
        durationMs: Date.now() - t0,
        ok: true,
        inputChars: meta?.inputChars,
        images: meta?.images,
        outputChars,
        preview: clip(typeof (result as any)?.content === 'string' ? (result as any).content : undefined, PREVIEW_CHARS),
      }
      write(PREFIX_CALL, rec, JSON.stringify(rec), MAX_CALLS)
      return result
    } catch (error: any) {
      const rec: CallRecord = {
        id: nextId(),
        ts: t0,
        kind,
        provider: config.provider || '',
        model: config.model || '',
        baseUrl: config.baseUrl || '',
        durationMs: Date.now() - t0,
        ok: false,
        error: clip(error?.message || String(error), PREVIEW_CHARS),
        inputChars: meta?.inputChars,
        images: meta?.images,
      }
      write(PREFIX_CALL, rec, JSON.stringify(rec), MAX_CALLS)
      throw error
    }
  }

  startSession(init: { type: SessionRecord['type']; title: string; mode?: string; model?: string }): SessionRecord {
    const now = Date.now()
    const rec: SessionRecord = {
      id: nextId(),
      ts: now,
      updatedAt: now,
      type: init.type,
      title: clip(init.title, 80) || (init.type === 'capture' ? 'Capture' : 'Chat'),
      mode: init.mode,
      model: init.model,
      messages: [],
    }
    write(PREFIX_SESS, rec, JSON.stringify(rec), MAX_SESSIONS)
    return rec
  }

  async appendUserMessage(sessionId: string, content: string, image?: string): Promise<void> {
    this.appendMessage(sessionId, {
      role: 'user',
      content: clip(content, MAX_CONTENT_CHARS),
      image: image ? await thumbnail(image) : undefined,
      ts: Date.now(),
    })
  }

  appendAssistantMessage(sessionId: string, content: string, reasoning?: string): void {
    this.appendMessage(sessionId, {
      role: 'assistant',
      content: clip(content, MAX_CONTENT_CHARS),
      reasoning: clip(reasoning, MAX_CONTENT_CHARS) || undefined,
      ts: Date.now(),
    })
  }

  private appendMessage(sessionId: string, msg: SessionMessage): void {
    for (const { key } of scanKeys(PREFIX_SESS)) {
      const rec = read<SessionRecord>(key)
      if (!rec || rec.id !== sessionId) continue
      rec.messages.push(msg)
      if (rec.messages.length > MAX_MESSAGES) rec.messages.splice(0, rec.messages.length - MAX_MESSAGES)
      rec.updatedAt = Date.now()
      try { localStorage.setItem(key, JSON.stringify(rec)) } catch { /* ignore */ }
      return
    }
  }

  listSessions(): SessionRecord[] {
    return listRecords<SessionRecord>(PREFIX_SESS)
  }

  listCalls(): CallRecord[] {
    return listRecords<CallRecord>(PREFIX_CALL)
  }

  deleteSession(id: string): void {
    for (const { key } of scanKeys(PREFIX_SESS)) {
      const rec = read<SessionRecord>(key)
      if (rec?.id === id) { try { localStorage.removeItem(key) } catch { /* ignore */ } return }
    }
  }

  deleteCall(id: string): void {
    for (const { key } of scanKeys(PREFIX_CALL)) {
      const rec = read<CallRecord>(key)
      if (rec?.id === id) { try { localStorage.removeItem(key) } catch { /* ignore */ } return }
    }
  }

  clearSessions(): void {
    for (const { key } of scanKeys(PREFIX_SESS)) { try { localStorage.removeItem(key) } catch { /* ignore */ } }
  }

  clearCalls(): void {
    for (const { key } of scanKeys(PREFIX_CALL)) { try { localStorage.removeItem(key) } catch { /* ignore */ } }
  }
}
