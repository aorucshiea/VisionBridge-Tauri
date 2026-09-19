/**
 * Builtin `ctx.tools` provider — the shared tool registry.
 *
 * Mirrors the dsh ToolDefinition split: a model-facing schema (name /
 * description / JSON-Schema parameters) plus a host-side executor that never
 * reaches the model. Executions are logged through `ctx.sessions`; failures
 * become structured error content so a bad tool never kills the agent turn.
 */
import { Context, Service } from '@cordisjs/core'
import type { ToolDef, ToolResult, ToolSchema, ToolsService } from '../services'

export class Tools extends Service implements ToolsService {
  static [Service.provide] = 'tools'
  static [Service.immediate] = true

  private defs = new Map<string, ToolDef>()

  constructor(ctx: Context) {
    super(ctx)
  }

  register(def: ToolDef): () => void {
    if (this.defs.has(def.name)) {
      throw new Error(`工具重名：${def.name}`)
    }
    this.defs.set(def.name, def)
    return () => { this.defs.delete(def.name) }
  }

  list(): ToolSchema[] {
    return [...this.defs.values()].map(d => ({ name: d.name, description: d.description, parameters: d.parameters }))
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const def = this.defs.get(name)
    if (!def) {
      return { content: JSON.stringify({ error: 'UNKNOWN_TOOL', message: `未知工具：${name}` }) }
    }
    return await this.ctx.sessions.track(
      'tool', { provider: name, model: '', baseUrl: '' },
      async () => {
        try {
          const out = await def.execute(args)
          return typeof out === 'string' ? { content: out } : out
        } catch (error: any) {
          return { content: JSON.stringify({ error: 'TOOL_FAILED', message: String(error?.message || error) }) }
        }
      },
      { inputChars: JSON.stringify(args ?? {}).length },
    )
  }
}
