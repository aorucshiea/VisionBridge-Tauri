/**
 * The VisionBridge harness: a cordis runtime living in the renderer.
 *
 * Every capability (model access, screen capture, record store, later: agent
 * loop, tools, profiles) is a plugin contributing a named service to the
 * shared context. Consumers resolve services by key (`ctx.llm`) instead of
 * importing implementations, and plugin registrations are reversible effects.
 *
 * The context is a module singleton per window. The main window starts it
 * explicitly on mount; other windows (result card) start it lazily on first
 * use — chat traffic routed through the harness needs it there for records.
 */
import { Context } from '@cordisjs/core'
import { Llm } from './plugins/llm'
import { Capture } from './plugins/capture'
import { Sessions } from './plugins/sessions'
import { Tools } from './plugins/tools'
import { BuiltinTools } from './plugins/builtin-tools'
import { Agents } from './plugins/agents'

let root: Context | null = null

export function startHarness(): Context {
  if (root) return root
  const ctx = new Context()
  ctx.plugin(Sessions)
  ctx.plugin(Tools)
  ctx.plugin(Llm)
  ctx.plugin(Capture)
  ctx.plugin(BuiltinTools)
  ctx.plugin(Agents)
  ctx.emit('harness/ready')

  // Testing/inspection seam.
  ;(window as any).__VB_HARNESS__ = ctx
  root = ctx
  return ctx
}

/** The harness context (starts it on first use). */
export function harness(): Context {
  return startHarness()
}

declare global {
  interface Window {
    /** Harness inspection/testing seam — set by startHarness(). */
    __VB_HARNESS__?: Context
  }
}

// Typed events of the runtime itself.
declare module '@cordisjs/core' {
  interface Events {
    'harness/ready': () => void
  }
}
