/**
 * Builtin screen tools — the agent's first capability set:
 *   capture_screen     grab the display under the cursor (Rust GDI)
 *   ocr_screen         capture + OCR the screen text
 *   ask_about_screen   capture (or reuse) + ask the vision model a question
 *   query_records      summarise recent invocation/conversation records
 *
 * All model access goes through ctx.llm so every call is logged; the tools
 * are plain ctx.tools registrations (reversible via ctx.collect).
 */
import type { Plugin } from '@cordisjs/core'
import type { ToolDef } from '../services'

let lastCapture: { image: string; ts: number } | null = null
const CAPTURE_TTL_MS = 15000

async function getSettings(): Promise<any> {
  return await (window.ipcRenderer as any).getSettings()
}

/** Primary vision model config from the current settings. */
function visionConfig(s: any) {
  return { provider: s?.vlmProvider || 'ollama', apiKey: s?.vlmApiKey || '', baseUrl: s?.vlmBaseUrl || '', model: s?.vlmModel || '' }
}

async function freshCapture(force = false): Promise<string> {
  if (!force && lastCapture && Date.now() - lastCapture.ts < CAPTURE_TTL_MS) return lastCapture.image
  const image = await (window.ipcRenderer as any).captureScreen()
  lastCapture = { image, ts: Date.now() }
  return image
}

export const BuiltinTools: Plugin.Object = {
  name: 'builtin-tools',
  inject: ['tools', 'llm', 'sessions'],
  apply(ctx) {
    const defs: ToolDef[] = [
      {
        name: 'capture_screen',
        description: '捕获当前屏幕的完整截图。之后可用 ask_about_screen 针对屏幕内容提问，或用 ocr_screen 读取屏幕文字。',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        execute: async () => {
          const image = await freshCapture(true)
          return { content: `已捕获全屏截图（base64 长度 ${image.length}）。可用 ask_about_screen 分析内容，或用 ocr_screen 提取文字。` }
        },
      },
      {
        name: 'ocr_screen',
        description: '截取当前屏幕并识别其中的所有文字，返回纯文本。适合读取屏幕上的文字内容。',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        execute: async () => {
          const image = await freshCapture(true)
          const s = await getSettings()
          const cfg = {
            provider: s?.ocrProvider === 'local' ? 'ollama' : (s?.ocrProvider || s?.vlmProvider || 'ollama'),
            apiKey: s?.ocrApiKey || s?.vlmApiKey || '',
            baseUrl: s?.ocrBaseUrl || s?.vlmBaseUrl || '',
            model: s?.ocrModel || s?.vlmModel || '',
          }
          const text = await ctx.llm.ocr(cfg, image)
          return { content: text || '（未识别到文字）' }
        },
      },
      {
        name: 'ask_about_screen',
        description: '针对当前屏幕内容向视觉模型提问并返回回答。参数 question 为想问的问题，例如「屏幕上红色按钮的文字是什么」。',
        parameters: {
          type: 'object',
          properties: { question: { type: 'string', description: '关于屏幕内容的问题' } },
          required: ['question'],
          additionalProperties: false,
        },
        execute: async (args) => {
          const question = String(args.question || '').trim()
          if (!question) return { content: JSON.stringify({ error: 'INVALID_ARGS', message: 'question 不能为空' }) }
          const image = await freshCapture()
          const cfg = visionConfig(await getSettings())
          const r = await ctx.llm.chat(cfg, { prompt: question, images: [image] })
          return { content: r.content }
        },
      },
      {
        name: 'query_records',
        description: '查询最近的记录。kind=calls 返回最近的模型调用（含耗时与成败），kind=sessions 返回最近的对话/截图任务。',
        parameters: {
          type: 'object',
          properties: { kind: { type: 'string', enum: ['calls', 'sessions'], description: '要查询的记录类型' } },
          required: ['kind'],
          additionalProperties: false,
        },
        execute: async (args) => {
          const kind = args.kind === 'sessions' ? 'sessions' : 'calls'
          if (kind === 'calls') {
            const list = ctx.sessions.listCalls().slice(0, 5)
            return { content: list.map(c => `${new Date(c.ts).toLocaleTimeString()} ${c.kind} ${c.provider}/${c.model || '—'} ${c.ok ? 'OK' : `失败: ${c.error || ''}`} ${c.durationMs}ms`).join('\n') || '（无调用记录）' }
          }
          const list = ctx.sessions.listSessions().slice(0, 5)
          return { content: list.map(x => `${new Date(x.updatedAt).toLocaleTimeString()} [${x.type}] ${x.title}（${x.messages.length} 条消息）`).join('\n') || '（无对话记录）' }
        },
      },
    ]
    const disposers = defs.map(def => ctx.tools.register(def))
    ctx.collect('builtin-tools', () => disposers.forEach(d => d()))
  },
}
