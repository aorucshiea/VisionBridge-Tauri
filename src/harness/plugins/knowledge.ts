/**
 * Builtin `ctx.knowledge` provider — stage 1: long-term memory facts.
 *
 * Storage follows the records pattern: one localStorage key per fact
 * (`vb.mem.<ts>.<rand>`), appends never rewrite existing keys, cap trims the
 * oldest. Linked notes + the graph view build on the same pattern next stage.
 */
import type { Plugin } from '@cordisjs/core'
import type { KnowledgeService, MemoryFact, ToolDef } from '../services'

const PREFIX = 'vb.mem.'
const MAX_FACTS = 200

function scanKeys(): Array<{ key: string; ts: number }> {
  const out: Array<{ key: string; ts: number }> = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(PREFIX)) continue
    const ts = parseInt(key.slice(PREFIX.length), 36)
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

export const Knowledge: Plugin.Object = {
  name: 'knowledge',
  inject: ['tools', 'sessions'],
  apply(ctx) {
    const service: KnowledgeService = {
      remember(text: string): void {
        const clean = text.trim()
        if (!clean) return
        const now = Date.now()
        const fact: MemoryFact = { id: `${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`, text: clean.slice(0, 500), ts: now }
        try { localStorage.setItem(PREFIX + now.toString(36) + '.' + fact.id.slice(-6), JSON.stringify(fact)) } catch { /* ignore */ }
        // trim beyond cap
        for (const { key } of scanKeys().slice(MAX_FACTS)) {
          try { localStorage.removeItem(key) } catch { /* ignore */ }
        }
      },
      forget(id: string): void {
        for (const { key } of scanKeys()) {
          const fact = read<MemoryFact>(key)
          if (fact?.id === id) { try { localStorage.removeItem(key) } catch { /* ignore */ } return }
        }
      },
      listMemory(): MemoryFact[] {
        return scanKeys()
          .map(({ key }) => read<MemoryFact>(key))
          .filter((f): f is MemoryFact => !!f)
          .sort((a, b) => b.ts - a.ts)
      },
    }

    const toolDefs: ToolDef[] = [
      {
        name: 'remember_fact',
        description: '把关于用户或环境的重要事实写入长期记忆（例如「用户的 OCR 账户没余额」「用户偏好简短回答」）。事实会注入之后的每轮对话。',
        parameters: {
          type: 'object',
          properties: { fact: { type: 'string', description: '要记住的事实，一句话' } },
          required: ['fact'],
          additionalProperties: false,
        },
        execute: async (args) => {
          const fact = String(args.fact || '').trim()
          if (!fact) return { content: JSON.stringify({ error: 'INVALID_ARGS', message: 'fact 不能为空' }) }
          service.remember(fact)
          return { content: `已记住：${fact}` }
        },
      },
      {
        name: 'list_memory',
        description: '列出当前全部长期记忆事实。',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        execute: async () => {
          const list = service.listMemory()
          return { content: list.map(f => `${new Date(f.ts).toLocaleString()} ${f.text}`).join('\n') || '（暂无长期记忆）' }
        },
      },
      {
        name: 'forget_fact',
        description: '按内容删除一条长期记忆（模糊匹配记忆文本）。',
        parameters: {
          type: 'object',
          properties: { text: { type: 'string', description: '记忆文本的一部分' } },
          required: ['text'],
          additionalProperties: false,
        },
        execute: async (args) => {
          const q = String(args.text || '').trim()
          const hit = service.listMemory().find(f => f.text.includes(q))
          if (!hit) return { content: `未找到匹配的记忆：${q}` }
          service.forget(hit.id)
          return { content: `已忘记：${hit.text}` }
        },
      },
    ]
    // Object plugins expose their service explicitly on the fork scope; the
    // provide is revoked automatically when the plugin unloads.
    ctx.provide('knowledge', service)
    const disposers = toolDefs.map(def => ctx.tools.register(def))
    ctx.collect('knowledge', () => disposers.forEach(d => d()))
  },
}
