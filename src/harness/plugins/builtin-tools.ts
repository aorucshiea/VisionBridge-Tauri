/**
 * Builtin tools — deliberately minimal for a multimodal-first agent:
 *   capture_screen  grab the display under the cursor; the screenshot is
 *                   returned as an image attachment so a vision model looks
 *                   at it directly (no secondary OCR/VLM detour)
 *   query_records   summarise recent invocation/conversation records
 *
 * Pipeline-specific tools are contributed separately (see pipeline-tools).
 */
import type { Plugin } from '@cordisjs/core'
import type { ToolDef } from '../services'

let lastCapture: { image: string; ts: number } | null = null

/** Reuse a fresh screenshot within the TTL instead of re-grabbing. */
export async function freshCapture(force = false): Promise<string> {
  if (!force && lastCapture && Date.now() - lastCapture.ts < 15000) return lastCapture.image
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
        description: '捕获当前屏幕的完整截图。截图会作为图片直接返回给你（多模态），请直接观察图片内容回答问题。',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        execute: async () => {
          const image = await freshCapture(true)
          return { content: '已捕获当前屏幕截图，见下方图片。', images: [image] }
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
